# Backend request 008 — JSON endpoint for the Contact Us form

**Status:** Open — blocks sending from the mobile app's Contact Us screen ("Submit Message" is
disabled until this ships)
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–007 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie, obtained via the web login), then calls
existing Odoo routes with that session. It only displays what the backend returns.

## The problem

The Contact Us form can only be sent as a **full-page HTML form post**. Re-verified on staging
2026-09-27 (signed in as a test customer; the page is the same for guests):

- **Page:** `GET /contactus` → 200. Heading "Contact Us", intro "Share your query and our team will
  get back to you quickly.", button "Submit Message".
- **Form:** `<form action="/contactus/submit" method="post">`, default encoding
  (`application/x-www-form-urlencoded`), with a hidden `csrf_token`. Its fields, exactly as the
  page renders them:

  | Label | `name` | Type | Required |
  |---|---|---|---|
  | Full Name | `name` | text | yes |
  | Email | `email` | email | yes |
  | Phone | `phone` | text | no |
  | Subject | `subject` | text | no |
  | Message | `message_text` | textarea | yes |

  No field is pre-filled, even when signed in.
- **Direct requests are rejected:**
  - JSON-RPC `POST /contactus/submit` (`Content-Type: application/json`) → **400**, HTML error page.
  - Form post without `csrf_token` → **400**, HTML error page.
  - `GET /contactus/submit` → **405**.
  - The 400 page doesn't show the reason (it's the generic "Oops! Something went wrong" page).
    It's most likely Odoo's CSRF check on an `http` route, but that isn't confirmed.
- The site's JavaScript doesn't submit this form any other way; it's a normal browser form post
  that reloads the page.
- **Not tested:** a real submission (with a valid `csrf_token`), because it would create a real
  enquiry on staging. So what a successful submit creates (lead, ticket, email…) and what the
  customer sees afterwards (thank-you page, message, redirect) are **unknown** — please document
  both.

## Impact

The app can't send a Contact Us message without loading and parsing the HTML page for a
`csrf_token` and replaying the browser's form post (the workaround the app is forced to use for
login today). Until a JSON route exists, the app's **Contact Us screen shows the form with every
field and "Submit Message" disabled ("Coming soon")**, so customers can't contact support from
the app.

## Request

One JSON route that does exactly what the website form does, with the **same field names**.

| | |
|---|---|
| Route | `/contactus/submit_json` (suggested name; any name works, as long as it's documented) |
| Type | `type='json'`, `methods=['POST']` |
| Auth | Same as `/contactus` today (the page works for guests and signed-in customers) |
| Params | `name`, `email`, `phone`, `subject`, `message_text` (optional `lang`) |
| Side effects | The same record / email / notification the website form creates — nothing else |

```jsonc
// params — the website form's own field names
{
  "name": "David Miller",            // required
  "email": "customer@example.com",   // required
  "phone": "+972 50 000 0000",        // optional
  "subject": "Question about my order",   // optional
  "message_text": "Hello, …"          // required
}

// success
{ "success": true, "message": "…" }   // the confirmation text the website shows after sending

// validation error — same rules as the website, one message per field, translated with `lang`
{ "success": false, "errors": { "email": "…", "message_text": "…" } }

// anything else (e.g. spam protection, server error)
{ "success": false, "error": "…" }
```

Please include the same spam/abuse protection the website form has (or add some if it has none
— e.g. rate limiting per IP / per session), since a JSON route is easier to call in bulk.

## Acceptance criteria

1. A valid call creates exactly what the website form creates for the same input (same model,
   same fields, same notification), and returns `success: true`.
2. Missing `name`, `email` or `message_text`, or an invalid email, returns `success: false` with a
   per-field message and creates nothing.
3. Works for a guest and for a signed-in customer, like `/contactus`.
4. Returns JSON in every case (never an HTML page or a traceback).
5. Sending the same request twice quickly (a network retry) doesn't create two enquiries — or the
   doc says it does, so the app can guard against it.
6. The existing `/contactus` page and `/contactus/submit` keep working unchanged.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"name":"Test","email":"test@example.com","phone":"","subject":"Test","message_text":"Test from the JSON route"}}' \
  $B/contactus/submit_json | python3 -m json.tool
# Missing message_text → success: false with errors.message_text
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"name":"Test","email":"test@example.com"}}' \
  $B/contactus/submit_json | python3 -m json.tool
```

## Related (not part of this request)

- **Demo contact details.** `/contactus` shows "Support: +1 555-555-5556" and
  "Email: admin-yallashaq@yopmail.com" (staging test values); the site's 400/404 error pages still
  show Odoo's default demo footer ("info@yourcompany.example.com", "We are a team of passionate
  people…"). The app doesn't show these until real values exist.
- The header's "Contact Support" link and the footer's "Contact Us" both go to `/contactus`; the
  helpdesk ticket form (`/helpdesk/customer-care-1`, "Submit a Ticket") is a separate form.

## Mobile app side (for reference)

- Screen: `src/app/contactus.tsx`, opened from the Account tab's "Contact Us" card. Every field and
  "Submit Message" are disabled ("Coming soon") until this route ships; nothing is sent.
- When the route ships, the app will enable the fields, send the five params above and show the
  backend's `message` / `errors` — never its own success text.
