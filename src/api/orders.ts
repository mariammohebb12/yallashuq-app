import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { mockOrderDetail, mockOrderList } from './mocks/orders.mock';
import { odooJsonRpc } from './odoo-client';
import { productImageUrl } from './product-image-overrides';
import {
  formatDate as formatDateLocale,
  formatMoney as formatMoneyLocale,
  formatNumber as formatNumberLocale,
  formatTime as formatTimeLocale,
} from '@/utils/locale-format';

/*
 * ---------------------------------------------------------------------------------------------
 * My Orders (list + detail).
 *
 * REAL CONTRACT, NOT YET TESTED END-TO-END. JSON-RPC routes from yallashuq_seller/controllers/
 * orders.py (commit df4de4c, production only), as pasted by the user (requested in
 * docs/backend-requests/005-orders-json.md):
 * - /my/orders/json {page} → {status, page, page_count, total_count, orders: [{id, name,
 *   date_order, state, custom_payment_state, amount_total, currency, line_count}]}
 * - /my/orders/<id>/json → the same order fields + {partner_name, lines: [{id, name,
 *   product_uom_qty, price_unit, price_subtotal, price_total, is_extended_warranty}]}
 * Both are a 404 on staging (checked 2026-09-30); no signed-in production response seen yet.
 *
 * The contract covers only PART of the detail screen. With real data the app leaves out what it
 * doesn't return (user decision 2026-09-30) — the fields below are null / empty then:
 * - status (Packing → Shipped → Delivered): the contract only has Odoo's generic sale.order
 *   `state` ("sale", ...), and payment only `custom_payment_state`, whose values aren't
 *   documented — both HIDDEN until confirmed (no badge, no "payment processed" banner);
 * - seller, address/phone/email (only `partner_name`), taxes (per line and totals; never
 *   calculated in the app), payment terms, invoices, deliveries (so no "Track" link), terms link,
 *   return requests and the returnable flag, product images, SKU, units of measure.
 * Missing fields are listed in #005 (update 2026-09-30).
 *
 * Fallback: ONLY when a route isn't there (a non-JSON reply, i.e. staging's 404 page), the
 * previous SAMPLE DATA is returned (isSampleData: true, with its banner). Any real error
 * (signed out, network, backend error) is an error state.
 *
 * Deliberately NOT used, because staging shows them wrong (see #005, "Bugs found"): /my/counters'
 * `order_count`, and the HTML page's "payment successfully processed" banner.
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
  /** Real data: always false (the contract has no delivery flag). */
  isDelivery: boolean;
  /** e.g. "2.00 Units" (real data: "2.00" — the contract has no unit of measure). */
  quantityFormatted: string;
  /** e.g. "2,000.00", or the backend's own label such as "FREE". */
  priceUnitFormatted: string;
  /** Product's internal reference, e.g. "YO223" (live: "[YO223] Badminton Racket"); null if none. */
  sku: string | null;
  /**
   * Added 2026-10-02 (tracker #29, docs/backend-requests/025-order-lines-need-product-id.md):
   * the product.template id behind this line, straight from the backend's /my/orders/<id>/json
   * — null for a non-product line (delivery, a note) or on sample data. Lets "Order Again"
   * (order-again.ts) map a line to a real catalog product directly, instead of the old
   * HTML-scraping fallback.
   */
  productTemplateId: number | null;
  /** e.g. "18% PA"; null when unknown (real data: not in the contract). */
  taxesLabel: string | null;
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

/** Fields marked "null (real data)" aren't in the orders JSON contract (see top of file). */
export type OrderDetail = OrderSummary & {
  /** null (real data): hidden until the shipping status is returned. */
  status: OrderStatus | null;
  /**
   * One seller per order: the backend splits a multi-seller checkout into one order per seller.
   * null (real data).
   */
  seller: OrderSeller | null;
  /** Real data: only the name (`partner_name`); no address lines, phone or email. */
  contact: OrderContact;
  lines: OrderLine[];
  totals: {
    /** null (real data). */
    untaxedFormatted: string | null;
    /** One row per tax group, e.g. { label: "VAT 18%", amountFormatted: "₪ 720.00" }. */
    taxGroups: { label: string; amountFormatted: string }[];
    totalFormatted: string;
  };
  /** null (real data): hidden until custom_payment_state's values are confirmed. */
  paymentStatus: OrderPaymentStatus | null;
  /** e.g. "Immediate Payment" (live: "Payment terms: Immediate Payment"); null if none. */
  paymentTermsLabel: string | null;
  invoices: OrderInvoice[];
  deliveries: OrderDelivery[];
  /** Site-relative, e.g. "/terms"; null if none. */
  termsUrl: string | null;
  /** Return requests already made for this order; empty if none; null (real data) = unknown. */
  returns: OrderReturn[] | null;
};

export type OrdersResult =
  | {
      ok: true;
      orders: OrderSummary[];
      isSampleData: boolean;
      /** More pages after this one (the backend's page < page_count). */
      hasNext: boolean;
      nextPage: number;
    }
  | { ok: false; message: string };

export type OrderResult =
  | { ok: true; order: OrderDetail | null; isSampleData: boolean }
  | { ok: false; message: string };

/** Odoo sends `false` for empty fields. */
type OrderSummaryJson = {
  id: number;
  name: string;
  date_order: string | false;
  state: string;
  custom_payment_state: string;
  amount_total: number;
  currency: string | false;
  line_count: number;
};

type OrdersJsonResponse = {
  status: 'success' | (string & {});
  message?: string;
  page: number;
  page_count: number;
  total_count: number;
  orders: OrderSummaryJson[];
};

