# Backend request 005 — JSON endpoints for the customer's order list and order detail

**Status:** Open — blocks the mobile app's My Orders screens (they run on temporary sample data until this ships)
**Requested:** 2026-09-26
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–004 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie, obtained via the web login), then calls
existing Odoo routes with that session. It only displays what the backend returns. It does **not**
calculate totals, taxes, delivery, statuses or return eligibility.

## The problem

The customer's orders are only available as **server-rendered HTML** behind sign-in. Checked on
staging 2026-09-26, signed in as a test customer:

- **`/my/orders`**: one table (`o_portal_my_doc_table`), all orders on one page (13 for the test
  customer, no pager). Columns: *Sales Order # / Ref.*, *Order Date* (date + time), *Total*,
  *Return* (a button to `/my/orders/<id>/return`, present on only 6 of the 13 orders), and
  *Feedback & Support* (*RATE NOW*, *SUPPORT*). **There's no status column and no seller.**
- **`/my/orders/<id>`**: the order number, order date, "Invoicing and Shipping Address" (name,
  address, phone, email), "Last Invoices" (number, a status badge, date), "Last Delivery Orders"
  (number, a status badge such as "Shipped", date, a RETURN link), a products table (Products,
  Quantity, Unit Price, Taxes, Amount; the seller's delivery charge is its own line, e.g.
  "Delivery (John Doe) — FREE"), totals (Untaxed Amount, "VAT 18%", Total), Terms & Conditions,
  payment terms, and PDF links for the order, the invoice, the delivery slip and the return slip.
  **No tracking number or carrier appears anywhere.**
- JSON routes that do exist on these pages don't cover this: `/my/orders/review/info` and
  `/my/orders/review/submit` (Rate Now), `/my/orders/reorder_modal_content` (standard Odoo's
  "order again" data for one order: products only, no status or totals). "Support" posts an
  HTML form to `/my/orders/<id>/mishmesh_support`.

## Bugs found (please fix; the app deliberately doesn't rely on these)

1. **Order count is wrong.** For the same customer, `/my/counters` returned `order_count: 1`,
   while `/my/orders` lists **13** orders. (The same call returned `overdue_invoice_count: 10`
   with `invoice_count: 1`; see request 004.) Please check the domain these counters use. The
   app doesn't show an order count, and doesn't use `/my/counters` for orders.
2. **Payment status contradicts itself.** Order S00073's page shows *"Thank you! Your payment
   has been successfully processed."* while its invoice INV/2026/00012 shows **"Waiting
   Payment"** at the same time. Either the banner shows regardless of payment state, or the
   invoice isn't marked paid after a successful payment (Sumit/Lahza callback not reconciling?).
   The app shows **no payment status** until the route below returns one authoritative value.
   Possibly related to the known order-status bug (orders becoming "Delivered" at confirmation).

## Request

Two read-only JSON routes for the signed-in customer's own orders.

### Route 1 — order list

