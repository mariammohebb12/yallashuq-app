# Backend request 006 — JSON endpoints for customer returns (form, submit, list, detail)

**Status:** Open — blocks the mobile app's return screens (the new-return form's Submit is disabled;
the return list/detail run on temporary sample data until this ships)
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–005 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie, obtained via the web login), then calls
existing Odoo routes with that session. It only displays what the backend returns. It does **not**
decide return eligibility, return periods, refund amounts or statuses.

## The problem

Returns exist on the website only as **server-rendered HTML** behind sign-in. Checked on staging
2026-09-27, signed in as a test customer (model behind them: `return.request`):

- **New return form — `/my/orders/<id>/return`.** Opened from the "Return / Reschedule Items"
  button on every order detail page, and from the "Return" button on some rows of `/my/orders`.
  It posts **`multipart/form-data`** to **`/my/orders/return/submit`** with: `csrf_token`,
  `order_id`, per line `line_<id>_selected` + `line_<id>_qty` (min 1, max = returnable qty),
  `return_reason_code`, `return_type` (`refund` / `replacement`), `refund_type` (`original`),
  `notes`, `issue_image` (required), `tag_attached` (`yes`/`no`, required),
  `tag_verification_images` (multiple, optional), `pickup_date` (required; between today and the
  order's return-period end, e.g. "Return period ends on: 2026-09-30"), `pickup_slot`
  (`morning` / `afternoon` / `evening`). A JSON-RPC call to `/my/orders/return/submit` is rejected
  (HTTP 400, HTML).
  - Reason options (value → label): `damaged` → Damaged Product, `wrong_item` → Wrong Item
    Received, `not_as_described` → Not as Described, `quality_issue` → Quality Issue,
    `size_issue` → Size/Fit Issue, `changed_mind` → Changed Mind, `other` → Other.
  - Slot labels: "Morning (9 AM - 12 PM)", "Afternoon (1 PM - 5 PM)", "Evening (6 PM - 9 PM)".
  - When the order already has returns, a "Previous Return Requests for This Order" table
    (Return #, Pickup Date, Items Qty, Status) appears above the form.
- **Return list — `/my/returns`.** Columns: Return #, Order, Pickup Date, Refunded, Status (two
  badges: progress, e.g. "Received & Verified", and decision, e.g. "Seller Accepted"). Not linked
  from any page (only reachable by URL).
- **Return detail — `/my/returns/<id>`.** Returned Items (Product, Qty, Price, Refunded; "Total
  Expected Refund"), Pickup History (Date, Slot), Request Info (Order, Return Type, Refund Method,
  Reason, Return Reason, Customer Image at `/web/image/return.request/<id>/issue_image`, Latest
  Pickup, Status).
- No JSON route exists for any of this: JSON calls to `/my/returns` and `/my/returns/<id>` are
  rejected (400), `/api/returns` is 404, `/my/counters` has no return count, and the frontend
  JS only toggles the form (refund/replacement) and runs the date picker.

## Bugs found (please look at; the app doesn't rely on these)

1. **Empty form still submittable.** On an order whose items were all returned (staging S00066),
   "Items to Return" is empty but the whole form and "Submit Return Request" still show.
2. **Two labels for the same decision.** RET/00007 shows "Seller Accepted" on `/my/returns` and
   `/my/returns/7`, but "Accepted" in the form's "Previous Return Requests" table.
3. **"Refunded" before any refund.** Every return shows "Refunded ₪ 2,360.00" while its status is
   only "Received & Verified". Please confirm whether this is the *planned* refund or money that
   actually went back through Sumit/Lahza (provider-side refunds aren't automatic yet).
4. **"Return Reason" is always "-"** on the detail page, next to "Reason". Unclear what it's for.

## Request

Four JSON routes for the signed-in customer's own returns (`type='json'`, `methods=['POST']`,
`auth='user'`; all accept an optional `lang`). Route names are suggestions. Amounts, dates and
labels come **formatted by the backend** exactly as the website shows them.

### Route 1 — return form options: `/my/orders/return/form_json`

Params: `{ "order_id": 73 }`. Side effects: none.

```jsonc
{
  "order": { "id": 73, "name": "S00073" },
  "can_submit": true,                       // false when nothing is returnable (bug 1)
  "lines": [
    { "line_id": 174, "product_name": "Badminton Racket",
      "max_quantity": 2, "refund_unit_price_formatted": "₪ 2,000.00" }
  ],
  "reasons": [ { "code": "damaged", "label": "Damaged Product" } /* …all 7, in this order */ ],
  "return_types": [ { "code": "refund", "label": "Refund" }, { "code": "replacement", "label": "Replacement" } ],
  "refund_to_label": "Original Payment Method (3-5 days)",
  "pickup": {
    "min_date": "2026-09-27", "max_date": "2026-09-30",
    "return_period_end_formatted": "2026-09-30",
    "slots": [ { "code": "morning", "label": "Morning (9 AM - 12 PM)" } /* …all 3 */ ]
  },
  "previous_returns": [                      // the "Previous Return Requests" table
    { "id": 7, "name": "RET/00007", "pickup_date_formatted": "09/20/2026",
      "items_qty": 1, "decision": { "code": "accepted", "label": "Accepted" } }
  ]
}
```

### Route 2 — submit: `/my/orders/return/submit_json`

Same fields and validation as `/my/orders/return/submit`, as JSON; images as base64 (or accept a
multipart POST with `csrf=False` + session auth and a JSON response — either is fine, say which).

```jsonc
// params
{ "order_id": 73,
  "lines": [ { "line_id": 174, "quantity": 1 } ],
  "return_reason_code": "not_as_described", "return_type": "refund", "refund_type": "original",
  "notes": "", "issue_image": { "filename": "photo.jpg", "data": "<base64>" },
  "tag_attached": "yes", "tag_verification_images": [],
  "pickup_date": "2026-09-29", "pickup_slot": "morning" }
// success
{ "success": true, "return": { "id": 8, "name": "RET/00008" } }
// validation error (per field, same rules as the website)
{ "success": false, "errors": { "pickup_date": "…", "issue_image": "…" } }
```

### Route 3 — list: `/my/returns_json`

Params: `{ "page": 1, "limit": 20 }`. Same rows as `/my/returns`:

```jsonc
{ "returns": [ { "id": 7, "name": "RET/00007", "order": { "id": 66, "name": "S00066" },
    "pickup_date_formatted": "09/20/2026", "refunded_formatted": "₪ 2,360.00",
    "progress": { "code": "received", "label": "Received & Verified" },
    "decision": { "code": "accepted", "label": "Seller Accepted" } } ],
  "page": 1, "has_next": false, "total_count": 4 }
```

Please also list **every** possible `progress` and `decision` code/label, so the app can show
them all (staging only has returns at "Received & Verified" / "Seller Accepted").

### Route 4 — detail: `/my/return_json`

Params: `{ "return_id": 7 }`. Everything `/my/returns/<id>` shows: `lines` (product_name,
quantity_formatted, price_formatted, refunded_formatted), `total_expected_refund_formatted`,
`pickups` (date_formatted, slot_label), `order` (id, name), `return_type`, `refund_method_label`,
`reason_label`, `return_reason_label`, `issue_image_url` (null if none), `progress`, `decision`.

Customer-facing only: no commission, seller net payable or internal reconciliation data.

## Acceptance criteria

1. As a guest: every route returns the standard "Session Expired" JSON-RPC error (not HTML).
2. Route 1's lines, max quantities, reasons, slots and date range match `/my/orders/<id>/return`
   for the same order; `can_submit` is false when nothing is returnable.
3. Route 2 creates exactly the same `return.request` the website form would (same fields, same
   validation), and rejects a quantity above `max_quantity` or a date outside the range.
4. Submitting the same request twice (e.g. a network retry) doesn't create two returns.
5. Routes 3 and 4 match `/my/returns` and `/my/returns/<id>` for the same customer.
6. Customer A can't read customer B's return or open B's order's form (access error).

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# Signed in (session cookie in $J):
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"order_id":73}}' $B/my/orders/return/form_json | python3 -m json.tool
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{}}' $B/my/returns_json | python3 -m json.tool
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"return_id":7}}' $B/my/return_json | python3 -m json.tool
```

## Mobile app side (for reference)

- Screens: `src/app/my/orders/[id]/return.tsx` (new return form — Submit disabled, "Coming
  soon"), `src/app/my/returns/[id].tsx` (return detail), and the "Previous Return Requests for
  This Order" list on `src/app/my/orders/[id].tsx`. All show a "Sample data" banner.
- The app's form currently has only: Order (read-only), Items to Return (+ quantity), Reason for
  Return and Image Upload. The website's other required fields (Return Type, tags attached,
  pickup date and slot) will be added when this route ships.
- Data: `src/api/returns.ts` (`fetchReturnForm`, `fetchReturn`) and `OrderDetail.returns` in
  `src/api/orders.ts`. The temporary mocks are `src/api/mocks/returns.mock.ts` and the `RETURNS`
  table in `src/api/mocks/orders.mock.ts`, which get deleted when these routes ship.
