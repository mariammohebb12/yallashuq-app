# Backend request 011 — JSON endpoint for the customer's quotations list

**Status:** Open — the mobile app's Quotations screen can only show the quotation *count* until this
ships
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–010 have the same background (010 is
the same kind of request for helpdesk tickets).

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie, obtained via the web login), then calls
existing Odoo routes with that session. It only displays what the backend returns.

## The problem

Checked on staging 2026-09-27, signed in as a test customer:

- **`/my/quotes`** (guests are redirected to `/web/login`): title "My Quotations", breadcrumb
  "Quotations", no heading, no sort/filter controls. The test customer has none, so the page shows
  only: **"There are currently no quotations for your account."** The table's row layout couldn't
  be seen. The "My Account" page has a matching card, "Quotations to review", hidden (`d-none`)
  while there are none.
- **What exists as JSON:** only the count — `POST /my/counters` with
  `{"counters": ["quotation_count"]}` → `{"quotation_count": 0}` (matches the page). The app uses
  this.
- **What doesn't:** a JSON call to `/my/quotes` → 400 (HTML); `/my/quotes_json`,
  `/my/quotations`, `/api/quotes`, `/api/quotations` → 404. The site's JavaScript calls no
  quotation-list route (only `/my/orders/reorder_modal_content` and the review routes).

## Impact

The app's Quotations screen shows the real count. With 0 quotations it shows the website's
empty-state text; with any quotations it can only say how many there are — it **can't list them
or open one** until this route exists.

## Request

A read-only JSON route for the signed-in customer's own quotations (`type='json'`,
`methods=['POST']`, `auth='user'`; optional `lang`).

| | |
|---|---|
| Route | `/my/quotes_json` (suggested name) |
| Params | `{ "page": 1, "limit": 20 }` (optional) |
| Side effects | none |

```jsonc
{
  "quotations": [
    {
      "id": 80,
      "name": "S00080",
      "date_formatted": "09/27/2026",          // quotation date, as the website shows it
      "valid_until_formatted": "10/27/2026",   // null if none
      "total_formatted": "₪ 2,360.00",
      "state": { "code": "sent", "label": "Quotation Sent" }  // translated
    }
  ],
  "page": 1,
  "has_next": false,
  "total_count": 0                              // must equal /my/counters' quotation_count
}
```

Same rows and order as `/my/quotes`. Customer-facing fields only (no commission or seller net
payable).

## Acceptance criteria

1. As a guest: the standard "Session Expired" JSON-RPC error (not HTML).
2. The list matches `/my/quotes` for the same customer, and `total_count` equals
   `quotation_count` from `/my/counters`.
3. Confirmed sales orders are **not** included (they're in `/my/orders`).
4. Customer A can't see customer B's quotations.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# Signed in (session cookie in $J):
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{}}' $B/my/quotes_json | python3 -m json.tool
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"counters":["quotation_count"]}}' $B/my/counters
```

## Mobile app side (for reference)

- Screen: `src/app/my/quotes.tsx`, opened from the Account tab's "Quotations to review" card. It
  shows the count from `/my/counters` (`src/api/quotations.ts` → `src/api/counters.ts`): the
  website's empty-state text at 0, otherwise "You have N quotations" with no list. No sample rows
  are ever shown.
- When this route ships, the screen lists the quotations (opening one would reuse the order detail
  route requested in #005).
