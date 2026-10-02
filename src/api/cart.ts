import { NETWORK_ERROR_MESSAGE } from './messages';
import { mockAddProduct, mockCartSummary, type MockProduct } from './mocks/cart-summary.mock';
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

/*
 * FIXED 2026-10-02 (session 3, tracker #1) — real cart contents, PARTIAL fix (honestly scoped).
 *
 * /shop/cart/json (new, yallashuq_seller/controllers/main.py) returns real product lines grouped
 * by each product's real seller, and the order's real totals (amount_untaxed/tax/total — exactly
 * what Odoo itself computed, not recalculated here).
 *
 * Deliberately NOT real: per-seller delivery amounts. Investigated first — the backend route that
 * should compute the "free threshold → Super Admin rule → seller's own charge" hierarchy
 * (/api/delivery/rate, yallashuq_delivery_hub) is a hardcoded stub that always returns 50, not
 * real logic. No real per-seller delivery calculation exists anywhere in the backend to read.
 * Rather than guess at that allocation — which would mean inventing money-affecting logic — each
 * seller group's `delivery.calculated` is `false` (a case this type already had a field for) and
 * `delivery.amountFormatted` is shown as "—" by the Cart screen instead of a fabricated number.
 * `totals.deliveryFormatted` uses the order's real, unallocated delivery total when one exists.
 */

type CartJsonLine = {
  line_id: number;
  product_id: number | false;
  product_template_id: number | false;
  name: string;
  image: string | false;
  quantity: number;
  price_unit: number;
  price_subtotal: number;
  price_total: number;
};

type CartJsonSellerGroup = {
  seller: { id: number; name: string; is_marketplace: boolean };
  lines: CartJsonLine[];
  subtotal: number;
  delivery: { calculated: false };
};

type CartJsonResponse = {
  status: 'success' | (string & {});
  message?: string;
  order_id: number | false;
  cart_quantity: number;
  sellers: CartJsonSellerGroup[];
  delivery_total: number;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  currency_symbol: string;
  currency_position: 'before' | 'after';
  warnings: string[];
};

/** Same formatting as the live site's own card script (catalog.ts's formatAmount). */
function formatAmount(symbol: string, position: 'before' | 'after', amount: number): string {
  const value = Number(amount || 0).toFixed(2);
  return position === 'after' ? `${value}${symbol}` : `${symbol}${value}`;
}

export async function fetchCartSummary(): Promise<CartSummaryResult> {
  let data: CartJsonResponse;
  try {
    data = await odooJsonRpc<CartJsonResponse>('/shop/cart/json', {});
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
  if (data?.status !== 'success') {
    return { ok: false, message: data?.message || NETWORK_ERROR_MESSAGE };
  }

  const money = (amount: number) => formatAmount(data.currency_symbol, data.currency_position, amount);

  const sellerGroups: CartSellerGroup[] = data.sellers.map((group) => ({
    seller: {
      id: group.seller.id,
      name: group.seller.name,
      legalName: group.seller.name,
      isMarketplace: group.seller.is_marketplace,
    },
    lines: group.lines.map((line) => ({
      lineId: line.line_id,
      productId: line.product_id || 0,
      productTemplateId: line.product_template_id || 0,
      name: line.name,
      variantDescription: '',
      imageUrl: line.image || '',
      quantity: line.quantity,
      maxQuantity: null,
      priceUnitFormatted: money(line.price_unit),
      priceTotalFormatted: money(line.price_total),
      warning: '',
    })),
    subtotalFormatted: money(group.subtotal),
    delivery: {
      calculated: false,
      // Not shown by the app as a number — see the header comment on why this isn't computed.
      amountFormatted: '',
      isFree: false,
      freeThresholdFormatted: null,
      remainingForFreeFormatted: null,
    },
  }));

  return {
    ok: true,
    isSampleData: false,
    cart: {
      orderId: data.order_id || null,
      cartQuantity: data.cart_quantity,
      sellerGroups,
      totals: {
        subtotalFormatted: money(data.amount_untaxed),
        deliveryFormatted: money(data.delivery_total),
        taxFormatted: money(data.amount_tax),
        discountFormatted: null,
        totalFormatted: money(data.amount_total),
      },
      warnings: data.warnings ?? [],
    },
  };
}

/**
 * Changes a line's quantity; 0 removes the line.
 *
 * FIXED 2026-10-02 (session 3, tracker #1): calls the real route the live site's own cart page
 * uses (website_sale) — set_qty replaces the line's quantity outright (0 removes the line).
 */
export async function setCartLineQuantity(
  line: Pick<CartLine, 'lineId' | 'productId'>,
  quantity: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await odooJsonRpc<{ cart_quantity?: number } | null>('/shop/cart/update_json', {
      line_id: line.lineId,
      product_id: line.productId,
      set_qty: quantity,
      display: false,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}
