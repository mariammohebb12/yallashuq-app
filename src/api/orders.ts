import { mockOrderDetail, mockOrderList, mockReviewInfo } from './mocks/orders.mock';
import { odooUrl } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * My Orders (list + detail).
 *
 * ⚠️ BLOCKED ON BACKEND — RUNS ON TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * No existing route returns a customer's orders as JSON: /my/orders and /my/orders/<id> are
 * server-rendered HTML only (checked on staging 2026-09-26). Requested in
 * docs/backend-requests/005-orders-json.md. Until those routes exist, fetchOrders / fetchOrder
 * return SAMPLE DATA (src/api/mocks/orders.mock.ts) shaped like the requested response
 * (camelCased; amounts are the backend's formatted strings — nothing is calculated in the app).
 *
 * Deliberately NOT used, because staging shows them wrong (see #005, "Bugs found"):
 * - /my/counters' `order_count` (said 1 while the list had 13 orders) — the list's own length is
 *   the only count, and the screen doesn't show one;
 * - the detail page's "payment successfully processed" banner and the invoice's payment status
 *   (both shown at once, contradicting each other) — no payment status is shown until #005
 *   returns one authoritative value.
 * ---------------------------------------------------------------------------------------------
 */

/** Order status as the backend reports it (CLAUDE.md: Packing → Shipped → Delivered). */
export type OrderStatus = {
  /** Unknown codes are shown with a neutral badge. */
  code: 'packing' | 'shipped' | 'delivered' | (string & {});
  /** Backend-translated label, e.g. "Shipped". */
  label: string;
};

export type OrderSeller = { id: number; name: string };

/** One row of the list — exactly the live /my/orders columns. */
export type OrderSummary = {
  id: number;
  /** Order reference, e.g. "S00073". */
  name: string;
  dateFormatted: string;
  timeFormatted: string;
  totalFormatted: string;
  /** Backend decides; the live list shows "Return" only on some orders. */
  returnAvailable: boolean;
  /**
   * Thumbnail of the order's first product (full URL); null if none. Not on the live list —
   * asked for in the app's list card and requested in #005.
   */
  firstProductImageUrl: string | null;
};

export type OrderLine = {
  id: number;
  /** As the live page shows it, e.g. "[YO223] Badminton Racket" or "Delivery (John Doe)". */
  name: string;
  isDelivery: boolean;
  /** e.g. "2.00 Units". */
  quantityFormatted: string;
  /** e.g. "2,000.00", or the backend's own label such as "FREE". */
  priceUnitFormatted: string;
  /** Product's internal reference, e.g. "YO223" (live: "[YO223] Badminton Racket"); null if none. */
  sku: string | null;
  /** e.g. "18% PA". */
  taxesLabel: string;
  /** e.g. "₪ 4,000.00". */
  amountFormatted: string;
};

export type OrderContact = {
  name: string;
  /** Address lines as the backend formats them (street, street2, city/zip, state, country). */
  addressLines: string[];
  phone: string;
  email: string;
};

export type OrderInvoice = {
  id: number;
  /** e.g. "INV/2026/00012". */
  name: string;
  dateFormatted: string;
};

export type OrderDelivery = {
  id: number;
  /** e.g. "WH/OUT/00052". */
  name: string;
  dateFormatted: string;
  /** This delivery's own state, e.g. "Shipped" (live: badge in "Last Delivery Orders"). */
  status: OrderStatus;
  /** null until the seller/courier provides one (staging showed none on any order). */
  tracking: { number: string; carrier: string } | null;
};

/**
 * ONE authoritative payment state (requested in #005). Staging's page contradicts itself (a
 * "payment successfully processed" banner next to a "Waiting Payment" invoice), so the app shows
 * the banner only when this says paid — never unconditionally.
 */
export type OrderPaymentStatus = {
  code: 'paid' | 'not_paid' | (string & {});
  label: string;
};

/**
 * A return request already made for this order (live: the "Previous Return Requests for This
 * Order" table on /my/orders/<id>/return; the two badges are from the /my/returns list).
 */
export type OrderReturn = {
  id: number;
  /** e.g. "RET/00006". */
  name: string;
  pickupDateFormatted: string;
  /** Live "Items Qty" column, e.g. "1". */
  itemsQtyFormatted: string;
  /** Where the return is, e.g. "Received & Verified" (live: grey badge). */
  progress: { code: string; label: string };
  /**
   * The decision, e.g. "Accepted" (live: green badge in this table; the /my/returns list labels
   * the same return "Seller Accepted"); null until decided.
   */
  decision: { code: string; label: string } | null;
};

export type OrderDetail = OrderSummary & {
  status: OrderStatus;
  /** One seller per order: the backend splits a multi-seller checkout into one order per seller. */
  seller: OrderSeller;
  contact: OrderContact;
  lines: OrderLine[];
  totals: {
    untaxedFormatted: string;
    /** One row per tax group, e.g. { label: "VAT 18%", amountFormatted: "₪ 720.00" }. */
    taxGroups: { label: string; amountFormatted: string }[];
    totalFormatted: string;
  };
  paymentStatus: OrderPaymentStatus;
  /** e.g. "Immediate Payment" (live: "Payment terms: Immediate Payment"); null if none. */
  paymentTermsLabel: string | null;
  invoices: OrderInvoice[];
  deliveries: OrderDelivery[];
  /** Site-relative, e.g. "/terms"; null if none. */
  termsUrl: string | null;
  /** Return requests already made for this order; empty if none. */
  returns: OrderReturn[];
};

export type OrdersResult =
  | { ok: true; orders: OrderSummary[]; isSampleData: boolean }
  | { ok: false; message: string };

export type OrderResult =
  | { ok: true; order: OrderDetail | null; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * TEMPORARY: returns the mock list (isSampleData: true).
 * TODO: replace with the order-list route once it exists (docs/backend-requests/005-orders-json.md).
 */
export async function fetchOrders(): Promise<OrdersResult> {
  return { ok: true, orders: mockOrderList().map(withImageUrl), isSampleData: true };
}

/**
 * TEMPORARY: returns a mock order (isSampleData: true); `order` is null when the id is unknown.
 * TODO: replace with the order-detail route once it exists (docs/backend-requests/005-orders-json.md).
 */
export async function fetchOrder(id: number): Promise<OrderResult> {
  const order = mockOrderDetail(id);
  return { ok: true, order: order && withImageUrl(order), isSampleData: true };
}

/** The backend sends a site-relative image path (as the catalog does); the app needs a URL. */
function withImageUrl<T extends OrderSummary>(order: T): T {
  return {
    ...order,
    firstProductImageUrl: order.firstProductImageUrl && odooUrl(order.firstProductImageUrl),
  };
}

/*
 * Order review ("Edit Review" on the list). The live site uses two EXISTING JSON-RPC routes:
 *   rpc('/my/orders/review/info', {order_id})  → the order's product + any existing review
 *   rpc('/my/orders/review/submit', {order_id, product_id, rating, comment})
 * Not called yet: the orders themselves are still mock data (#005), so their ids and products
 * don't line up with the signed-in customer's real orders. Nothing is submitted anywhere.
 */

export type ReviewInfo = {
  productName: string;
  /** Live: /web/image/product.template/<id>/image_128; null when there's no product id. */
  productImageUrl: string | null;
  orderDateFormatted: string;
  /** The customer already reviewed this product: the popup opens pre-filled, in "update" mode. */
  isUpdate: boolean;
  /** 1–5, or 0 when there's no review yet. */
  existingRating: number;
  existingComment: string;
};

/**
 * TEMPORARY: mock shaped like /my/orders/review/info (see above); `info` is null for an unknown
 * order. TODO: odooJsonRpc('/my/orders/review/info', {order_id}) once orders are real (#005).
 */
export async function fetchReviewInfo(
  orderId: number
): Promise<{ ok: true; info: ReviewInfo | null } | { ok: false; message: string }> {
  const data = mockReviewInfo(orderId);
  if (!data) {
    return { ok: true, info: null };
  }
  const { product } = data;
  return {
    ok: true,
    info: {
      productName: product.name,
      productImageUrl:
        product.id !== null ? odooUrl(`/web/image/product.template/${product.id}/image_128`) : null,
      orderDateFormatted: product.order_date,
      isUpdate: data.is_update,
      existingRating: data.is_update ? data.existing_rating : 0,
      existingComment: data.is_update ? data.existing_comment : '',
    },
  };
}
