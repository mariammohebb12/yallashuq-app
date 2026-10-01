import type { ProductSummary } from '@/components/product-card';

import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { odooJsonRpc, odooRequest } from './odoo-client';
import { productImageUrl } from './product-image-overrides';

/*
 * Product catalog from GET /home/catalog/more?hp_page=N — the JSON route the live homepage's
 * "Load more" script uses (it returns {page, has_next, next_page, cards}).
 *
 * NOT IN CLAUDE.md's CONFIRMED ROUTE LIST: it exists and works on staging and live, and its use
 * was approved for Home + Shop (2026-09-25), but it isn't part of the Technical Handover's list.
 *
 * KNOWN LIMITATIONS (verified on staging): it IGNORES every filter — search, sort, seller,
 * free_shipping, warranty_eligible and category all return the same list — and cards carry no
 * seller id. Filtering/sorting therefore isn't possible from the app yet (the /shop HTML page is
 * the only place that filters). Requested in docs/backend-requests/002-catalog-filters-json.md.
 *
 * Display rules below mirror the live site's own card script (cardTemplate on the homepage):
 * price = currency symbol + amount to 2 decimals, seller = seller_company || seller_name,
 * rating row only when rating_count > 0, discount (backend `discount_pct`, truncated) when
 * discounted — shown by the app as "-N%" next to the price, not a badge — free-shipping hint when
 * free_shipping_min_qty > 0.
 */

type CatalogCard = {
  id: number;
  variant_id: number;
  name: string;
  price: number;
  original_price: number;
  has_discount: boolean;
  discount_pct: number;
  url: string;
  image: string;
  rating_avg: number;
  rating_count: number;
  warranty_eligible: boolean;
  warranty_tags: (string | { name: string })[];
  free_shipping: boolean;
  ribbon: unknown;
  seller_name: string;
  seller_company: string;
  free_shipping_min_qty: number;
  free_shipping_remaining_qty: number;
  currency_symbol: string;
  currency_position: 'before' | 'after';
};

type CatalogResponse = {
  page: number;
  has_next: boolean;
  next_page: number;
  cards: CatalogCard[];
};

export type CatalogPage = {
  products: ProductSummary[];
  hasNext: boolean;
  nextPage: number;
};

export type CatalogResult = ({ ok: true } & CatalogPage) | { ok: false; message: string };

export async function fetchCatalogPage(page: number): Promise<CatalogResult> {
  let data: CatalogResponse;
  try {
    const response = await odooRequest(`/home/catalog/more?hp_page=${page}`);
    if (response.status !== 200) {
      return { ok: false, message: UNEXPECTED_RESPONSE_MESSAGE };
    }
    data = JSON.parse(await response.text()) as CatalogResponse;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof SyntaxError ? UNEXPECTED_RESPONSE_MESSAGE : NETWORK_ERROR_MESSAGE,
    };
  }
  for (const card of data.cards ?? []) {
    cardCache.set(card.id, card);
  }
  return {
    ok: true,
    products: (data.cards ?? []).map(toProductSummary),
    hasNext: data.has_next,
    nextPage: data.next_page,
  };
}

/*
 * Shop's filtered + sorted catalog: POST (JSON-RPC) /shop/products/json, from
 * yallashuq_seller/controllers/main.py (as relayed by the user, 2026-10-01). Public (no sign-in).
 * Checked on production 2026-10-01 (logged out):
 * - It is type='json': a GET with a query string is rejected (400). Params go in the JSON-RPC body.
 * - Params: page, category (0 = all), search, sort, seller (0 = all), free_shipping,
 *   warranty_eligible. The two flags MUST be real booleans: the string "false" counts as true.
 * - Response: {status, page, page_count, total_count, has_next, next_page, filters, cards}. The
 *   cards are the same shape as /home/catalog/more's (same keys and types, compared 2026-10-01).
 * - Sort: exactly popular (default), price_low, newest. No price-range filter exists (on purpose).
 * - A category id that doesn't exist fails with an "Odoo Server Error" (MissingError); the app only
 *   sends ids from Home / Categories (#027).
 * - `seller` (the /store/<id>/json seller id) filters to one seller. A seller id the backend
 *   doesn't accept is SILENTLY IGNORED (echoed back as `filters.seller: 0`, all products
 *   returned — seen with 72, 2026-10-01), so a seller request whose echo doesn't match is treated
 *   as an error here, never shown as that seller's products.
 * - Not on staging (404, 2026-10-01). There fetchShopProducts falls back to the unfiltered
 *   /home/catalog/more and reports filtersAvailable: false, so Shop shows its controls as
 *   "Coming soon" instead of pretending to filter.
 */
