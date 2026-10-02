import { getCookieHeader } from './cookie-jar';
import { formatDate, formatMoney } from '@/utils/locale-format';
import { NETWORK_ERROR_MESSAGE } from './messages';
import { odooJsonRpc, odooUrl } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * Invoices & Bills (the live /my/invoices pages). READ-ONLY — the app has no Pay action at all:
 * staging offers "Pay" on invoices of orders that are already paid (double-charge risk, see
 * docs/backend-requests/014-invoice-double-charge.md).
 *
 * FIXED 2026-10-02 (tracker #15): the list/detail route exists for real now
 * (yallashuq_seller/controllers/invoices.py, `/my/invoices/json` + `/my/invoices/<id>/json`) —
 * it was already built, the app just hadn't been switched over from mock.invoices.ts to it.
 * That route doesn't take the live page's Filter By/Sort By params (it's always newest-first,
 * paginated) — Filter/Sort are applied here, client-side, over the fetched page, the same way
 * the live page's own options narrow/order its list. "Bills" (vendor bills) is correctly always
 * empty: the backend route only ever returns customer invoices/credit notes (`out_invoice`/
 * `out_refund`), matching what staging itself showed ("Bills is empty on staging").
 *
 * Odoo's real `payment_state` values (not_paid/in_payment/paid/partial/reversed/
 * invoicing_legacy) are mapped to the app's 3 status buckets below. Only `not_paid`→"Waiting for
 * Payment", `in_payment`→"Processing Payment" and `paid`→"Paid" were actually seen on staging;
 * `partial`/`reversed`/`invoicing_legacy` are mapped by Odoo's own standard meaning (partial →
 * still owed, so "waiting"; reversed/invoicing_legacy → settled, so "paid") rather than
 * confirmed against a real example — flagging this assumption rather than presenting it as seen.
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

export type InvoiceLine = {
  id: number;
  name: string;
  quantity: number;
  priceUnitFormatted: string;
  priceSubtotalFormatted: string;
};

export type InvoiceDetail = InvoiceSummary & { lines: InvoiceLine[] };

export type InvoiceResult =
  | { ok: true; invoice: InvoiceDetail | null; isSampleData: boolean }
  | { ok: false; message: string };

type InvoiceJson = {
  id: number;
  name: string;
  move_type: string;
  invoice_date: string | false;
  due_date: string | false;
  amount_total: number;
  amount_residual: number;
  currency: string | false;
  payment_state: string;
};

type InvoicesJsonResponse =
  | {
      status: 'success';
      page: number;
      page_count: number;
      total_count: number;
      invoices: InvoiceJson[];
    }
  | { status: 'error'; message?: string };

type InvoiceDetailJsonResponse =
  | (InvoiceJson & {
      status: 'success';
      partner_name: string;
      lines: {
        id: number;
        name: string;
        quantity: number;
        price_unit: number;
        price_subtotal: number;
        price_total: number;
      }[];
      pdf_url: string;
    })
  | { status: 'error'; message?: string };

const STATUS_BY_PAYMENT_STATE: Record<string, InvoiceStatus> = {
  not_paid: { code: 'waiting_for_payment', label: 'Waiting for Payment' },
  partial: { code: 'waiting_for_payment', label: 'Waiting for Payment' },
  in_payment: { code: 'processing_payment', label: 'Processing Payment' },
  paid: { code: 'paid', label: 'Paid' },
  reversed: { code: 'paid', label: 'Paid' },
  invoicing_legacy: { code: 'paid', label: 'Paid' },
};

function mapInvoice(json: InvoiceJson): InvoiceSummary {
  return {
    id: json.id,
    name: json.name,
    invoiceDateFormatted: formatDate(json.invoice_date),
    dueDateFormatted: formatDate(json.due_date),
    amountDueFormatted: formatMoney(json.amount_residual, json.currency),
    status: STATUS_BY_PAYMENT_STATE[json.payment_state] ?? STATUS_BY_PAYMENT_STATE.not_paid,
    amountTotalFormatted: formatMoney(json.amount_total, json.currency),
  };
}

function applyFilterAndSort(
  invoices: InvoiceSummary[],
  filter: InvoiceFilter,
  sort: InvoiceSort
): InvoiceSummary[] {
  let result = invoices;
  if (filter === 'bills') {
    // The backend route only ever returns customer invoices/credit notes — there are never
    // any vendor bills to show here, same as the live site.
    result = [];
  } else if (filter === 'invoices') {
    result = result.filter((invoice) => !invoice.name.startsWith('R'));
  } else if (filter === 'overdue_invoices') {
    result = result.filter(
      (invoice) => invoice.status.code === 'waiting_for_payment' && invoice.dueDateFormatted
    );
  }
  const sorted = [...result];
  if (sort === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'state') {
    sorted.sort((a, b) => a.status.code.localeCompare(b.status.code));
  } else if (sort === 'duedate') {
    sorted.sort((a, b) => b.dueDateFormatted.localeCompare(a.dueDateFormatted));
  }
  // 'date' is already the backend's own newest-first order.
  return sorted;
}

/** Real: fetches a page of the customer's own invoices/credit notes and applies filter/sort. */
export async function fetchInvoices(
  filter: InvoiceFilter,
  sort: InvoiceSort
): Promise<InvoicesResult> {
  try {
    const data = await odooJsonRpc<InvoicesJsonResponse>('/my/invoices/json', { limit: 50 });
    if (data.status !== 'success') {
      return { ok: false, message: data.message || NETWORK_ERROR_MESSAGE };
    }
    const invoices = applyFilterAndSort(data.invoices.map(mapInvoice), filter, sort);
    return { ok: true, invoices, isSampleData: false };
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}

/** Real: fetches one invoice's header + line items; `invoice` is null when not found/unauthorized. */
export async function fetchInvoice(id: number): Promise<InvoiceResult> {
  try {
    const data = await odooJsonRpc<InvoiceDetailJsonResponse>(`/my/invoices/${id}/json`, {});
    if (data.status !== 'success') {
      // The backend's own "Invoice not found" / "Unauthorized" both mean: nothing to show.
      return { ok: true, invoice: null, isSampleData: false };
    }
    const invoice: InvoiceDetail = {
      ...mapInvoice(data),
      lines: data.lines.map((line) => ({
        id: line.id,
        name: line.name,
        quantity: line.quantity,
        priceUnitFormatted: formatMoney(line.price_unit, data.currency),
        priceSubtotalFormatted: formatMoney(line.price_subtotal, data.currency),
      })),
    };
    return { ok: true, invoice, isSampleData: false };
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
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
