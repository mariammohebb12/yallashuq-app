import { NETWORK_ERROR_MESSAGE } from './messages';
import {
  mockAddProduct,
  mockCartSummary,
  mockSetQuantity,
  type MockProduct,
} from './mocks/cart-summary.mock';
import { odooJsonRpc } from './odoo-client';

/*
 * Cart against Odoo website_sale's JSON-RPC routes, called exactly like the live site's own
 * "add to cart without leaving the page" script (website_sale, web.assets_frontend_lazy):
 *   rpc("/shop/cart/update_json", {product_id, add_qty: 1, display: false})
 * The cart lives server-side in the Odoo session (odooRequest's cookie jar keeps it), so a guest
 * cart is the same session cart the backend later attaches on sign-in. Nothing is calculated here.
 */

export type AddToCartResult =
  | { ok: true; cartQuantity: number }
  | { ok: false; message: string };

/** What "Add to Cart" needs about a product. */
export type CartProduct = MockProduct;

/**
 * Adds to the real Odoo session cart. `variantId` is the product.product id (the live form's
 * hidden `product_id`), NOT the product.template id used in product URLs — template 50 → 63.
 *
 * TEMPORARY: on success the product is also added to the mock cart, and `cartQuantity` is the
 * MOCK cart's count, so the badge matches what the (mock) Cart screen shows.
 * TODO: once the cart-contents route exists, drop the mock and return the backend's
 * cart_quantity again (docs/backend-requests/001-cart-summary-json.md).
 */
export async function addToCart(product: CartProduct, quantity = 1): Promise<AddToCartResult> {
  try {
    await odooJsonRpc<{ cart_quantity?: number } | null>('/shop/cart/update_json', {
      product_id: product.variantId,
      add_qty: quantity,
      display: false,
    });
    mockAddProduct(product, quantity);
    return { ok: true, cartQuantity: mockCartSummary().cartQuantity };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}

/*
 * ---------------------------------------------------------------------------------------------
 * Cart contents.
 *
 * ⚠️ BLOCKED ON BACKEND — NOT READY TO GO LIVE ⚠️
 * No existing route returns the cart's lines as JSON (update_json only returns counts/totals;
 * /shop/cart is HTML). Requested in docs/backend-requests/001-cart-summary-json.md.
 * Until that route exists, fetchCartSummary returns TEMPORARY SAMPLE DATA so the Cart screen's
 * layout can be built. The types below follow the requested response (camelCased, and only the
 * fields the screen uses; amounts are the backend's formatted strings).
 * ---------------------------------------------------------------------------------------------
 */

export type CartLine = {
  lineId: number;
  /** product.product id. */
  productId: number;
  /** product.template id (product route). */
  productTemplateId: number;
  name: string;
  variantDescription: string;
  imageUrl: string;
  quantity: number;
  /** null = no limit. */
  maxQuantity: number | null;
  priceUnitFormatted: string;
  /** Line total incl. tax. */
  priceTotalFormatted: string;
  warning: string;
};

export type CartDelivery = {
  /** false until a delivery address/method is known. */
  calculated: boolean;
  amountFormatted: string;
  isFree: boolean;
  /** null when this seller has no free-delivery threshold. */
  freeThresholdFormatted: string | null;
  remainingForFreeFormatted: string | null;
};

export type CartSellerGroup = {
  seller: { id: number; name: string; legalName: string; isMarketplace: boolean };
  lines: CartLine[];
  subtotalFormatted: string;
  delivery: CartDelivery;
};

export type CartSummary = {
  orderId: number | null;
  cartQuantity: number;
  sellerGroups: CartSellerGroup[];
  totals: {
    subtotalFormatted: string;
    deliveryFormatted: string;
    taxFormatted: string;
    /** null when no discount applies (the route's `discount` is 0). */
    discountFormatted: string | null;
    totalFormatted: string;
  };
  warnings: string[];
};

export type CartSummaryResult =
  | { ok: true; cart: CartSummary; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * TEMPORARY: returns the mock cart (isSampleData: true).
 * TODO: replace with the real cart-contents route response once the backend endpoint exists
 * (e.g. odooJsonRpc('/shop/cart/summary_json', {}) mapped into CartSummary) — see
 * docs/backend-requests/001-cart-summary-json.md.
 */
export async function fetchCartSummary(): Promise<CartSummaryResult> {
  return { ok: true, cart: mockCartSummary(), isSampleData: true };
}

/**
 * Changes a line's quantity; 0 removes the line.
 *
 * TEMPORARY: only changes the mock cart.
 * TODO: call the existing route the website's cart page uses —
 * odooJsonRpc('/shop/cart/update_json', {line_id, product_id, set_qty, display: false}) — once
 * lines come from the backend (mock line ids don't exist server-side).
 */
export async function setCartLineQuantity(
  line: Pick<CartLine, 'lineId' | 'productId'>,
  quantity: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  mockSetQuantity(line.lineId, quantity);
  return { ok: true };
}