type OrderJsonResponse = OrderSummaryJson & {
  status: 'success' | (string & {});
  message?: string;
  partner_name: string | false;
  lines: {
    id: number;
    name: string;
    product_template_id: number | false;
    product_uom_qty: number;
    price_unit: number;
    price_subtotal: number;
    price_total: number;
    is_extended_warranty: boolean;
  }[];
};

// Fixed 2026-10-02, frontend sweep: money/date used to be hardcoded to the live website's own
// one-format-for-everyone convention (MM/DD/YYYY, plain comma grouping) regardless of the app's
// selected language — confirmed with Mariam this should NOT match the website; now locale-aware
// (src/utils/locale-format.ts). Currency contract (₪ for ILS, code suffix otherwise) unchanged.
const formatMoney = formatMoneyLocale;

/** Plain locale-grouped quantity/unit-price number (no currency symbol). */
function formatNumber(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatNumberLocale(amount)}`;
}

/** Local date/time, in the current language's own convention (was hardcoded MM/DD/YYYY, HH:MM:SS). */
function formatDateTime(value: string | false): { date: string; time: string } {
  if (!value) {
    return { date: '', time: '' };
  }
  return { date: formatDateLocale(value), time: formatTimeLocale(value, true) };
}

function mapSummary(order: OrderSummaryJson): OrderSummary {
  const { date, time } = formatDateTime(order.date_order);
  return {
    id: order.id,
    name: order.name,
    dateFormatted: date,
    timeFormatted: time,
    totalFormatted: formatMoney(order.amount_total, order.currency),
    // Not in the contract: no "Return" button on real orders until the backend says so (#005).
    returnAvailable: false,
    firstProductImageUrl: null,
  };
}

function mapDetail(order: OrderJsonResponse): OrderDetail {
  return {
    ...mapSummary(order),
    status: null,
    seller: null,
    contact: { name: order.partner_name || '', addressLines: [], phone: '', email: '' },
    lines: order.lines.map((line) => ({
      id: line.id,
      name: line.name,
      isDelivery: false,
      quantityFormatted: formatNumber(line.product_uom_qty),
      priceUnitFormatted: formatNumber(line.price_unit),
      sku: null,
      productTemplateId: line.product_template_id || null,
      taxesLabel: null,
      // price_total (tax included): no tax rows are shown, so the lines add up to the Total.
      amountFormatted: formatMoney(line.price_total, order.currency),
    })),
    totals: {
      untaxedFormatted: null,
      taxGroups: [],
      totalFormatted: formatMoney(order.amount_total, order.currency),
    },
    paymentStatus: null,
    paymentTermsLabel: null,
    invoices: [],
    deliveries: [],
    termsUrl: null,
    returns: null,
  };
}

/**
 * REAL (untested end-to-end, see top of file): one page of the customer's orders, newest first.
 * The page size is the backend's (not in the contract); `hasNext` comes from its page_count.
 */
export async function fetchOrders(page = 1): Promise<OrdersResult> {
  let data: OrdersJsonResponse;
  try {
    data = await odooJsonRpc<OrdersJsonResponse>('/my/orders/json', { page });
  } catch (error) {
    // A non-JSON reply (SyntaxError) is the 404 HTML page of a server without the route.
    if (error instanceof SyntaxError) {
      return {
        ok: true,
        orders: mockOrderList().map(withImageUrl),
        isSampleData: true,
        hasNext: false,
        nextPage: 1,
      };
    }
    return { ok: false, message: errorMessage(error) };
  }
  if (data?.status !== 'success' || !Array.isArray(data.orders)) {
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  const currentPage = typeof data.page === 'number' ? data.page : page;
  return {
    ok: true,
    orders: data.orders.map(mapSummary),
    isSampleData: false,
    hasNext: typeof data.page_count === 'number' && currentPage < data.page_count,
    nextPage: currentPage + 1,
  };
}

/** REAL (untested end-to-end, see top of file). */
export async function fetchOrder(id: number): Promise<OrderResult> {
  let data: OrderJsonResponse;
  try {
    data = await odooJsonRpc<OrderJsonResponse>(`/my/orders/${id}/json`, {});
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Sample detail only exists for the sample list's ids; `order` is null otherwise.
      const order = mockOrderDetail(id);
      return { ok: true, order: order && withImageUrl(order), isSampleData: true };
    }
    return { ok: false, message: errorMessage(error) };
  }
  if (data?.status !== 'success' || !Array.isArray(data.lines)) {
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  return { ok: true, order: mapDetail(data), isSampleData: false };
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
  /**
   * Added 2026-10-02 ("photo upload on product reviews"): data-URL strings for whatever photos
   * are already saved on this review (never more than 3). Empty when there's no review yet or
   * it has no photos. NOT part of the live site's popup — added for the app only.
   */
  existingImages: string[];
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
    existing_images?: string[];
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
        existingImages: isUpdate ? (product.existing_images ?? []) : [],
      },
    };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

/**
 * Creates the review, or updates the customer's existing one for this order's product.
 * `images` (added 2026-10-02, optional, up to 3 data-URL strings) always replaces whatever
 * photos the review already had — same resubmit behavior as rating/comment.
 */
export async function submitReview(review: {
  orderId: number;
  productId: number;
  rating: number;
  comment: string;
  images?: string[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const data = await odooJsonRpc<ReviewResponse>('/my/orders/review/submit', {
      order_id: review.orderId,
      product_id: review.productId,
      rating: review.rating,
      comment: review.comment, // Always sent ('' when left blank): the route requires it.
      images: review.images ?? [],
    });
    return data?.status === 'success'
      ? { ok: true }
      : { ok: false, message: data?.message || REVIEW_FAILED_MESSAGE };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}
