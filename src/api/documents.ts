import { getCookieHeader } from './cookie-jar';
import { mockMarketplaceDocuments } from './mocks/documents.mock';
import { odooUrl } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * Marketplace documents (the live /my/marketplace/documents page).
 *
 * ⚠️ BLOCKED ON BACKEND — THE LIST IS TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * No route returns the document list as JSON: the page is server-rendered HTML only, JSON calls
 * to it are rejected and /my/counters has no document count (checked on staging 2026-09-27).
 * Requested in docs/backend-requests/007-marketplace-documents-json.md. Until it ships,
 * fetchMarketplaceDocuments returns SAMPLE DATA (src/api/mocks/documents.mock.ts).
 *
 * Opening a document IS real: /my/marketplace/document/<id> is the existing route the website's
 * "View / Download" button uses (a PDF, shown inline), requested with the signed-in session.
 * ---------------------------------------------------------------------------------------------
 */

export type MarketplaceDocumentType = {
  /** e.g. "ORDER_CONFIRMATION", "SUPPLIER_RECEIPT" (staging shows these codes as-is). */
  code: string;
  /** Readable label, e.g. "Order Confirmation" — asked for in #007 (staging has none). */
  label: string;
};

export type MarketplaceDocument = {
  id: number;
  /** Order reference, e.g. "S00073". */
  orderName: string;
  type: MarketplaceDocumentType;
  /** As the website shows it, e.g. "09/16/2026". */
  dateFormatted: string;
};

export type MarketplaceDocumentsResult =
  | { ok: true; documents: MarketplaceDocument[]; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * TEMPORARY: returns the mock list (isSampleData: true).
 * TODO: replace with the list route from docs/backend-requests/007-marketplace-documents-json.md.
 */
export async function fetchMarketplaceDocuments(): Promise<MarketplaceDocumentsResult> {
  return { ok: true, documents: mockMarketplaceDocuments(), isSampleData: true };
}

/**
 * What an in-app browser needs to open a document like the website's "View / Download" does:
 * the document URL plus the signed-in session's Cookie header (the route needs sign-in).
 */
export async function marketplaceDocumentRequest(
  id: number
): Promise<{ uri: string; headers: Record<string, string> }> {
  const uri = odooUrl(`/my/marketplace/document/${id}`);
  const cookie = await getCookieHeader(uri);
  return { uri, headers: cookie ? { Cookie: cookie } : {} };
}