export type ShopSort = 'popular' | 'price_low' | 'newest';

export type ShopQuery = {
  page?: number;
  /** product.public.category id; 0 / omitted = all. */
  category?: number;
  /** Seller id as /store/<id>/json uses it; 0 / omitted = all sellers. */
  seller?: number;
  sort?: ShopSort;
  freeShipping?: boolean;
  warrantyEligible?: boolean;
};

export type ShopResult =
  | ({
      ok: true;
      /** false = the route isn't deployed here: unfiltered catalog, controls not applied. */
      filtersAvailable: boolean;
      /** Backend's total for these filters; null when unknown (fallback route). */
      totalCount: number | null;
    } & CatalogPage)
  | { ok: false; message: string };

type ShopProductsResponse = CatalogResponse & {
  status: 'success' | (string & {});
  message?: string;
  page_count: number;
  total_count: number;
  /** The filters the backend actually applied. */
  filters?: { seller?: number };
};

export async function fetchShopProducts({
  page = 1,
  category = 0,
  seller = 0,
  sort = 'popular',
  freeShipping = false,
  warrantyEligible = false,
}: ShopQuery = {}): Promise<ShopResult> {
  let data: ShopProductsResponse;
  try {
    data = await odooJsonRpc<ShopProductsResponse>('/shop/products/json', {
      page,
      category,
      search: '',
      sort,
      seller,
      free_shipping: freeShipping,
      warranty_eligible: warrantyEligible,
    });
  } catch (error) {
    // A non-JSON reply (SyntaxError) is the 404 HTML page of a server without the route.
    if (error instanceof SyntaxError) {
      if (__DEV__) {
        console.log('[shop] /shop/products/json not deployed on this server — unfiltered catalog');
      }
      const fallback = await fetchCatalogPage(page);
      return fallback.ok ? { ...fallback, filtersAvailable: false, totalCount: null } : fallback;
    }
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
  if (data?.status !== 'success' || !Array.isArray(data.cards)) {
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  // The backend drops a seller it doesn't accept and returns everything (see above).
  if (seller > 0 && data.filters?.seller !== seller) {
    return { ok: false, message: UNEXPECTED_RESPONSE_MESSAGE };
  }
  for (const card of data.cards) {
    cardCache.set(card.id, card);
  }
  return {
    ok: true,
    filtersAvailable: true,
    totalCount: typeof data.total_count === 'number' ? data.total_count : null,
    products: data.cards.map(toProductSummary),
    hasNext: data.has_next,
    nextPage: data.next_page,
  };
}

// Cards seen so far, by product.template id, so Product detail can show a product Home/Shop just
// listed without reloading the catalog.
const cardCache = new Map<number, CatalogCard>();

// The catalog route has no "get one product" option, so a product not seen yet is looked for page
// by page (the catalog is small today). Capped so a missing product can't page forever.
const MAX_LOOKUP_PAGES = 20;

export type CatalogProduct = {
  product: ProductSummary;
  /** Formats an amount like the product's cards do (e.g. the combination-info price). */
  formatPrice: (amount: number) => string;
  /** Larger image for the detail screen (image_1024 instead of the cards' image_512). */
  largeImageUrl?: string;
};

export type CatalogProductResult =
  | { ok: true; found: CatalogProduct | null }
  | { ok: false; message: string };

/** Finds a product (by product.template id) in the catalog; `found: null` if it isn't listed. */
export async function findCatalogProduct(templateId: number): Promise<CatalogProductResult> {
  let card = cardCache.get(templateId);
  for (let page = 1; !card && page <= MAX_LOOKUP_PAGES; ) {
    const result = await fetchCatalogPage(page);
    if (!result.ok) {
      return result;
    }
    card = cardCache.get(templateId);
    if (!result.hasNext) {
      break;
    }
    page = result.nextPage > page ? result.nextPage : page + 1;
  }
  if (!card) {
    return { ok: true, found: null };
  }
  const found = card;
  return {
    ok: true,
    found: {
      product: toProductSummary(found),
      formatPrice: (amount) => formatAmount(found, amount),
      largeImageUrl: found.image
        ? productImageUrl(found.image.replace(/image_512$/, 'image_1024'))
        : undefined,
    },
  };
}

/*
 * Availability/price for one product variant: POST /website_sale/get_combination_info
 * (standard Odoo 18 website_sale JSON-RPC, what the live product page calls). NOT IN CLAUDE.md's
 * CONFIRMED ROUTE LIST — approved for Product detail (2026-09-25). `product_id` (the variant) is
 * required: without it the route fails with a server error.
 */
export type CombinationInfo = {
  isCombinationPossible: boolean;
  preventZeroPriceSale: boolean;
  price: number;
  listPrice: number;
  hasDiscountedPrice: boolean;
  isStorable: boolean;
  allowOutOfStockOrder: boolean;
  freeQty: number;
  cartQty: number;
  /** Seller's custom out-of-stock text (HTML stripped); '' when none. */
  outOfStockMessage: string;
};

type CombinationInfoResponse = {
  is_combination_possible?: boolean;
  prevent_zero_price_sale?: boolean;
  price: number;
  list_price: number;
  has_discounted_price?: boolean;
  is_storable?: boolean;
  allow_out_of_stock_order?: boolean;
  free_qty?: number;
  cart_qty?: number;
  out_of_stock_message?: string | false;
};

export async function fetchCombinationInfo(
  templateId: number,
  variantId: number
): Promise<{ ok: true; info: CombinationInfo } | { ok: false; message: string }> {
  try {
    const r = await odooJsonRpc<CombinationInfoResponse>('/website_sale/get_combination_info', {
      product_template_id: templateId,
      product_id: variantId,
      combination: [],
      add_qty: 1,
      parent_combination: [],
    });
    return {
      ok: true,
      info: {
        // The live page treats a missing flag as "possible".
        isCombinationPossible: r.is_combination_possible !== false,
        preventZeroPriceSale: r.prevent_zero_price_sale === true,
        price: r.price,
        listPrice: r.list_price,
        hasDiscountedPrice: r.has_discounted_price === true,
        isStorable: r.is_storable === true,
        allowOutOfStockOrder: r.allow_out_of_stock_order !== false,
        freeQty: r.free_qty ?? 0,
        cartQty: r.cart_qty ?? 0,
        outOfStockMessage: r.out_of_stock_message
          ? r.out_of_stock_message.replace(/<[^>]+>/g, '').trim()
          : '',
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}

/** Same formatting as the live card script's formatAmount. */
function formatAmount(card: CatalogCard, amount: number): string {
  const value = Number(amount || 0).toFixed(2);
  return card.currency_position === 'after'
    ? `${value}${card.currency_symbol}`
    : `${card.currency_symbol}${value}`;
}

/**
 * Gives products the section's badge (live: "Hot Sale" in Flash Deals, "Top Deal" elsewhere).
 * Discounts aren't a badge in the app: the card shows them as "-N%" next to the price.
 */
export function withSectionTag(products: ProductSummary[], tag: string): ProductSummary[] {
  return products.map((product) => ({ ...product, tag }));
}

function toProductSummary(card: CatalogCard): ProductSummary {
  const chips: string[] = [];
  if (card.free_shipping) {
    chips.push('Free Shipping');
  }
  if (card.warranty_eligible) {
    chips.push('Warranty');
  }
  for (const warrantyTag of (card.warranty_tags ?? []).slice(0, 2)) {
    chips.push(typeof warrantyTag === 'object' ? warrantyTag.name : warrantyTag);
  }

  let freeShippingHint: ProductSummary['freeShippingHint'];
  if (card.free_shipping_min_qty > 0) {
    freeShippingHint =
      card.free_shipping_remaining_qty > 0
        ? {
            unlocked: false,
            text: `Add ${card.free_shipping_remaining_qty} more item(s) from this seller for free shipping.`,
            // No confirmed short copy yet: the card shows the full text, cut to one line.
          }
        : {
            unlocked: true,
            text: 'Free shipping unlocked for this seller.',
            // Client's wording (2026-09-28) for the card's one-line pill.
            shortText: 'Free shipping unlocked',
          };
  }

  return {
    id: card.id,
    variantId: card.variant_id,
    name: card.name,
    sellerName: card.seller_company || card.seller_name,
    priceLabel: formatAmount(card, card.price),
    originalPriceLabel: card.has_discount ? formatAmount(card, card.original_price) : undefined,
    rating: card.rating_avg,
    ratingCount: card.rating_count,
    discountPct: card.has_discount ? Math.trunc(card.discount_pct) : undefined,
    imageUrl: card.image ? productImageUrl(card.image) : undefined,
    chips,
    freeShippingHint,
  };
}