The live list's columns, plus one addition: a thumbnail of the order's **first** product (the
app's order card shows it; the website's table doesn't). Status, seller and everything else
belong to the detail route.

| | |
|---|---|
| Route | `/my/orders_json` (suggested name; any name works, as long as it's documented) |
| Type | `type='json'`, `methods=['POST']`, `auth='user'` |
| Params | `{ "page": 1, "limit": 20 }` (optional; both routes also accept an optional `lang`) |
| Side effects | none |

```jsonc
{
  "orders": [
    {
      "id": 73,
      "name": "S00073",
      "date": "2026-09-16T14:17:53Z",         // ISO, UTC
      "date_formatted": "09/16/2026",          // as the website shows it, in the user's tz/lang
      "time_formatted": "14:17:53",
      "total_formatted": "₪ 4,720.00",
      "return_available": true,                // exactly when the website shows "Return"
      "first_product_image_url": "/web/image/product.template/52/image_256"  // null if none
    }
  ],
  "page": 1,
  "has_next": false,
  "total_count": 13                            // must equal the real number of orders
}
```

### Route 2 — order detail

| | |
|---|---|
| Route | `/my/order_json` (suggested) |
| Type | `type='json'`, `methods=['POST']`, `auth='user'` |
| Params | `{ "order_id": 73 }` |

```jsonc
{
  // …all the list fields above, plus:
  "status": { "code": "shipped", "label": "Shipped" },  // see "Status" below
  "seller": { "id": 12, "name": "John Doe" },           // seller of record for this order
  "contact": {                                 // "Invoicing and Shipping Address" block
    "name": "Customer Name",
    "address_lines": ["Street 1", "Building", "City ZIP", "Region", "Country"],
    "phone": "+972 …",                         // "" if none
    "email": "customer@example.com"            // "" if none
  },
  "lines": [
    {
      "id": 731,
      "name": "[YO223] Badminton Racket",      // as displayed on the website
      "is_delivery": false,
      "quantity_formatted": "2.00 Units",
      "price_unit_formatted": "2,000.00",
      "taxes_label": "18% PA",
      "amount_formatted": "₪ 4,000.00"
    },
    {
      "id": 732,
      "name": "Delivery (John Doe)",
      "is_delivery": true,
      "quantity_formatted": "1.00 Units",
      "price_unit_formatted": "FREE",
      "taxes_label": "18% PA",
      "amount_formatted": "₪ 0.00"
    }
  ],
  "totals": {
    "untaxed_formatted": "₪ 4,000.00",
    "tax_groups": [{ "label": "VAT 18%", "amount_formatted": "₪ 720.00" }],
    "total_formatted": "₪ 4,720.00"
  },
  "payment_status": { "code": "paid", "label": "Paid" },  // ONE authoritative value (bug 2)
  "invoices": [
    { "id": 58, "name": "INV/2026/00012", "date_formatted": "09/16/2026", "pdf_url": "/my/invoices/58?report_type=pdf" }
  ],
  "deliveries": [
    {
      "id": 57,
      "name": "WH/OUT/00052",
      "date_formatted": "09/16/2026",
      "pdf_url": "/my/picking/pdf/57",
      "tracking": { "number": "…", "carrier": "…", "url": "…" }  // null when there's none
    }
  ],
  "order_pdf_url": "/my/orders/73?report_type=pdf",
  "terms_url": "/terms"                        // null if none
}
```

Notes:
- **Status.** One order-level status per order, following the marketplace flow *Packing →
  Shipped → Delivered* (plus whatever cancelled/returned states exist). `code` is stable for the
  app, `label` is translated. Please base it on the real delivery state, not on order
  confirmation (the known bug where orders become "Delivered" at confirmation).
- **Seller.** Checkout is split into one order per seller after payment, so each order should
  have exactly one seller of record. If an order can contain several sellers, say so, and
  return `sellers: [...]` instead.
- **Tracking.** Return it when the courier integration (`/api/delivery/track`) has one; `null`
  otherwise.
- **PDF URLs** must work with the same session cookie (the app downloads them in-app).
- **Only the customer's own orders.** Another customer's `order_id` → the standard access error,
  not their data. No internal fields (commission, seller net payable, provider costs).
- Amounts are **formatted by the backend** exactly as the website shows them. The app doesn't
  compute or re-format them.

## Acceptance criteria

1. As a guest: both routes return the standard "Session Expired" JSON-RPC error (not HTML, not a
   traceback).
2. The list has the same orders, in the same order, with the same totals, as `/my/orders` for the
   same customer, and `total_count` equals the real number of orders.
3. `return_available` is true exactly for the orders where the website shows "Return".
4. The detail's lines, taxes and totals match `/my/orders/<id>`.
5. `payment_status` is a single value that matches reality: a paid order never also reads
   "Waiting Payment" (bug 2).
6. Customer A requesting customer B's `order_id` gets an access error.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# Signed in (session cookie in $J):
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{}}' $B/my/orders_json | python3 -m json.tool
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"order_id":73}}' $B/my/order_json | python3 -m json.tool
```

## Related (not part of this request)

- **Return, Rate Now and Support** from the app need their own JSON routes (the return flow at
  `/my/orders/<id>/return`, `/my/orders/<id>/mishmesh_support`). Separate requests, once those
  screens are built. The existing `/my/orders/review/info` / `review/submit` JSON routes may
  already work for Rate Now; not tested yet.
- **Support contact email.** The "Need Support" popup's "Direct Contact" email is rendered into
  the HTML server-side (staging shows a test address, `admin-yallashaq@yopmail.com`). The app
  needs the real value as JSON — e.g. a `support_email` field on the order detail response, or on
  the support route once it exists. The app shows "Not available yet" until then.

## Mobile app side (for reference)

- Screens: `src/app/my/orders/index.tsx` (list), `src/app/my/orders/[id].tsx` (detail). Both show
  a "Sample data" banner while the mock is in use.
- Data: `src/api/orders.ts` (`fetchOrders`, `fetchOrder`). Types follow the responses above. The
  temporary mock is `src/api/mocks/orders.mock.ts`, which gets deleted when these routes ship.
