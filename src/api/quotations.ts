import { fetchPortalCounter, type CounterResult } from './counters';

/*
 * ---------------------------------------------------------------------------------------------
 * Quotations (the live /my/quotes page).
 *
 * REAL, BUT COUNT ONLY: /my/counters returns the signed-in customer's `quotation_count` as JSON
 * (checked on staging 2026-09-27: {"quotation_count": 0}, matching the page's "There are
 * currently no quotations for your account."). The quotations themselves are only in the
 * server-rendered /my/quotes page — no JSON route returns them (JSON call to /my/quotes → 400;
 * /my/quotes_json, /my/quotations, /api/quotes, /api/quotations → 404). Requested in
 * docs/backend-requests/011-quotations-list-json.md.
 * ---------------------------------------------------------------------------------------------
 */

export type QuotationCountResult = CounterResult;

export function fetchQuotationCount(): Promise<QuotationCountResult> {
  return fetchPortalCounter('quotation_count');
}
