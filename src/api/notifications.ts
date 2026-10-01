import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { mockNotifications } from './mocks/notifications.mock';
import { odooJsonRpc } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * In-app notification inbox (signed-in customers only).
 *
 * REAL CONTRACT, NOT YET TESTED END-TO-END. Read from the backend code (yallashuq_seller,
 * controllers/main.py + models/notification.py, commit f756149, 2026-10-01):
 * - /my/notifications/json {page, limit (≤ 50), unread_only} → {status, page, page_count,
 *   total_count, unread_count, notifications: [{id, title, body, type, is_read, created_at,
 *   res_model, res_id}]}, newest first. `type` ∈ order | warranty | return | promotional |
 *   support | general. `res_model` / `res_id` = optional link to a record (e.g. sale.order 42).
 * - /my/notifications/<id>/read {} → {status: 'success'} or {status: 'error', message}
 * - /my/notifications/read_all {} → {status: 'success', marked_count}
 * All three are auth='user'. On production they exist (signed out → "Odoo Session Expired",
 * 2026-10-01); staging is a 404. The model is NEW: its table only exists once the module is
 * upgraded on the server — until then a signed-in call fails (shown as a real error).
 *
 * NOTHING CREATES NOTIFICATIONS YET: no backend code calls yallashuq.notification._notify(), so
 * the inbox stays empty until someone decides which events notify customers. NO PUSH: nothing
 * arrives on the phone by itself — push needs a separate decision (Firebase / APNs / OneSignal /
 * Expo push account). This is the in-app inbox only.
 *
 * Fallback: ONLY when a route isn't there (a non-JSON reply, i.e. staging's 404 page), labelled
 * SAMPLE DATA is returned (isSampleData: true); mark-read then only changes the sample in memory.
 * Any real error (signed out, network, backend error) is an error state.
 * ---------------------------------------------------------------------------------------------
 */

export type NotificationType =
  | 'order'
  | 'warranty'
  | 'return'
  | 'promotional'
  | 'support'
  | 'general'
  | (string & {});

/** Where tapping a notification goes; null = nowhere in the app (only marks it read). */
export type NotificationLink =
  | { screen: 'order'; id: number }
  | { screen: 'return'; id: number }
  | null;

export type AppNotification = {
  id: number;
  title: string;
  body: string;
  type: NotificationType;
  /** The backend's label for `type` (its selection), e.g. "Order Update". */
  typeLabel: string;
  isRead: boolean;
  /** Local "MM/DD/YYYY HH:MM". */
  createdFormatted: string;
  link: NotificationLink;
};

export type NotificationsResult =
  | {
      ok: true;
      notifications: AppNotification[];
      unreadCount: number;
      isSampleData: boolean;
      hasNext: boolean;
      nextPage: number;
    }
  | { ok: false; message: string };

export type NotificationActionResult = { ok: true } | { ok: false; message: string };

/** Odoo sends `false` for empty fields. */
type NotificationJson = {
  id: number;
  title: string;
  body: string | false;
  type: string;
  is_read: boolean;
  created_at: string | false;
  res_model: string | false;
  res_id: number | false;
};

type NotificationsJsonResponse = {
  status: 'success' | (string & {});
  message?: string;
  page: number;
  page_count: number;
  total_count: number;
  unread_count: number;
  notifications: NotificationJson[];
};

type StatusResponse = { status: 'success' | 'error' | (string & {}); message?: string };

/** The backend model's own labels (yallashuq.notification.notification_type). */
const TYPE_LABELS: Record<string, string> = {
  order: 'Order Update',
  warranty: 'Warranty',
  return: 'Return / Refund',
  promotional: 'Promotional',
  support: 'Support',
  general: 'General',
};

/** Records the app has a screen for. Anything else (warranty, tickets, …) has no link yet. */
function toLink(resModel: string | false, resId: number | false): NotificationLink {
  if (!resModel || !resId) {
    return null;
  }
  if (resModel === 'sale.order') {
    return { screen: 'order', id: resId };
  }
  if (resModel === 'return.request') {
    return { screen: 'return', id: resId };
  }
  return null;
}

/** Odoo datetimes are UTC (isoformat, no zone); shown in local time. */
function formatCreated(value: string | false): string {
  if (!value) {
    return '';
  }
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const date = new Date(value.replace(' ', 'T') + (hasZone ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function mapNotification(row: NotificationJson): AppNotification {
  const type = row.type || 'general';
  return {
    id: row.id,
    title: row.title || '',
    body: row.body || '',
    type,
    typeLabel: TYPE_LABELS[type] ?? type,
    isRead: row.is_read === true,
    createdFormatted: formatCreated(row.created_at),
    link: toLink(row.res_model, row.res_id),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE;
}

/** REAL (untested end-to-end, see top of file): one page, newest first. */
export async function fetchNotifications(page = 1): Promise<NotificationsResult> {
  let data: NotificationsJsonResponse;
  try {
    data = await odooJsonRpc<NotificationsJsonResponse>('/my/notifications/json', { page });
  } catch (error) {
    // A non-JSON reply (SyntaxError) is the 404 HTML page of a server without the route.
    if (error instanceof SyntaxError) {
      const notifications = mockNotifications();
      return {
        ok: true,
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
        isSampleData: true,
        hasNext: false,
        nextPage: 1,
      };
    }
    return { ok: false, message: errorMessage(error) };
  }
  if (data?.status !== 'success' || !Array.isArray(data.notifications)) {
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  const currentPage = typeof data.page === 'number' ? data.page : page;
  return {
    ok: true,
    notifications: data.notifications.map(mapNotification),
    unreadCount: typeof data.unread_count === 'number' ? data.unread_count : 0,
    isSampleData: false,
    hasNext: typeof data.page_count === 'number' && currentPage < data.page_count,
    nextPage: currentPage + 1,
  };
}

/**
 * The bell's number. `null` = don't show a count: signed out, an error, or sample data (a sample
 * count on the bell would look real outside the inbox's sample banner).
 */
export async function fetchUnreadCount(): Promise<number | null> {
  try {
    const data = await odooJsonRpc<NotificationsJsonResponse>('/my/notifications/json', {
      page: 1,
      limit: 1,
    });
    return data?.status === 'success' && typeof data.unread_count === 'number'
      ? data.unread_count
      : null;
  } catch {
    return null;
  }
}

async function postAction(path: string): Promise<NotificationActionResult> {
  try {
    const data = await odooJsonRpc<StatusResponse>(path, {});
    return data?.status === 'success'
      ? { ok: true }
      : { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

/** REAL: marks one notification read (the caller skips this on sample data). */
export function markNotificationRead(id: number): Promise<NotificationActionResult> {
  return postAction(`/my/notifications/${id}/read`);
}

/** REAL: marks all of the customer's notifications read (skipped on sample data). */
export function markAllNotificationsRead(): Promise<NotificationActionResult> {
  return postAction('/my/notifications/read_all');
}
