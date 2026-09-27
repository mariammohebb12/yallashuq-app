# Backend request 015 — JSON endpoints for the customer's invoices (list + detail, read-only)

**Status:** Open — the mobile app's Invoices & Bills screens run on temporary sample data until
this ships (the PDF and the Communication history already use real routes)
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–014 have the same background — **014
is a double-charge bug on these same pages; please read it first.**

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie), then calls existing Odoo routes with that
session. It only displays what the backend returns.

## The problem

Checked on staging 2026-09-27, signed in as a test customer:

- **`/my/invoices`** ("Invoices & Bills", title "My Invoices and Payments"): columns *Invoice #*,
  *Invoice Date*, *Due Date*, *Amount Due*, *Status* (badges "Waiting for Payment", "Paid",
  "Processing Payment"); *Sort By* Date / Due Date / Reference / Status (`sortby=date|duedate|
  name|state`); *Filter By* All / Bills / Invoices / Overdue invoices (`filterby=…`); a "Pay
  overdue" button. The test customer has 14 rows (11 invoices `INV/…`, 3 credit notes `RINV/…`),
  one page; "Bills" is empty ("There are currently no invoices and payments for your account.").
- **`/my/invoices/<id>`**: number, the invoice **total** (e.g. INV/2026/00007: list Amount Due
  ₪ 236.00, page ₪ 2,596.00), status, "Download" (`?report_type=pdf&download=true`), an embedded
  HTML copy (`?report_type=html`), the Pay card (see 014), "Communication history".
- **No JSON for the list or the header:** a JSON call to `/my/invoices` → 400 (HTML).
- **What already works as JSON / files (the app uses these):**
  - Communication history: `POST /mail/thread/messages` with
    `{thread_model: "account.move", thread_id: <id>}` (what the page's chatter calls).
  - PDF: `/my/invoices/<id>?report_type=pdf` with the session cookie.

## Request

Read-only JSON routes for the signed-in customer's own invoices (`type='json'`,
`methods=['POST']`, `auth='user'`; optional `lang`). **No payment in this request** — that waits
for 014.

### Route 1 — list: `/my/invoices_json`

Params: `{ "filterby": "all|bills|invoices|overdue_invoices", "sortby": "date|duedate|name|state",
"page": 1, "limit": 20 }` — same values and same results as the website's query parameters.

```jsonc
{
  "invoices": [
    {
      "id": 58,
      "name": "INV/2026/00012",
      "move_type": "out_invoice",               // or "out_refund" for credit notes
      "invoice_date_formatted": "09/16/2026",
      "due_date_formatted": "09/16/2026",
      "amount_due_formatted": "₪ 4,720.00",      // the list's "Amount Due"
      "amount_total_formatted": "₪ 4,720.00",    // what the detail header shows
      "status": { "code": "waiting_for_payment", "label": "Waiting for Payment" },  // translated
      "pdf_url": "/my/invoices/58?report_type=pdf"
    }
  ],
  "page": 1, "has_next": false, "total_count": 14
}
```

Please list every possible `status.code` / label.

### Route 2 — detail: `/my/invoice_json`

Params: `{ "invoice_id": 58 }` → the same fields as one row, plus the related order reference(s)
if any. (Messages stay on `/mail/thread/messages`.)

## Acceptance criteria

1. As a guest: the standard "Session Expired" JSON-RPC error (not HTML).
2. For every `filterby` / `sortby`, Route 1 returns the same rows in the same order as
   `/my/invoices` with the same parameters.
3. Amounts and statuses match the website exactly (and, once 014 is fixed, reflect real payments).
4. A customer only sees their own invoices.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# Signed in (session cookie in $J):
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"filterby":"overdue_invoices","sortby":"date"}}' \
  $B/my/invoices_json | python3 -m json.tool
```

## Mobile app side (for reference)

- Screens: `src/app/my/invoices/index.tsx` (list, "Sample data" banner, Sort By / Filter By),
  `src/app/my/invoices/[id].tsx` (header, Download, real Communication history),
  `src/app/my/invoices/[id]/pdf.tsx` (real PDF). No Pay anywhere (014).
- Data: `src/api/invoices.ts`; temporary mock `src/api/mocks/invoices.mock.ts`, deleted when this
  ships.
