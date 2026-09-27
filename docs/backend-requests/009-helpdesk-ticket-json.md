# Backend request 009 — JSON endpoint for submitting a helpdesk ticket

**Status:** Open — blocks sending from the mobile app's "Submit a Ticket" screen ("Submit Ticket" is
disabled until this ships)
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–008 have the same background (008 is
the same kind of request for the Contact Us form).

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie, obtained via the web login), then calls
existing Odoo routes with that session. It only displays what the backend returns.

## The problem

The ticket form is Odoo's standard **website form** (`website` + `helpdesk` modules). Checked on
staging 2026-09-27, signed in as a test customer (the page also works for guests):

- **Page:** `GET /helpdesk` → 302 → `/helpdesk/customer-care-1`, heading "Submit a Ticket".
- **Form:** `<form id="helpdesk_ticket_form" action="/website/form/" enctype="multipart/form-data"
  data-model_name="helpdesk.ticket" data-success-mode="redirect"
  data-success-page="/your-ticket-has-been-submitted">`. The page's script sends it in the
  background (XHR) to **`/website/form/helpdesk.ticket`**, adding the page's `csrf_token`, and
  sets the hidden `team_id` to **1** from `<span data-for="helpdesk_ticket_form"
  data-values="{'team_id': 1}">`. On success the browser goes to
  `/your-ticket-has-been-submitted` ("Thank you! Go to Homepage").
- **Fields, exactly as the page renders them:**

  | Label | `name` | Type | Required | Pre-filled for a signed-in customer |
  |---|---|---|---|---|
  | Full Name * | `partner_name` | text | yes | name |
  | Phone Number | `partner_phone` | tel | no | phone |
  | Email Address * | `partner_email` | email | yes | email |
  | Company Name | `partner_company_name` | text | no | commercial company name |
  | Message Subject * | `name` | text | yes | — |
  | Ask Your Question * | `description` | textarea | yes | — |
  | Attachment | `Attachment` | file | no | — |
  | Helpdesk Team (hidden) | `team_id` | hidden | yes (server-side) | 1, set by script |

  Button: "Submit Ticket".
- **Direct requests:**
  - Multipart POST **without** `csrf_token` → **400** (HTML error page).
  - JSON-RPC POST to `/website/form/helpdesk.ticket` → **400** (HTML error page).
  - Multipart POST **with** a `csrf_token` read from the page and every field empty →
    **200** with body `{"error_fields": ["team_id", "name"]}` (sent as `text/html`), and **no
    ticket was created** (`/my/tickets` still shows none).
- So the route *can* be called from outside the page, but only by first loading the HTML page to
  scrape a `csrf_token` (the same workaround the app is forced to use for login), and it answers
  with Odoo's generic website-form responses (`{"id": …}` / `{"error_fields": […]}` / `{"error":
  …}`) as `text/html`. A **successful** submission from the app has not been tested, because it
  would create a real ticket on staging.

## Impact

Until there's a supported way to submit, the app's **"Submit a Ticket" screen shows the form with
every field and "Submit Ticket" disabled ("Coming soon")**, so customers can't open a support
ticket from the app.

## Request

A JSON route for the signed-in customer (and guests, like the page) that creates the ticket
exactly as the website form does, with the **same field names**:

| | |
|---|---|
| Route | `/helpdesk/ticket/submit_json` (suggested name) |
| Type | `type='json'`, `methods=['POST']` |
| Auth | Same as `/helpdesk/customer-care-1` today |
| Params | `partner_name`, `partner_phone`, `partner_email`, `partner_company_name`, `name`, `description`, optional `attachments` (list of `{filename, data (base64)}`), optional `lang` |
| Team | Set server-side (team 1, as the page does) — the app shouldn't have to know team ids |

```jsonc
// params — the website form's own field names
{
  "partner_name": "David Miller",          // required
  "partner_phone": "",                     // optional
  "partner_email": "customer@example.com", // required
  "partner_company_name": "",              // optional
  "name": "Question about my order",       // required ("Message Subject")
  "description": "Hello, …",               // required ("Ask Your Question")
  "attachments": [ { "filename": "photo.jpg", "data": "<base64>" } ]   // optional
}

// success
{ "success": true, "ticket": { "id": 12, "reference": "…" }, "message": "…" }  // what the site shows after sending

// validation error — same rules as the website, per field, translated with `lang`
{ "success": false, "errors": { "partner_email": "…", "description": "…" } }

// anything else
{ "success": false, "error": "…" }
```

Alternatively: confirm that calling `/website/form/helpdesk.ticket` directly (with a token the
app can get **without** loading HTML, e.g. from a JSON route) is supported, and document its
responses. Either is fine; say which.

## Acceptance criteria

1. A valid call creates exactly the ticket the website form creates (same team, same fields,
   linked to the signed-in customer), and the ticket then appears in `/my/tickets`.
2. Missing required fields or an invalid email return `success: false` with per-field messages
   and create nothing.
3. Always returns JSON (never an HTML page or a traceback).
4. A quick retry of the same request doesn't create two tickets — or the doc says it does.
5. Attachments are stored on the ticket like the website form's "Attachment".
6. The existing `/helpdesk/customer-care-1` page and its form keep working unchanged.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# Signed in (session cookie in $J):
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"partner_name":"Test","partner_email":"test@example.com","name":"Test","description":"Test from the JSON route"}}' \
  $B/helpdesk/ticket/submit_json | python3 -m json.tool
```

## Related (not part of this request)

- **Default demo text:** the page's "About our team" box is Odoo's demo copy ("We provide 24/7
  support, Monday through Friday … We can also assist in Spanish, French, and Dutch."). The app
  doesn't show it.
- **Tickets list:** `/my/tickets` exists (currently empty for the test customer). Showing tickets
  and their status in the app will need its own read route later.

## Mobile app side (for reference)

- Screen: `src/app/helpdesk.tsx`, opened from the Account tab's "Submit a Ticket" card. Every field
  and "Submit Ticket" are disabled ("Coming soon"); nothing is sent. Name and email are pre-filled
  from the session, like the website.
- When the route ships, the app will enable the fields, send the params above and show the
  backend's `message` / `errors` — never its own success text.
