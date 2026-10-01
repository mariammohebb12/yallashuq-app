import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { mockReturnDetail, mockReturnForm, mockReturnList } from './mocks/returns.mock';
import { odooJsonRpc } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * Return requests (list + detail).
 *
 * REAL CONTRACT, NOT YET TESTED END-TO-END. JSON-RPC routes from the backend controller
 * yallashuq_returns/controllers/returns_json.py, as pasted by the user (2026-10-01):
 * - /my/returns/json {page} → {status, page, page_count, total_count, returns: [{id, name,
 *   order_id, order_name, return_type, state, seller_decision, return_reason_code,
 *   total_refund_amount, currency, latest_pickup_date, waiting_reschedule, create_date}]}
 * - /my/returns/<id>/json → the same return fields (flat, next to `status`) + {
 *   seller_rejection_reason, return_reason, refund_type, tag_attached, tag_verification_status,
 *   return_label_pdf_url, lines: [{id, product_id, product_name, quantity, product_price,
 *   refund_amount}], pickup_attempts: [{id, requested_date, requested_slot, status}]}
 * Both are a 404 on staging (checked 2026-10-01). On production they exist (unauthenticated
 * JSON-RPC returns "Odoo Session Expired"), but no signed-in response has been seen yet.
 * Confirmed from the controller (user, 2026-10-01): the list takes `page` and `limit` (default
 * 20, capped at 50, as orders / wallet); the detail is one flat dict (no wrapper).
 *
 * - Amounts are plain numbers plus a currency code; shown like the wallet / gift cards,
 *   "₪ 2,360.00" (ILS or no currency), otherwise "2,360.00 USD". Nothing is calculated in the
 *   app: the total is the backend's `total_refund_amount`, never a sum of the lines.
 * - The backend sends codes, not labels. Labels confirmed from the live site are used where the
 *   code→label pair is known (reasons and pickup slots: the live return form's options; refund
 *   type "original": the live detail page). `state`, `seller_decision` and `return_type` values
 *   aren't enumerated: shown as-is, made readable ("seller_accepted" → "Seller accepted") — they
 *   may not read exactly like the website's badges ("Received & Verified", "Seller Accepted").
 * - Returned but not shown (not in the screens' field lists): return_type, waiting_reschedule,
 *   create_date, seller_rejection_reason, tag_attached, tag_verification_status,
 *   return_label_pdf_url, product_id, and each pickup attempt's status.
 * - The customer's photo is NOT in the contract, so imageUrl is always null with real data.
 * - "Refunded" may not mean money actually moved (CLAUDE.md, "Known Blockers").
 *
 * Fallback: ONLY when a route isn't there (a non-JSON reply, i.e. staging's 404 page), the
 * labelled SAMPLE DATA (src/api/mocks/returns.mock.ts) is returned (isSampleData: true, with its
 * banner). Any real error (signed out, network, backend error, someone else's return) is an
 * error state.
 * ---------------------------------------------------------------------------------------------
 */

export type ReturnBadge = { code: string; label: string };

/** One row of the live "Returned Items" table. */
export type ReturnLine = {
  id: number;
  productName: string;
  /** As sent, e.g. "1" (the sample data copies the live page's "1.0"). */
  quantityFormatted: string;
  /** e.g. "₪ 2,000.00". */
  priceFormatted: string;
  /** Live "Refunded" column, e.g. "₪ 2,360.00" (price + tax). Not proof the money moved. */
  refundedFormatted: string;
};

/** One row of the live "Pickup History" table. */
export type ReturnPickup = {
  dateFormatted: string;
  /** e.g. "Morning (9 AM - 12 PM)". */
  slotLabel: string;
};

export type ReturnDetail = {
  id: number;
  /** e.g. "RET/00006". */
  name: string;
  /** Live grey badge, e.g. "Received & Verified" (real data: the readable `state`). */
  progress: ReturnBadge;
  /** Live green badge, e.g. "Seller Accepted"; null until decided (or none sent). */
  decision: ReturnBadge | null;
  lines: ReturnLine[];
  totalExpectedRefundFormatted: string;
  pickups: ReturnPickup[];
  order: { id: number; name: string };
  /** e.g. "Original Payment Method". */
  refundMethodLabel: string;
  /** e.g. "Not as Described". */
  reasonLabel: string;
  /** Live "Return Reason" — "-" on every return checked on staging (and when none is sent). */
  returnReasonLabel: string;
  /** The customer's photo (full URL); null if none / not available yet (always, with real data). */
  imageUrl: string | null;
};

export type ReturnResult =
  | { ok: true; returnRequest: ReturnDetail | null; isSampleData: boolean }
  | { ok: false; message: string };

/** One row of the live /my/returns table. */
export type ReturnSummary = {
  id: number;
  /** e.g. "RET/00007". */
  name: string;
  order: { id: number; name: string };
  /** e.g. "09/20/2026"; '' when no pickup is scheduled. */
  pickupDateFormatted: string;
  /** Live "Refunded" column, e.g. "₪ 2,360.00". Not proof the money moved. */
  refundedFormatted: string;
  /** Grey (dark) badge, e.g. "Received & Verified". */
  progress: ReturnBadge;
  /** Green badge, e.g. "Seller Accepted"; null until decided. */
  decision: ReturnBadge | null;
};

export type ReturnListResult =
  | {
      ok: true;
      returns: ReturnSummary[];
      isSampleData: boolean;
      hasNext: boolean;
      nextPage: number;
    }
  | { ok: false; message: string };

/** Odoo sends `false` for empty fields. */
type ReturnJson = {
  id: number;
  name: string;
  order_id: number | false;
  order_name: string | false;
  return_type: string | false;
  state: string | false;
  seller_decision: string | false;
  return_reason_code: string | false;
  total_refund_amount: number;
  currency: string | false;
  latest_pickup_date: string | false;
  waiting_reschedule: boolean;
  create_date: string | false;
};

type ReturnsJsonResponse = {
  status: 'success' | (string & {});
  message?: string;
  page: number;
  page_count: number;
  total_count: number;
  returns: ReturnJson[];
};

type ReturnDetailJsonResponse = ReturnJson & {
  status: 'success' | (string & {});
  message?: string;
  seller_rejection_reason: string | false;
  return_reason: string | false;
  refund_type: string | false;
  tag_attached: string | boolean;
  tag_verification_status: string | false;
  return_label_pdf_url: string | false;
  lines: {
    id: number;
    product_id: number | false;
    product_name: string;
    quantity: number;
    product_price: number;
    refund_amount: number;
  }[];
  pickup_attempts: {
    id: number;
    requested_date: string | false;
    requested_slot: string | false;
    status: string | false;
  }[];
};

/** Confirmed from the live return form's "Reason for Return" options (staging, 2026-09-27). */
const REASON_LABELS: Record<string, string> = {
  damaged: 'Damaged Product',
  wrong_item: 'Wrong Item Received',
  not_as_described: 'Not as Described',
  quality_issue: 'Quality Issue',
  size_issue: 'Size/Fit Issue',
  changed_mind: 'Changed Mind',
  other: 'Other',
};

/** Confirmed from the live return form's pickup slot options (staging, 2026-09-27). */
const SLOT_LABELS: Record<string, string> = {
  morning: 'Morning (9 AM - 12 PM)',
  afternoon: 'Afternoon (1 PM - 5 PM)',
  evening: 'Evening (6 PM - 9 PM)',
};

/** Confirmed from the live /my/returns/<id> page ("Refund Method: Original Payment Method"). */
const REFUND_TYPE_LABELS: Record<string, string> = {
  original: 'Original Payment Method',
};

/** Same format as the wallet / gift cards: "₪ 1,234.50", or "1,234.50 USD" for other currencies. */
function formatMoney(amount: number, currency: string | false): string {
  const [whole, cents] = Math.abs(amount).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '- ' : '';
  if (!currency || currency.toUpperCase() === 'ILS') {
    return `${sign}₪ ${grouped}.${cents}`;
  }
  return `${sign}${grouped}.${cents} ${currency}`;
}

/**
 * MM/DD/YYYY, as the live page shows it. A plain date ("YYYY-MM-DD") is shown as is; an Odoo
 * datetime (UTC) in local time. Anything else is shown as sent.
 */
function formatDate(value: string | false): string {
  if (!value) {
    return '';
  }
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain) {
    return `${plain[2]}/${plain[3]}/${plain[1]}`;
  }
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const date = new Date(value.replace(' ', 'T') + (hasZone ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}

function readableLabel(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function labelFor(labels: Record<string, string>, code: string | false): string {
  return code ? (labels[code] ?? readableLabel(code)) : '';
}

function badge(code: string | false): ReturnBadge | null {
  return code ? { code, label: readableLabel(code) } : null;
}

function mapSummary(row: ReturnJson): ReturnSummary {
  return {
    id: row.id,
    name: row.name || '',
    order: { id: row.order_id || 0, name: row.order_name || '' },
    pickupDateFormatted: formatDate(row.latest_pickup_date),
    refundedFormatted: formatMoney(row.total_refund_amount ?? 0, row.currency),
    progress: badge(row.state) ?? { code: '', label: '' },
    decision: badge(row.seller_decision),
  };
}

function mapDetail(data: ReturnDetailJsonResponse): ReturnDetail {
  const summary = mapSummary(data);
  return {
    id: summary.id,
    name: summary.name,
    progress: summary.progress,
    decision: summary.decision,
    lines: data.lines.map((line) => ({
      id: line.id,
      productName: line.product_name || '',
      quantityFormatted: String(line.quantity ?? ''),
      priceFormatted: formatMoney(line.product_price ?? 0, data.currency),
      refundedFormatted: formatMoney(line.refund_amount ?? 0, data.currency),
    })),
    totalExpectedRefundFormatted: summary.refundedFormatted,
    pickups: (data.pickup_attempts ?? []).map((attempt) => ({
      dateFormatted: formatDate(attempt.requested_date),
      slotLabel: labelFor(SLOT_LABELS, attempt.requested_slot),
    })),
    order: summary.order,
    refundMethodLabel: labelFor(REFUND_TYPE_LABELS, data.refund_type),
    reasonLabel: labelFor(REASON_LABELS, data.return_reason_code),
    returnReasonLabel: data.return_reason || '-',
    imageUrl: null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE;
}

/**
 * REAL (untested end-to-end, see top of file): one page of the customer's returns. The page size
 * is the backend's; `hasNext` comes from its page_count.
 */
export async function fetchReturns(page = 1): Promise<ReturnListResult> {
  let data: ReturnsJsonResponse;
  try {
    data = await odooJsonRpc<ReturnsJsonResponse>('/my/returns/json', { page });
  } catch (error) {
    // A non-JSON reply (SyntaxError) is the 404 HTML page of a server without the route.
    if (error instanceof SyntaxError) {
      if (__DEV__) {
        console.log('[returns] /my/returns/json not deployed on this server — SAMPLE DATA');
      }
      return {
        ok: true,
        returns: mockReturnList(),
        isSampleData: true,
        hasNext: false,
        nextPage: 1,
      };
    }
    return { ok: false, message: errorMessage(error) };
  }
  if (data?.status !== 'success' || !Array.isArray(data.returns)) {
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  const currentPage = typeof data.page === 'number' ? data.page : page;
  return {
    ok: true,
    returns: data.returns.map(mapSummary),
    isSampleData: false,
    hasNext: typeof data.page_count === 'number' && currentPage < data.page_count,
    nextPage: currentPage + 1,
  };
}

/** REAL (untested end-to-end, see top of file). */
export async function fetchReturn(id: number): Promise<ReturnResult> {
  let data: ReturnDetailJsonResponse;
  try {
    data = await odooJsonRpc<ReturnDetailJsonResponse>(`/my/returns/${id}/json`, {});
  } catch (error) {
    if (error instanceof SyntaxError) {
      if (__DEV__) {
        console.log('[returns] /my/returns/<id>/json not deployed on this server — SAMPLE DATA');
      }
      // Sample detail only exists for some of the sample list's ids; null otherwise.
      return { ok: true, returnRequest: mockReturnDetail(id), isSampleData: true };
    }
    return { ok: false, message: errorMessage(error) };
  }
  if (data?.status !== 'success' || !Array.isArray(data.lines)) {
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  return { ok: true, returnRequest: mapDetail(data), isSampleData: false };
}

/*
 * ---------------------------------------------------------------------------------------------
 * New return request (the live /my/orders/<id>/return form).
 *
 * ⚠️ NOT SUBMITTABLE — NO JSON ROUTE ⚠️
 * The live form is server-rendered HTML that posts multipart/form-data to
 * /my/orders/return/submit (a JSON call to it is rejected: 400). The form's options (returnable
 * lines, reasons) also only exist in that HTML. Until docs/backend-requests/006-returns-json.md
 * ships, fetchReturnForm returns SAMPLE DATA and the app's Submit stays disabled — nothing is
 * sent.
 * ---------------------------------------------------------------------------------------------
 */

/** One returnable line (live: checkbox + "Qty to Return", min 1, max = what's returnable). */
export type ReturnFormLine = {
  /** sale.order.line id (live input names: line_<id>_selected / line_<id>_qty). */
  lineId: number;
  productName: string;
  maxQuantity: number;
};

/** Live "Reason for Return" option, e.g. { code: 'not_as_described', label: 'Not as Described' }. */
export type ReturnReasonOption = { code: string; label: string };

export type ReturnForm = {
  order: { id: number; name: string };
  lines: ReturnFormLine[];
  reasons: ReturnReasonOption[];
};

export type ReturnFormResult =
  | { ok: true; form: ReturnForm | null; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * TEMPORARY: returns the mock form for an order (isSampleData: true); `form` is null when the
 * order is unknown.
 * TODO: replace with the return-form route from docs/backend-requests/006-returns-json.md.
 */
export async function fetchReturnForm(orderId: number): Promise<ReturnFormResult> {
  return { ok: true, form: mockReturnForm(orderId), isSampleData: true };
}
