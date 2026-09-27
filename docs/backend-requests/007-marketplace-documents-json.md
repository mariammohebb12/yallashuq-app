# Backend request 007 — JSON endpoint for the customer's marketplace documents list

**Status:** Open — the mobile app's Marketplace Documents list runs on temporary sample data until
this ships (opening a document already uses the real route)
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–006 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie, obtained via the web login), then calls
existing Odoo routes with that session. It only displays what the backend returns.

## The problem

The customer's documents are only available as **server-rendered HTML**. Checked on staging
2026-09-27, signed in as a test customer:

- **`/my/marketplace/documents`** ("My Marketplace Documents"): one table, all rows on one page
  (25 for the test customer, no pager, no filters). Columns: *Order*, *Type*, *Issuer*, *Number*,
  *Date* (MM/DD/YYYY) and a "View / Download" button. Only linked from the `/my` account page.
- Types seen: `ORDER_CONFIRMATION` (issuer "My Company (San Francisco)", Number empty) and
  `SUPPLIER_RECEIPT` (issuer = the seller, Number e.g. "YS-SR-000039"). The type is shown as the
  raw code; there's no readable label.
- **`/my/marketplace/document/<id>`** returns the file (normally a PDF, `Content-Disposition:
  inline`). Another customer's id returns 404. **The app already uses this route as-is** to open
  documents; no change needed there.
- No JSON: a JSON call to `/my/marketplace/documents` is rejected (400, HTML);
  `/api/documents`, `/api/marketplace/documents`, `/my/marketplace/documents/json` are 404;
  `/my/counters` has no document count.

## Bugs found (please look at)

1. **Wrong files served for some documents.** On staging, some of the test customer's document
   records serve a file that isn't that customer's document. Details were reported separately;
   please make sure the list route (and the existing download route) only ever returns the
   customer's own, correct document — e.g. only system-generated files, or uploads validated
   against the order.
2. **Company details not set up** on staging's PDFs: header "Your logo", "My Company (San
   Francisco)", a San Francisco address, +1 555 phone, example.com.
3. **Supplier receipt totals don't add up**, e.g. S00072: line ₪ 2,360.00, Total ₪ 2,596.00,
   Tax ₪ 396.00.
4. **Number is empty** on every Order Confirmation.

## Request

One read-only JSON route for the signed-in customer's own documents.

| | |
|---|---|
| Route | `/my/marketplace/documents_json` (suggested name) |
| Type | `type='json'`, `methods=['POST']`, `auth='user'` |
| Params | `{ "page": 1, "limit": 50 }` (optional), optional `lang` |
| Side effects | none |

```jsonc
{
  "documents": [
    {
      "id": 78,
      "order": { "id": 73, "name": "S00073" },
      "type": { "code": "ORDER_CONFIRMATION", "label": "Order Confirmation" },  // label translated
      "issuer": "YallaShuq",                 // as the website shows it
      "number": null,                        // null when none
      "date": "2026-09-16",
      "date_formatted": "09/16/2026",        // as the website shows it
      "url": "/my/marketplace/document/78"   // the existing download route
    }
  ],
  "page": 1,
  "has_next": false,
  "total_count": 25
}
```

Same rows, same order as `/my/marketplace/documents`. Customer-facing documents only: never
seller financial reports, settlement data or another customer's documents.

## Acceptance criteria

1. As a guest: the standard "Session Expired" JSON-RPC error (not HTML).
2. Same rows, order, types and dates as `/my/marketplace/documents` for the same customer;
   `total_count` equals the real number.
3. Every `url` opens a document that belongs to that customer and that order (bug 1).
4. `type.label` is translated with `lang` (en / ar / he / ru).
5. Customer A never sees customer B's documents.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# Signed in (session cookie in $J):
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{}}' $B/my/marketplace/documents_json | python3 -m json.tool
```

## Mobile app side (for reference)

- Screens: `src/app/my/documents.tsx` (list, "Sample data" banner) and
  `src/app/my/documents/[id].tsx` (opens `/my/marketplace/document/<id>` in an in-app WebView
  with the session cookie).
- Data: `src/api/documents.ts` (`fetchMarketplaceDocuments`, `marketplaceDocumentRequest`). The
  temporary mock is `src/api/mocks/documents.mock.ts`, deleted when this route ships.
- Android's WebView doesn't render PDFs; the app will need another way to show them there
  (app-side, not part of this request).
