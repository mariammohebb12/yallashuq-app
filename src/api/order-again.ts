import type { ProductSummary } from '@/components/product-card';

import { findCatalogProduct } from './catalog';
import { NETWORK_ERROR_MESSAGE } from './messages';
import { fetchOrder, fetchOrders } from './orders';

/*
 * Home's "Order Again": the products the signed-in customer has bought before.
 *
 * Fixed 2026-10-02 (tracker #29, docs/backend-requests/025-order-lines-need-product-id.md):
 * now uses the real /my/orders/json + /my/orders/<id>/json routes (orders.ts) and each line's
 * product_template_id, straight from the backend — no more HTML-scraping or name-matching.
 * This was previously rejected (kept the scraping fallback) specifically because the orders API
 * didn't return a product id on each line; now that it does (added alongside this fix, same
 * backend PR), the old guess-by-name approach is no longer needed.
 *
 * Still one request per order for the line-level product ids (the list route only has
 * `line_count`, not the lines themselves) — same N+1 shape as before, just against the real
 * JSON API instead of scraping order pages' HTML.
 */

const MAX_ORDERS = 20;
const MAX_PRODUCTS = 10;

export type OrderAgainResult =
  | { ok: true; products: ProductSummary[] } // [] = signed out, nothing bought yet, or sample data
  | { ok: false; message: string };

export async function fetchPreviouslyBought(): Promise<OrderAgainResult> {
  try {
    const list = await fetchOrders(1);
    if (!list.ok) {
      return list;
    }
    if (list.isSampleData) {
      // Sample data has no real order ids to look up product lines for — nothing to show here
      // rather than guessing at fake products on top of already-fake orders.
      return { ok: true, products: [] };
    }

    const orderIds = list.orders.slice(0, MAX_ORDERS).map((order) => order.id);
    const details = await Promise.all(orderIds.map((id) => fetchOrder(id)));

    const templateIds: number[] = [];
    for (const detail of details) {
      if (!detail.ok || !detail.order) {
        continue;
      }
      for (const line of detail.order.lines) {
        if (line.productTemplateId && !templateIds.includes(line.productTemplateId)) {
          templateIds.push(line.productTemplateId);
        }
      }
    }
    const limitedIds = templateIds.slice(0, MAX_PRODUCTS);

    // One at a time: the first lookup loads the catalog pages, the rest are then cached.
    const products: ProductSummary[] = [];
    for (const templateId of limitedIds) {
      const result = await findCatalogProduct(templateId);
      if (!result.ok) {
        return result;
      }
      if (result.found) {
        products.push(result.found.product);
      }
    }
    return { ok: true, products };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}
