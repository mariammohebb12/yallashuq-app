import { getCookieHeader } from './cookie-jar';
import { NETWORK_ERROR_MESSAGE } from './messages';
import { mockInvoice, mockInvoices } from './mocks/invoices.mock';
import { odooJsonRpc, odooUrl } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * Invoices & Bills (the live /my/invoices pages). READ-ONLY — the app has no Pay action at all:
 * staging offers "Pay" on invoices of orders that are already paid (double-charge risk, see
 * docs/backend-requests/014-invoice-double-charge.md).
 *
 * ⚠️ LIST AND HEADERS ARE TEMPORARY MOCK DATA ⚠️ /my/invoices and /my/invoices/<id> are
 * server-rendered HTML only (JSON call → 400; checked on staging 2026-09-27). Requested in
 * docs/backend-requests/015-invoices-list-json.md. Until it ships, fetchInvoices / fetchInvoice
 * return sample data copied from staging (src/api/mocks/invoices.mock.ts).
 *
 * REAL:
 * - Communication history: POST /mail/thread/messages (the route the live page's chatter uses),
 *   {thread_model: 'account.move', thread_id} with the signed-in session.
 * - The PDF: /my/invoices/<id>?report_type=pdf (the live "Download" link without download=true, so
 *   it opens inline), requested with the session cookie.
 * ---------------------------------------------------------------------------------------------
 */

/** Live Filter By options. */
export type InvoiceFilter = 'all' | 'bills' | 'invoices' | 'overdue_invoices';
/** Live Sort By options (the website's `sortby` values). */
export type InvoiceSort = 'date' | 'duedate' | 'name' | 'state';

export type InvoiceStatus = {
  code: 'waiting_for_payment' | 'paid' | 'processing_payment' | (string & {});
  /** e.g. "Waiting for Payment". */
  label: string;
};

/** One row of the live list, plus the total the detail page's header shows. */
export type InvoiceSummary = {
  id: number;
  /** e.g. "INV/2026/00012" or a credit note "RINV/2026/00002". */
  name: string;
  invoiceDateFormatted: string;
  dueDateFormatted: string;
  /** Live list "Amount Due", e.g. "₪ 236.00". */
  amountDueFormatted: string;
  status: InvoiceStatus;
  /** Live detail header amount (the invoice total), e.g. "₪ 2,596.00". */
  amountTotalFormatted: string;
};

export type InvoicesResult =
  | { ok: true; invoices: InvoiceSummary[]; isSampleData: boolean }
  | { ok: false; message: string };

export type InvoiceResult =
  | { ok: true; invoice: InvoiceSummary | null; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * TEMPORARY: returns the mock list (isSampleData: true).
 * TODO: replace with the list route from docs/backend-requests/015-invoices-list-json.md.
 */
export async function fetchInvoices(
  filter: InvoiceFilter,
  sort: InvoiceSort
): Promise<InvoicesResult> {
  return { ok: true, invoices: mockInvoices(filter, sort), isSampleData: true };
}

/**
 * TEMPORARY: returns the mock invoice (isSampleData: true); `invoice` is null when unknown.
 * TODO: replace with the detail route from docs/backend-requests/015-invoices-list-json.md.
 */
export async function fetchInvoice(id: number): Promise<InvoiceResult> {
  return { ok: true, invoice: mockInvoice(id), isSampleData: true };
}

export type InvoiceMessage = {
  id: number;
  authorName: string;
  /** "YYYY-MM-DD HH:MM:SS", UTC, as the backend sends it. */
  date: string;
  /** Message body as plain text (the backend sends HTML). */
  text: string;
};

export type InvoiceMessagesResult =
  | { ok: true; messages: InvoiceMessage[] }
  | { ok: false; message: string };

type ThreadMessagesResponse = {
  messages?: number[];
  data?: {
    'mail.message'?: {
      id: number;
      author?: { id: number; type: string } | false;
      body?: string;
      date?: string;
      is_note?: boolean;
    }[];
    'res.partner'?: { id: number; name?: string }[];
  };
};

function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** REAL: the invoice's Communication history, newest first (as the backend returns it). */
export async function fetchInvoiceMessages(id: number): Promise<InvoiceMessagesResult> {
  try {
    const result = await odooJsonRpc<ThreadMessagesResponse>('/mail/thread/messages', {
      thread_model: 'account.move',
      thread_id: id,
      fetch_params: { limit: 30 },
    });
    const partners = new Map(
      (result?.data?.['res.partner'] ?? []).map((partner) => [partner.id, partner.name ?? ''])
    );
    const messages = (result?.data?.['mail.message'] ?? [])
      // Internal notes are never customer-facing (the portal shouldn't return them anyway).
      .filter((message) => !message.is_note)
      .map((message) => ({
        id: message.id,
        authorName: message.author ? (partners.get(message.author.id) ?? '') : '',
        date: message.date ?? '',
        text: htmlToText(message.body ?? ''),
      }));
    return { ok: true, messages };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}

/** REAL: what an in-app WebView needs to open the invoice PDF like the live "Download" link. */
export async function invoicePdfRequest(
  id: number
): Promise<{ uri: string; headers: Record<string, string> }> {
  const uri = odooUrl(`/my/invoices/${id}?report_type=pdf`);
  const cookie = await getCookieHeader(uri);
  return { uri, headers: cookie ? { Cookie: cookie } : {} };
}
