import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { mockTracking } from './mocks/delivery-tracking.mock';
import { odooJsonRpc } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * Order tracking (one order's shipment and its legs).
 *
 * REAL CONTRACT, NOT YET TESTED END-TO-END. POST (JSON-RPC) /api/delivery/track { order_id }, from
 * yallashuq_delivery_hub/controllers/main.py (track_shipment, rebuilt 2026-09-30), as pasted by
 * the user. Checked 2026-09-30:
 * - staging still runs the OLD FAKE STUB: {"status": "shipped", "shipping_cost": 45.0} for every
 *   order (no `legs`) — that "shipped" is NOT real and is never shown;
 * - production: the route exists (unauthenticated → "Odoo Session Expired"); no signed-in
 *   response seen yet, so it isn't confirmed that production runs the new version.
 *
 * Statuses (`shipment_status`, each leg's `status`) aren't enumerated: shown as sent, made
 * readable ("not_yet_shipped" → "Not yet shipped"), English only. One order can have 0, 1 or
 * several legs (e.g. cross-border).
 *
 * Fallback: ONLY when the route isn't there (a non-JSON reply, i.e. a 404 page) or answers in the
 * old stub's format (no `legs` at all), fetchTracking returns labelled SAMPLE DATA
 * (isSampleData: true). Any real error (signed out, network, backend error) is an error state.
 *
 * Not confirmed (backend): that the route only answers for the signed-in customer's own orders.
 * ---------------------------------------------------------------------------------------------
 */

export type TrackingStatus = {
  /** As sent by the backend; unknown values are shown as-is. */
  code: string;
  /** Made from `code` in the app; the backend sends no label. */
  label: string;
};

export type TrackingLeg = {
  id: number;
  /** null when the backend sends none. */
  name: string | null;
  status: TrackingStatus;
  trackingNumber: string | null;
  provider: string | null;
  lastUpdatedFormatted: string | null;
  completedAtFormatted: string | null;
};

export type OrderTracking = {
  status: TrackingStatus;
  /** `shipment_status` is "not_yet_shipped" (the backend sends no legs then). */
  notYetShipped: boolean;
  trackingNumber: string | null;
  provider: string | null;
  lastUpdatedFormatted: string | null;
  legs: TrackingLeg[];
};

export type TrackingResult =
  | { ok: true; tracking: OrderTracking; isSampleData: boolean }
  | { ok: false; message: string };

/** Odoo sends `false` for empty fields. */
type TrackJsonResponse = {
  status: 'success' | (string & {});
  message?: string;
  shipment_status?: string;
  tracking_number?: string | false;
  provider?: string | false;
  last_updated?: string | false;
  legs?: {
    id: number;
    leg_name: string | false;
    status: string;
    tracking_number: string | false;
    provider: string | false;
    last_updated: string | false;
    completed_at: string | false;
  }[];
};

const NOT_YET_SHIPPED = 'not_yet_shipped';

function statusLabel(code: string): TrackingStatus {
  const words = (code || '').replace(/[_-]+/g, ' ').trim();
  return { code: code || '', label: words.charAt(0).toUpperCase() + words.slice(1) };
}

/** Odoo datetimes are UTC ("YYYY-MM-DD HH:MM:SS" or ISO); shown as local MM/DD/YYYY HH:MM. */
function formatDateTime(value: string | false | undefined): string | null {
  if (!value) {
    return null;
  }
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const date = new Date(value.replace(' ', 'T') + (hasZone ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function sampleData(reason: string): TrackingResult {
  if (__DEV__) {
    console.log(`[tracking] ${reason} — showing SAMPLE DATA`);
  }
  return { ok: true, tracking: mockTracking(), isSampleData: true };
}

/** REAL (untested end-to-end, see top of file). */
export async function fetchTracking(orderId: number): Promise<TrackingResult> {
  let data: TrackJsonResponse;
  try {
    data = await odooJsonRpc<TrackJsonResponse>('/api/delivery/track', { order_id: orderId });
  } catch (error) {
    // A non-JSON reply (SyntaxError) is the 404 HTML page of a server without the route.
    if (error instanceof SyntaxError) {
      return sampleData('/api/delivery/track not deployed on this server');
    }
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
  if (data && data.status !== 'error' && data.legs === undefined && data.shipment_status === undefined) {
    return sampleData('/api/delivery/track answered in the OLD STUB format');
  }
  if (data?.status !== 'success' || !Array.isArray(data.legs) || !data.shipment_status) {
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  return {
    ok: true,
    isSampleData: false,
    tracking: {
      status: statusLabel(data.shipment_status),
      notYetShipped: data.shipment_status === NOT_YET_SHIPPED,
      trackingNumber: data.tracking_number || null,
      provider: data.provider || null,
      lastUpdatedFormatted: formatDateTime(data.last_updated),
      legs: data.legs.map((leg) => ({
        id: leg.id,
        name: leg.leg_name || null,
        status: statusLabel(leg.status),
        trackingNumber: leg.tracking_number || null,
        provider: leg.provider || null,
        lastUpdatedFormatted: formatDateTime(leg.last_updated),
        completedAtFormatted: formatDateTime(leg.completed_at),
      })),
    },
  };
}
