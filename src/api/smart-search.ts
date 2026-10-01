import { NETWORK_ERROR_MESSAGE } from './messages';
import { odooJsonRpc } from './odoo-client';
import { productImageUrl } from './product-image-overrides';

/*
 * Smart Search: the live /inventory/search page's search route (custom addon
 * `odoo_inventory_engine`).
 *
 * REAL: JSON-RPC /inventory/search/query {query} (public, works for guests). Checked on live and
 * staging 2026-09-28:
 * - match → {status: "success", results: [{id, name, price, currency, qty, seller, seller_company,
 *   category, tags, warranty, ref, score, coverage, url, image, is_out_of_stock, rating}]}
 * - no match → {status: "no_match", message: "No results found"}
 * It behaves like keyword matching, not natural-language/AI search ("tv" finds Smart Tv,
 * "television" finds nothing) — so the app never calls it "AI".
 * Results come back in the backend's order (it sorts by score); nothing is re-ranked here.
 */

const SEARCH_PATH = '/inventory/search/query';

export type RawSmartSearchResult = {
  id: number;
  name: string;
  price: number;
  currency: string;
  qty: number;
  seller?: string | false;
  category?: string | false;
  score?: number;
  url?: string;
  image?: string;
};

export type SmartSearchResult = {
  /** product.template id (opens the product screen). */
  id: number;
  name: string;
  /** Formatted like the live card: "₪3,000"; undefined when the price is 0 ("Upon Request"). */
  priceLabel?: string;
  /** Seller name; undefined when the backend gives none. */
  seller?: string;
  category?: string;
  inStock: boolean;
  /** Backend relevance score (not shown — the live card doesn't show it either). */
  score: number;
  /** The backend's link, e.g. "/shop/product/54" (kept for reference; the app opens by id). */
  url?: string;
  imageUrl?: string;
};

export type SmartSearchResponse =
  | { ok: true; results: SmartSearchResult[] }
  | { ok: false; message: string };

export async function smartSearch(query: string): Promise<SmartSearchResponse> {
  try {
    const data = await odooJsonRpc<{
      status?: string;
      results?: RawSmartSearchResult[];
      message?: string;
    }>(SEARCH_PATH, { query });
    if (data?.status === 'success') {
      return { ok: true, results: (data.results ?? []).map(toSmartSearchResult) };
    }
    if (data?.status === 'no_match') {
      return { ok: true, results: [] };
    }
    return { ok: false, message: data?.message || NETWORK_ERROR_MESSAGE };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}

/** Also used by the MishMesh chat (/inventory_engine/chat returns the same rows). */
export function toSmartSearchResult(raw: RawSmartSearchResult): SmartSearchResult {
  return {
    id: raw.id,
    name: raw.name,
    // Same as the live card: `${currency}${price.toLocaleString()}`, and "Upon Request" at 0.
    priceLabel: raw.price > 0 ? `${raw.currency}${raw.price.toLocaleString('en-US')}` : undefined,
    seller: raw.seller || undefined,
    category: raw.category || undefined,
    inStock: raw.qty > 0,
    score: raw.score ?? 0,
    url: raw.url,
    imageUrl: raw.image ? productImageUrl(raw.image) : undefined,
  };
}
