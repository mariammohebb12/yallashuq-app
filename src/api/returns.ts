import { mockReturnDetail, mockReturnForm, mockReturnList } from './mocks/returns.mock';

/*
 * ---------------------------------------------------------------------------------------------
 * Return requests (list + detail).
 *
 * ⚠️ BLOCKED ON BACKEND — RUNS ON TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * No route returns a return request as JSON: /my/returns and /my/returns/<id> are server-rendered
 * HTML only, and JSON calls to them are rejected (checked on staging 2026-09-27). Requested in
 * docs/backend-requests/006-returns-json.md. Until it ships, fetchReturn returns SAMPLE DATA
 * (src/api/mocks/returns.mock.ts). Amounts are the backend's formatted strings — nothing is
 * calculated in the app.
 * ---------------------------------------------------------------------------------------------
 */

export type ReturnBadge = { code: string; label: string };

/** One row of the live "Returned Items" table. */
export type ReturnLine = {
  id: number;
  productName: string;
  /** As the live page shows it, e.g. "1.0". */
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
  /** Live grey badge, e.g. "Received & Verified". */
  progress: ReturnBadge;
  /** Live green badge, e.g. "Seller Accepted"; null until decided. */
  decision: ReturnBadge | null;
  lines: ReturnLine[];
  totalExpectedRefundFormatted: string;
  pickups: ReturnPickup[];
  order: { id: number; name: string };
  /** e.g. "Original Payment Method". */
  refundMethodLabel: string;
  /** e.g. "Not as Described". */
  reasonLabel: string;
  /** Live "Return Reason" — "-" on every return checked on staging. */
  returnReasonLabel: string;
  /** The customer's photo (full URL); null if none / not available yet. */
  imageUrl: string | null;
};

export type ReturnResult =
  | { ok: true; returnRequest: ReturnDetail | null; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * TEMPORARY: returns a mock return (isSampleData: true); `returnRequest` is null when the id is
 * unknown.
 * TODO: replace with the return-detail route from docs/backend-requests/006-returns-json.md.
 */
export async function fetchReturn(id: number): Promise<ReturnResult> {
  return { ok: true, returnRequest: mockReturnDetail(id), isSampleData: true };
}

/** One row of the live /my/returns table. */
export type ReturnSummary = {
  id: number;
  /** e.g. "RET/00007". */
  name: string;
  order: { id: number; name: string };
  /** e.g. "09/20/2026". */
  pickupDateFormatted: string;
  /** Live "Refunded" column, e.g. "₪ 2,360.00". Not proof the money moved. */
  refundedFormatted: string;
  /** Grey (dark) badge, e.g. "Received & Verified". */
  progress: ReturnBadge;
  /** Green badge, e.g. "Seller Accepted"; null until decided. */
  decision: ReturnBadge | null;
};

export type ReturnListResult =
  | { ok: true; returns: ReturnSummary[]; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * TEMPORARY: the staging test customer's real rows as sample data (isSampleData: true). The live
 * /my/returns page is HTML only (no JSON route; checked 2026-09-28).
 * TODO: replace with Route 3 (`/my/returns_json`) of docs/backend-requests/006-returns-json.md.
 */
export async function fetchReturns(): Promise<ReturnListResult> {
  return { ok: true, returns: mockReturnList(), isSampleData: true };
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
