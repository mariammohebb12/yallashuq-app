import type { InvoiceFilter, InvoiceSort, InvoiceStatus, InvoiceSummary } from '../invoices';

/*
 * ⚠️ TEMPORARY MOCK INVOICE LIST — NOT REAL, DO NOT SHIP ⚠️
 * TODO: replace with the list route from docs/backend-requests/015-invoices-list-json.md, then
 * delete this file.
 *
 * Copied from the staging test customer's real /my/invoices (checked 2026-09-27): the same 14
 * invoices and credit notes with their real ids, numbers, dates, amounts due, statuses and the
 * total each detail page shows. The row orders below are exactly what staging returned for each
 * Sort By option and for "Overdue invoices"; "Bills" is empty on staging. Only the combination of
 * "Overdue invoices" with a non-default sort is derived here (the overdue rows, in that sort's
 * order) — the real app must get every order from the backend.
 * The status codes are made up; only the labels were seen.
 */

const WAITING: InvoiceStatus = { code: 'waiting_for_payment', label: 'Waiting for Payment' };
const PAID: InvoiceStatus = { code: 'paid', label: 'Paid' };
const PROCESSING: InvoiceStatus = { code: 'processing_payment', label: 'Processing Payment' };

function row(
  id: number,
  name: string,
  date: string,
  amountDueFormatted: string,
  status: InvoiceStatus,
  amountTotalFormatted: string
): InvoiceSummary {
  return {
    id,
    name,
    invoiceDateFormatted: date,
    dueDateFormatted: date, // Staging: the due date equals the invoice date on every row.
    amountDueFormatted,
    status,
    amountTotalFormatted,
  };
}

const INVOICES: Record<number, InvoiceSummary> = Object.fromEntries(
  [
    row(58, 'INV/2026/00012', '09/16/2026', '₪ 4,720.00', WAITING, '₪ 4,720.00'),
    row(56, 'INV/2026/00010', '09/15/2026', '₪ 2,596.00', WAITING, '₪ 2,596.00'),
    row(51, 'INV/2026/00008', '09/15/2026', '₪ 2,596.00', WAITING, '₪ 2,596.00'),
    row(55, 'INV/2026/00009', '09/15/2026', '₪ 2,596.00', WAITING, '₪ 2,596.00'),
    row(57, 'INV/2026/00011', '09/15/2026', '₪ 2,596.00', WAITING, '₪ 2,596.00'),
    row(50, 'RINV/2026/00004', '09/14/2026', '₪ 0.00', PAID, '₪ 2,360.00'),
    row(48, 'INV/2026/00007', '09/14/2026', '₪ 236.00', WAITING, '₪ 2,596.00'),
    row(32, 'INV/2026/00001', '09/11/2026', '₪ 2,596.00', PROCESSING, '₪ 2,596.00'),
    row(34, 'RINV/2026/00002', '09/11/2026', '₪ -2,360.00', WAITING, '₪ 2,360.00'),
    row(44, 'RINV/2026/00003', '09/11/2026', '₪ 0.00', PAID, '₪ 2,360.00'),
    row(39, 'INV/2026/00003', '09/11/2026', '₪ 2,596.00', WAITING, '₪ 2,596.00'),
    row(42, 'INV/2026/00004', '09/11/2026', '₪ 236.00', WAITING, '₪ 2,596.00'),
    row(37, 'INV/2026/00002', '09/11/2026', '₪ 2,596.00', WAITING, '₪ 2,596.00'),
    row(46, 'INV/2026/00006', '09/11/2026', '₪ 2,596.00', WAITING, '₪ 2,596.00'),
  ].map((invoice) => [invoice.id, invoice])
);

// Staging's order for each Sort By option (Filter By: All / Invoices — identical on staging).
const ORDER_BY_SORT: Record<InvoiceSort, number[]> = {
  date: [58, 56, 51, 55, 57, 50, 48, 32, 34, 44, 39, 42, 37, 46],
  duedate: [58, 56, 51, 55, 57, 50, 48, 32, 34, 44, 39, 42, 37, 46],
  name: [50, 44, 34, 58, 57, 56, 55, 51, 48, 46, 42, 39, 37, 32],
  state: [51, 34, 44, 58, 39, 42, 37, 46, 48, 55, 50, 57, 56, 32],
};

// Staging's "Overdue invoices" rows, in its default (Date) order.
const OVERDUE = [58, 51, 55, 57, 56, 48, 46, 39, 42, 37];

export function mockInvoices(filter: InvoiceFilter, sort: InvoiceSort): InvoiceSummary[] {
  let ids: number[];
  if (filter === 'bills') {
    ids = [];
  } else if (filter === 'overdue_invoices') {
    ids = sort === 'date' ? OVERDUE : ORDER_BY_SORT[sort].filter((id) => OVERDUE.includes(id));
  } else {
    ids = ORDER_BY_SORT[sort];
  }
  return ids.map((id) => INVOICES[id]);
}

export function mockInvoice(id: number): InvoiceSummary | null {
  return INVOICES[id] ?? null;
}
