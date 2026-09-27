# Backend request 013 — JSON endpoints to read and update the customer's profile (/my/account)

**Status:** Open — blocks the mobile app's "My account" profile screen ("Save Profile" is disabled
and the fields can't be filled with the customer's details until this ships)
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–012 have the same background. Request
004 already asks for a read-only account summary (address, phone, gift cards, wallet); this one
covers the **editable profile form** — the two can share one read route.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie), then calls existing Odoo routes with that
session. It only displays what the backend returns.

## The problem

Checked on staging 2026-09-27, signed in as a test customer (no profile value was changed):

- **`/my/account`** (guests → `/web/login`; title "Contact Details", heading "My account", intro
  "Manage your profile, address details, and password in one place.").
- **Profile form:** `<form action="/my/account" method="post" enctype="multipart/form-data">`
  (class `o_portal_details`), hidden `csrf_token`, `remove_profile_image`, `redirect`. Fields in
  page order, pre-filled with the customer's current values:

  | Label | `name` | Type | Notes |
  |---|---|---|---|
  | Profile Photo | `profile_image` | file | |
  | First Name | `first_name` | text | |
  | Last Name | `last_name` | text | |
  | Email | `email` | email | |
  | Phone | `phone` | tel | |
  | Company Name | `company_name` | text | **disabled** |
  | VAT Number | `vat` | text | **disabled** |
  | Street | `street` | text | |
  | Street 2 | `street2` | text | |
  | State / Province | `state_id` | select | 1,787 states ("select..." first); filtered by country in the browser |
  | City | `city` | text | |
  | Country | `country_id` | select | **disabled**; 250 countries ("Country..." first) |
  | Zip / Postal Code | `zipcode` | text | |

  Note shown above the fields: "Company name, VAT Number and country can not be changed once
  document(s) have been issued for your account. Please contact us directly for that operation."
  No field carries a `required` attribute — which fields are required is only enforced
  server-side (unknown). Button: **"Save Profile"**.
- **Submitting:** a normal browser form post (page reload); the page's scripts don't send it any
  other way (the portal script only filters states by country).
  - JSON-RPC `POST /my/account` → **400** (HTML).
  - Multipart post without `csrf_token` → **400** (HTML).
  - `/my/account_json`, `/my/profile`, `/api/profile`, `/api/account`, `/my/account/json` → 404.
  - A real save wasn't attempted (it would change the test customer's profile), so the success
    and validation responses are unknown.
- The same page also has a second **"Change Password"** form (`/my/account/change_password`:
  `old`, `new1`, `new2`), separate from the one on `/my/security`. **Not part of this request** —
  see "Related".

## Impact

The app's profile screen shows the live fields but can't show the customer's current values
(only the email, from the session) or save changes. Every field and "Save Profile" are disabled
("Coming soon") until this ships.

## Request

Two JSON routes for the signed-in customer (`type='json'`, `methods=['POST']`, `auth='user'`;
optional `lang`), using the **same field names** as the form. Names are suggestions.

### Route 1 — read: `/my/account_json`

```jsonc
{
  "profile": {
    "first_name": "…", "last_name": "…", "email": "…", "phone": "…",
    "company_name": "…", "vat": "…",
    "street": "…", "street2": "…", "city": "…", "zipcode": "…",
    "state": { "id": 0, "name": "…" },       // null if none
    "country": { "id": 0, "name": "…" },     // null if none
    "profile_image_url": "/web/image/…"      // null if none
  },
  "locked_fields": ["company_name", "vat", "country_id"],   // exactly what the website disables
  "locked_note": "Company name, VAT Number and country can not be changed …",  // translated
  "required_fields": ["…"]                  // what the server requires on save
}
```

(States for a country can come from the existing `/web/signup/states` JSON route the app already
uses, if it returns the same list — please confirm.)

### Route 2 — save: `/my/account/save_json`

Params: any of `first_name`, `last_name`, `email`, `phone`, `street`, `street2`, `state_id`,
`city`, `zipcode`, plus `profile_image` (`{ filename, data (base64) }`) or
`remove_profile_image: true`. Locked fields are ignored or rejected exactly as the website does.

```jsonc
{ "success": true, "profile": { /* same shape as Route 1 */ }, "message": "…" }
{ "success": false, "errors": { "email": "…", "zipcode": "…" } }   // per field, translated
```

## Acceptance criteria

1. Route 1 returns exactly the values `/my/account` pre-fills for the same customer.
2. Route 2 saves exactly what the website form saves, with the same validation, and returns JSON
   in every case (never HTML or a traceback).
3. Company Name, VAT Number and Country can't be changed through Route 2 when the website
   blocks them.
4. Changing the email follows whatever the website does for the login (please document).
5. A customer can only read and change their own profile.
6. The existing `/my/account` page keeps working unchanged.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# Signed in (session cookie in $J):
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{}}' $B/my/account_json | python3 -m json.tool
```

## Related (not part of this request)

- **Two password-change forms:** `/my/account` (`/my/account/change_password`: Current Password,
  New Password, Confirm New Password) and `/my/security` (Password / New Password / Verify New
  Password, `op=password`). Please say which one is authoritative (or whether they're the same
  underneath) before a password route is requested. The app currently offers password changes
  only on its Security screen (disabled).

## Mobile app side (for reference)

- Screen: `src/app/my/edit-information.tsx`, opened by "Edit information" on the Account tab.
  Every field and "Save Profile" are disabled ("Coming soon"); only Email is filled (from the
  session). No password section on this screen.
- When these routes ship, the app will fill the fields from Route 1, enable the unlocked ones and
  save through Route 2, showing the backend's own messages.
