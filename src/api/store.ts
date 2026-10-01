import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { odooJsonRpc, odooUrl } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * Seller storefront header: POST (JSON-RPC) /store/<seller_id>/json — public, no sign-in.
 *
 * REAL CONTRACT (as relayed by the user, 2026-10-01), checked on production 2026-10-01 logged out:
 * - approved seller → {status: 'success', id, name, image, product_count}
 *   e.g. 73 → {"id": 73, "name": "John Doe", "image": "/web/static/img/placeholder.png",
 *   "product_count": 2}
 * - otherwise → {status: 'error', message: 'Seller not found'} (ids 1–72 and 74–80 on production)
 * - type='json': a GET is rejected (400). Not on staging (404, 2026-10-01).
 * Scope (client-confirmed): name + logo (+ product count) only — no other seller fields exist.
 * The store's products come from /shop/products/json with `seller` (fetchShopProducts).
 *
 * No sample data: where the route isn't deployed (a non-JSON reply, i.e. staging's 404 page) the
 * screen says the store isn't available, rather than showing a made-up seller.
 * ---------------------------------------------------------------------------------------------
 */

export type Store = {
  id: number;
  name: string;
  /** Full URL; null when the backend sends none. */
  imageUrl: string | null;
  productCount: number;
};

export type StoreResult =
  | { ok: true; store: Store }
  /** `notDeployed`: the route doesn't exist on this server (staging). */
  | { ok: false; message: string; notDeployed?: boolean };

/** Odoo sends `false` for empty fields. */
type StoreJsonResponse = {
  status: 'success' | 'error' | (string & {});
  message?: string;
  id: number;
  name: string;
  image: string | false;
  product_count: number;
};

export async function fetchStore(sellerId: number): Promise<StoreResult> {
  let data: StoreJsonResponse;
  try {
    data = await odooJsonRpc<StoreJsonResponse>(`/store/${sellerId}/json`, {});
  } catch (error) {
    // A non-JSON reply (SyntaxError) is the 404 HTML page of a server without the route.
    if (error instanceof SyntaxError) {
      return { ok: false, message: UNEXPECTED_RESPONSE_MESSAGE, notDeployed: true };
    }
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
  if (data?.status !== 'success') {
    // e.g. "Seller not found" — the backend's own message.
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  return {
    ok: true,
    store: {
      id: data.id,
      name: data.name || '',
      imageUrl: data.image ? odooUrl(data.image) : null,
      productCount: typeof data.product_count === 'number' ? data.product_count : 0,
    },
  };
}
