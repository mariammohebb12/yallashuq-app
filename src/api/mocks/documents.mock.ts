import type { MarketplaceDocument } from '../documents';

/*
 * ⚠️ TEMPORARY MOCK DOCUMENT LIST — NOT REAL, DO NOT SHIP ⚠️
 * TODO: replace with the list route from docs/backend-requests/007-marketplace-documents-json.md,
 * then delete this file.
 *
 * The staging test customer's real /my/marketplace/documents rows (checked 2026-09-27), in the
 * same order, with their real ids, orders, types and dates — 23 of the 25: two rows are left out
 * on purpose because their files are wrong (reported separately). The ids are real, so "View /
 * Download" opens the real PDF when the app is signed in as that test customer.
 * The readable type labels are the app's (staging shows only the codes).
 */

const CONFIRMATION = { code: 'ORDER_CONFIRMATION', label: 'Order Confirmation' };
const RECEIPT = { code: 'SUPPLIER_RECEIPT', label: 'Supplier Receipt' };

const DOCUMENTS: MarketplaceDocument[] = [
  { id: 78, orderName: 'S00073', type: CONFIRMATION, dateFormatted: '09/16/2026' },
  { id: 77, orderName: 'S00074', type: CONFIRMATION, dateFormatted: '09/16/2026' },
  { id: 76, orderName: 'S00072', type: RECEIPT, dateFormatted: '09/15/2026' },
  { id: 75, orderName: 'S00072', type: CONFIRMATION, dateFormatted: '09/15/2026' },
  { id: 74, orderName: 'S00071', type: RECEIPT, dateFormatted: '09/15/2026' },
  { id: 73, orderName: 'S00071', type: CONFIRMATION, dateFormatted: '09/15/2026' },
  { id: 72, orderName: 'S00068', type: RECEIPT, dateFormatted: '09/15/2026' },
  { id: 71, orderName: 'S00068', type: CONFIRMATION, dateFormatted: '09/15/2026' },
  { id: 66, orderName: 'S00067', type: RECEIPT, dateFormatted: '09/15/2026' },
  { id: 65, orderName: 'S00067', type: CONFIRMATION, dateFormatted: '09/15/2026' },
  { id: 63, orderName: 'S00066', type: CONFIRMATION, dateFormatted: '09/14/2026' },
  { id: 62, orderName: 'S00065', type: RECEIPT, dateFormatted: '09/11/2026' },
  { id: 61, orderName: 'S00065', type: CONFIRMATION, dateFormatted: '09/11/2026' },
  { id: 58, orderName: 'S00063', type: RECEIPT, dateFormatted: '09/11/2026' },
  { id: 57, orderName: 'S00063', type: CONFIRMATION, dateFormatted: '09/11/2026' },
  { id: 55, orderName: 'S00062', type: RECEIPT, dateFormatted: '09/11/2026' },
  { id: 54, orderName: 'S00062', type: CONFIRMATION, dateFormatted: '09/11/2026' },
  { id: 53, orderName: 'S00061', type: RECEIPT, dateFormatted: '09/11/2026' },
  { id: 51, orderName: 'S00061', type: CONFIRMATION, dateFormatted: '09/11/2026' },
  { id: 50, orderName: 'S00060', type: RECEIPT, dateFormatted: '09/11/2026' },
  { id: 49, orderName: 'S00060', type: CONFIRMATION, dateFormatted: '09/11/2026' },
  { id: 56, orderName: 'S00059', type: RECEIPT, dateFormatted: '09/11/2026' },
  { id: 44, orderName: 'S00059', type: CONFIRMATION, dateFormatted: '09/11/2026' },
];

export function mockMarketplaceDocuments(): MarketplaceDocument[] {
  return DOCUMENTS;
}
