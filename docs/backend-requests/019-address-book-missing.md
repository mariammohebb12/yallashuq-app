# Backend request 019 — Customer address book (list, add, edit, delete) is missing

**Status:** Open — blocks the mobile app's standalone address book screen (not built). Updated 2026-09-30: delete added on production; list still missing
**Requested:** 2026-09-28
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–018 have the same background —
**013** covers the profile form (`/my/account`), which edits only the customer's one main
address.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It only
displays what the backend returns. The app's scope includes address management: add, edit and
delete saved addresses.

## What exists today (checked 2026-09-28)

**There is no address book page.** `/my/addresses` and `/my/address` answer 404 on live and
staging (a real signed-in route would redirect to login), and the customer's account page (`/my`)
has no Addresses card.

The only address routes are **standard Odoo 18 checkout routes** (`website_sale`), identical on
live and staging:

| Action | Route | Notes |
|---|---|---|
| Add/edit form | `GET /shop/address?address_type=delivery\|billing[&partner_id=N]` | HTML page. Only works with an active cart (signed out / no cart → redirect to `/shop`). |
| Save (add or edit) | `POST /shop/address/submit` | Form-encoded + `csrf_token`. Replies with JSON: `{"successUrl": "/shop/checkout"}` or `{"invalid_fields": [...], "messages": [...]}` |
| Choose the cart's address | JSON-RPC `/shop/update_address` `{address_type, partner_id}` | Checkout only |
| **Delete / archive** | **none** | Not on any page, not in the site's JavaScript |

Save form fields: `name`, `email`, `phone`, `street`, `delivery_location_address` +
`delivery_latitude` / `delivery_longitude` (custom map field), `street2`, `city`, `zip`,
`country_id`, `state_id`, plus hidden `address_type`, `partner_id` (edit only),
`use_delivery_as_billing`, `required_fields`.

Tested on staging with the test customer (nothing changed):

| Request | Result |
|---|---|
| Save without `csrf_token` | 400 |
| Save a new address, all fields empty | `{"invalid_fields": ["name","phone","street","country_id","city"], "messages": ["Some required fields are empty."]}` |
| Edit another customer's address (`partner_id=3`) | 403 |
| Re-save own address (partner 66) with identical values | `{"successUrl": "/shop/checkout"}` |
| `/shop/update_address` with another customer's partner | Forbidden (staging also leaks a full Python traceback) |

## Update 2026-09-30 — delete route added, list still missing

A delete route now exists **on production only**, as relayed by the project owner:
`POST /my/address/delete` (form-encoded, takes `address_id`; redirects to
`/my/addresses?address_deleted=1`, or `/my/addresses?error=cannot_delete_primary` for the main
contact). Checked 2026-09-30:

| Route | Staging | Production |
|---|---|---|
| `/my/address/delete` | 404 | exists (GET → 405, i.e. POST only) |
| `/my/addresses` (HTML list) | 404 | **404** (a real signed-in route would redirect to login) |
| JSON list — tried `/my/addresses/json`, `/my/address/json`, `/api/my/addresses`, `/my/addresses/list` (JSON-RPC, signed in on staging) | 404 | 404 |

So:

- **Gap 1 (list) is still open, and now blocks delete too**: the app has no way to get the
  `address_id`s a customer could delete. Route 1 below is still needed; the delete route can't be
  used without it.
- **The delete route redirects to a page that doesn't exist**: `/my/addresses` is a 404 on
  production, so a website user who deletes an address lands on "Page Not Found". Either add the
  `/my/addresses` page or redirect somewhere that exists.
- Delete is form-post + redirect (needs a `csrf_token`), not JSON — item 4 below still asks for a
  JSON reply. Please confirm it **archives** (not hard-deletes) and refuses other customers'
  addresses (403), per the acceptance criteria.
- Not deployed on staging yet, so none of it can be tested safely.

## The gaps

1. **No address list** outside checkout. The saved addresses only appear as HTML cards on
   `/shop/checkout`, and only while the customer has a cart.
2. **No JSON add/edit.** `/shop/address/submit` replies in JSON but needs a CSRF token scraped from
   the HTML form, and only works while there's a cart. Saving a *delivery* address there also makes
   it the cart's delivery address (a checkout side effect an address book shouldn't have).
3. **No delete at all.** A customer can never remove an address — on the website or anywhere else.
4. **No safe delete rules.** Addresses already used by orders/invoices must stay intact for those
   records (Odoo normally archives rather than deletes them).

## Request

Additive routes only (no change to the checkout routes the website uses), on **staging first**:

1. **List:** `GET` (or JSON-RPC) e.g. `/api/my/addresses` → the signed-in customer's addresses:
   `id, type (main / delivery / billing), name, email, phone, street, street2, city, zip,
   country {id, name}, state {id, name}, is_default`. No cart required.
2. **Add:** JSON e.g. `/api/my/addresses/create` → `{ success, address }` or
   `{ success: false, invalid_fields, messages }` (same validation as checkout). Must not change
   any cart.
3. **Edit:** JSON e.g. `/api/my/addresses/<id>/update` — same shape; only the customer's own
   addresses (403 otherwise).
4. **Delete:** JSON e.g. `/api/my/addresses/<id>/delete` — archive (not hard-delete) so past
   orders/invoices keep their address; refuse the customer's main contact; only own addresses.
5. Errors as JSON (no HTML error pages, no tracebacks).

Route names are suggestions — use whatever fits the codebase, and tell us.

## Acceptance criteria

1. Signed in, with **no cart**, the list route returns the customer's addresses as JSON.
2. Add / edit / delete work without a cart, never change a cart, and return JSON errors for
   invalid input.
3. Another customer's address id → 403 on edit and delete; guests → 401/redirect.
4. A deleted address disappears from the list and from checkout, but past orders still show it.
5. The existing website checkout (`/shop/address`, `/shop/address/submit`,
   `/shop/update_address`) behaves exactly as before.

## Mobile app side (for reference)

- The standalone address book screen is **not built** — blocked on this request.
- Checkout's existing "Add address" screen (`src/app/checkout/address.tsx`) saves through the
  real `/shop/address/submit` (wired 2026-09-28), with the limits above: needs an active cart, and
  the new address becomes the cart's delivery address. The checkout address *list* in the app is
  still sample data until route 1 exists.
