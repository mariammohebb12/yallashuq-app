# Backend request 004 — JSON endpoint for the signed-in customer's account summary

**Status:** Open — **verified 2026-09-26.** Checked on staging with a signed-in test customer:
none of the four fields (address, phone, gift-card count, wallet balance) is available as JSON,
including from `/my/counters`. The whole request below is needed. The mobile app's Account tab
shows "Not available yet" for all four fields until this route exists.
**Requested:** 2026-09-25
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–003 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie, obtained via the web login), then calls
existing Odoo routes with that session. It only displays what the backend returns.

The app's **Account tab** mirrors the website's "My Account" page (`/my`). It has:
- a **profile panel**: avatar, name, address, phone, email, and an "Edit information" link
- **cards**: Continue Shopping, My Orders, Marketplace Documents, **Gift & Vouchers (shows a count,
  e.g. "0 Cards")**, and **eWallet (shows the balance, e.g. "₪0.00")**

## The problem

The only customer data the app can currently get as JSON is the session:

```
POST /web/session/get_session_info   {"jsonrpc":"2.0","method":"call","params":{}}
→ uid, name, username (the login), partner_id, …
```

Verified in the app on staging with a signed-in customer: the name and the login (an email)
display correctly. Standard Odoo's session info has **no address or phone**, and nothing about
gift cards or the wallet.

Everything else on the "My Account" page is only available as **server-rendered HTML** behind
sign-in. Verified 2026-09-25 that these pages exist (they redirect guests to `/web/login`):

| Data the app needs | Where the website shows it today | JSON available? |
|---|---|---|
| Address (street, city, region, country) | `/my` profile panel, `/my/account` form | ❌ HTML only |
| Phone | `/my` profile panel, `/my/account` form | ❌ HTML only |
| Gift & vouchers count ("0 Cards") | `/my` card; details at `/my/gift-cards` | ❌ HTML only (not in `/my/counters`) |
| eWallet balance ("₪0.00") | `/my` card; details at `/my/wallet` | ❌ HTML only (not in `/my/counters`) |

**Verified 2026-09-26** (staging, signed in as a test customer):

- `/my/counters` is Odoo's standard JSON-RPC route for the portal's card counters. The `/my` page
  asks it for exactly these keys (its `data-placeholder_count` attributes): `bill_count`,
  `invoice_count`, `order_count`, `overdue_invoice_count`, `quotation_count`, `ticket_count`,
  `warranty_count`. There is **no gift-card or wallet key**.
- On `/my`, the "Gift & Vouchers" count (`<span class="badge …">0 Cards</span>`) and the eWallet
  balance (`₪ <span class="oe_currency_value">0.00</span>`) are rendered directly into the HTML
  by the server. They aren't filled in by `/my/counters` or any other JSON call.
- Phone and address appear in the `/my` profile panel and as pre-filled inputs in the
  `/my/account` form (`first_name`, `last_name`, `email`, `phone`, `street`, `street2`, `city`,
  `zipcode`, plus `state_id` / `country_id` selects). `get_session_info` still has neither.
- Side observation, worth a look: for the same customer, `/my/counters` returned
  `overdue_invoice_count: 10` but `invoice_count: 1`. Overdue invoices shouldn't outnumber all
  invoices. Please check that the overdue counter uses the same customer filter as the others.

## Request

One read-only JSON route returning the signed-in customer's account summary.

### Route

| | |
|---|---|
| Route | `/my/summary_json` (suggested name; any name works, as long as it's documented) |
| Type | `type='json'` (JSON-RPC, like `/my/counters`), `methods=['POST']` |
| Auth | `auth='user'`, for the signed-in customer only. For guests, the standard "Session Expired" error is fine (the app already treats that as signed out). |
| Params | none (`{}`); optionally `lang` |
| Side effects | none |

### Response (`result`)

```jsonc
{
  "partner": {
    "id": 1234,
    "name": "Customer Name",
    "email": "customer@example.com",      // "" if none
    "phone": "+972 50 123 4567",          // as stored/displayed on the site; "" if none
    "avatar_url": "/web/image/res.partner/1234/avatar_128",  // or null
    "address": {                          // null if the customer has no address
      "street": "123 Street Name",
      "street2": "",
      "city": "City",
      "state": { "id": 5, "name": "Region" },          // null if none
      "zip": "12345",
      "country": { "id": 104, "name": "Israel", "code": "IL" }  // null if none
    }
  },

  "gift_cards": {
    "count": 0                            // exactly what the "Gift & Vouchers" card shows ("0 Cards")
  },

  "wallet": {
    "balance": 0.0,                       // exactly what the "eWallet" card shows
    "balance_formatted": "₪0.00",         // formatted as the website shows it
    "currency": { "code": "ILS", "symbol": "₪" }
  }
}
```

Notes:
- **The same numbers as the website:** the count and balance must match what `/my` shows for the
  same customer at the same moment. The app won't compute them.
- **Only the customer's own data.** No other partners, and no internal fields (credit limits,
  internal notes, seller/commission data).
- **Alternative for the two numbers:** instead of putting `gift_cards` / `wallet` in this route,
  you could add two keys (e.g. `gift_card_count`, `wallet_balance`) to the portal's
  `_prepare_home_portal_values` so `/my/counters` returns them. Either way works for the app;
  say which one you chose.
- Editing the profile ("Edit information" → `/my/account`) isn't part of this request. It will be
  a separate one when that screen is built.

## Acceptance criteria

1. As a guest: returns the standard "Session Expired" JSON-RPC error (not an HTML page, not a traceback).
2. As a signed-in customer: `partner.name` and `partner.email` match the website's `/my` profile panel.
3. `partner.phone` and `partner.address` match what `/my/account` shows, and are empty/null when the customer has none.
4. `gift_cards.count` matches the "Gift & Vouchers" card on `/my` (e.g. 0 → "0 Cards").
5. `wallet.balance_formatted` matches the "eWallet" card on `/my` (e.g. "₪0.00"), including after a top-up or payment.
6. Signed in as customer A, the response never contains customer B's data.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# 1) Sign in through the web login in a browser, or reuse a session cookie, then:
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{}}' $B/my/summary_json | python3 -m json.tool
# 2) As a guest (expect the Session Expired error):
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{}}' $B/my/summary_json
```

## Related (not part of this request)

- **Returns (`/my/returns`), Warranties (`/my/warranties`) and Support tickets (`/my/tickets`)**
  also exist only as HTML pages (checked 2026-09-25). They'll need JSON routes when their app
  screens are built. Separate requests.
- **Staging returns full Python tracebacks** (with server file paths) in JSON-RPC errors.
  Please turn off debug error output on public servers.

## Mobile app side (for reference)

- Screen: `src/app/(tabs)/account.tsx`. Address, phone, gift-card count and wallet balance show
  a "Not available yet" badge.
- Data: `src/api/session.ts` (`fetchSession`). An account-summary call would be added next to it.
