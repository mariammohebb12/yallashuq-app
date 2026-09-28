import { NETWORK_ERROR_MESSAGE } from './messages';
import { mockOrderDetail, mockOrderList } from './mocks/orders.mock';
import { odooJsonRpc } from './odoo-client';
import { productImageUrl } from './product-image-overrides';

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
    firstProductImageUrl:
      order.firstProductImageUrl && productImageUrl(order.firstProductImageUrl),
  };
}

/*
 * Order review ("Edit Review" on the list): two EXISTING JSON-RPC routes of the backend's
 * yallashuq_product_reviews module — what the live /my/orders popup calls (its review_modal.js).
 * NOT IN CLAUDE.md's CONFIRMED ROUTE LIST; checked on staging 2026-09-28 with the test customer:
 *   /my/orders/review/info   {order_id} → {status, is_update, product: {id, name, order_date,
 *                                          existing_rating, existing_comment, …}}
 *                                          or {status: 'error', message} ("Unauthorized" for an
 *                                          order that isn't the customer's)
 *   /my/orders/review/submit {order_id, product_id, rating 1–5, comment} → {status: 'success'}
 *                                          or {status: 'error', message}. All four are required
 *                                          (comment may be ''); resubmitting edits the review.
 * One product per order. The order ids come from the (still mock, #005) My Orders list, which
 * uses the staging test customer's real order ids.
 */

export type ReviewInfo = {
  /** product.template id — what submit takes as `product_id`. */
  productId: number;
  productName: string;
  /** Live: /web/image/product.template/<id>/image_128. */
  productImageUrl: string;
  /** As the backend formats it, e.g. "16/09/2026". */
  orderDateFormatted: string;
  /** The customer already reviewed this product: the popup opens pre-filled, in "update" mode. */
  isUpdate: boolean;
  /** 1–5, or 0 when there's no review yet. */
  existingRating: number;
  existingComment: string;
};

type ReviewResponse = { status?: string; message?: string };

type ReviewInfoResponse = ReviewResponse & {
  is_update?: boolean;
  product?: {
    id: number;
    name: string;
    order_date: string;
    existing_rating?: number;
    existing_comment?: string;
  };
};

// Confirmed from the live popup's script (its fallback when the backend sends no message).
const REVIEW_FAILED_MESSAGE = 'Failed to submit review.';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE;
}

export async function fetchReviewInfo(
  orderId: number
): Promise<{ ok: true; info: ReviewInfo } | { ok: false; message: string }> {
  try {
    const data = await odooJsonRpc<ReviewInfoResponse>('/my/orders/review/info', {
      order_id: orderId,
    });
    const product = data?.product;
    if (data?.status !== 'success' || !product) {
      return { ok: false, message: data?.message || NETWORK_ERROR_MESSAGE };
    }
    const isUpdate = data.is_update === true;
    return {
      ok: true,
      info: {
        productId: product.id,
        productName: product.name,
        productImageUrl: productImageUrl(`/web/image/product.template/${product.id}/image_128`),
        orderDateFormatted: product.order_date,
        isUpdate,
        existingRating: isUpdate ? (product.existing_rating ?? 0) : 0,
        existingComment: isUpdate ? (product.existing_comment ?? '') : '',
      },
    };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

/** Creates the review, or updates the customer's existing one for this order's product. */
export async function submitReview(review: {
  orderId: number;
  productId: number;
  rating: number;
  comment: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const data = await odooJsonRpc<ReviewResponse>('/my/orders/review/submit', {
      order_id: review.orderId,
      product_id: review.productId,
      rating: review.rating,
      comment: review.comment, // Always sent ('' when left blank): the route requires it.
    });
    return data?.status === 'success'
      ? { ok: true }
      : { ok: false, message: data?.message || REVIEW_FAILED_MESSAGE };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}
