import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { odooJsonRpc } from './odoo-client';

/*
 * MishMesh human support session (custom addon `mishmesh_helpdesk_support`) — the chat the website's
 * MishMesh popup switches to in "human mode" (/mishmesh_helpdesk_support/static/src/js/mishmesh_support.js).
 *
 * REAL: three JSON-RPC routes, checked on staging 2026-09-28 (docs/backend-requests/021):
 * - /mishmesh/support/status {} → {active: false}, or
 *   {active: true, channel_id, ticket_id, ticket_name, is_accepted}
 * - /mishmesh/support/messages {channel_id, after_id} →
 *   {active, channel_id, ticket_id, messages: [{id, body, author, is_customer}]}
 * - /mishmesh/support/send {channel_id, message} → {status: "success"} or {status: "error", message}
 * Sessions are per customer (a guest gets active: false; ownership is enforced server-side).
 *
 * NOT AVAILABLE: starting a session. `status` only reports one; today a session is created only by
 * the My Orders "SUPPORT" HTML form (POST /my/orders/<id>/mishmesh_support). Asked for in
 * request 021, item 6 (chat handoff) / item 7 (JSON version of that form).
 */

export type SupportSession = {
  channelId: number;
  ticketId: number | null;
  ticketName: string | null;
  /** An agent has accepted the session (the website shows "Awaiting Agent" until then). */
  isAccepted: boolean;
};

export type SupportMessage = {
  id: number;
  /** Plain text (the backend's body may be HTML; tags are stripped here). */
  text: string;
  author: string | null;
  isCustomer: boolean;
};

type Failure = { ok: false; message: string };

type RawStatus = {
  active?: boolean;
  channel_id?: number;
  ticket_id?: number | false;
  ticket_name?: string | false;
  is_accepted?: boolean;
};

type RawMessage = {
  id: number;
  body?: string | false;
  author?: string | false;
  is_customer?: boolean;
};

/** `session` null = no active session for this customer (or signed out). */
export async function fetchSupportStatus(): Promise<
  { ok: true; session: SupportSession | null } | Failure
> {
  try {
    const data = await odooJsonRpc<RawStatus>('/mishmesh/support/status', {});
    if (!data?.active || !data.channel_id) {
      return { ok: true, session: null };
    }
    return {
      ok: true,
      session: {
        channelId: data.channel_id,
        ticketId: data.ticket_id || null,
        ticketName: data.ticket_name || null,
        isAccepted: data.is_accepted === true,
      },
    };
  } catch (error) {
    return failure(error);
  }
}

/** Messages newer than `afterId` (0 = all). `active` false = the session has ended. */
export async function fetchSupportMessages(
  channelId: number,
  afterId: number
): Promise<{ ok: true; active: boolean; messages: SupportMessage[] } | Failure> {
  try {
    const data = await odooJsonRpc<{ active?: boolean; messages?: RawMessage[] }>(
      '/mishmesh/support/messages',
      { channel_id: channelId, after_id: afterId }
    );
    return {
      ok: true,
      active: data?.active !== false,
      messages: (data?.messages ?? []).map((m) => ({
        id: m.id,
        text: htmlToText(m.body || ''),
        author: m.author || null,
        isCustomer: m.is_customer === true,
      })),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function sendSupportMessage(
  channelId: number,
  message: string
): Promise<{ ok: true } | Failure> {
  try {
    const data = await odooJsonRpc<{ status?: string; message?: string }>(
      '/mishmesh/support/send',
      { channel_id: channelId, message }
    );
    if (data?.status === 'success') {
      return { ok: true };
    }
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): Failure {
  return {
    ok: false,
    message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}
