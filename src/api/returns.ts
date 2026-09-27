import { mockReturnDetail } from './mocks/returns.mock';

/*
 * ---------------------------------------------------------------------------------------------
 * Return requests (detail).
 *
 * ⚠️ BLOCKED ON BACKEND — RUNS ON TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * No route returns a return request as JSON: /my/returns and /my/returns/<id> are server-rendered
 * HTML only, and JSON calls to them are rejected (checked on staging 2026-09-27). Until a route
 * exists, fetchReturn returns SAMPLE DATA (src/api/mocks/returns.mock.ts). Amounts are the
 * backend's formatted strings — nothing is calculated in the app.
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
 * TODO: replace with a return-detail route once it exists.
 */
export async function fetchReturn(id: number): Promise<ReturnResult> {
  return { ok: true, returnRequest: mockReturnDetail(id), isSampleData: true };
}
