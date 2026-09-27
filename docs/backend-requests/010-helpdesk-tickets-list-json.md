# Backend request 010 — JSON endpoint for the customer's helpdesk tickets list

**Status:** Open — the mobile app's Tickets screen can only show the ticket *count* until this ships
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–009 have the same background (009 is
submitting a ticket; this one is reading them).

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It signs in
through Odoo's normal session (`session_id` cookie, obtained via the web login), then calls
existing Odoo routes with that session. It only displays what the backend returns.

## The problem

Checked on staging 2026-09-27, signed in as a test customer:

- **`/my/tickets`** (guests are redirected to `/web/login`): title "My Tickets", breadcrumb
  "Tickets", no heading. Controls: *Sort By* (Newest, Reference, Subject, Assigned to, Stage,
  Last Stage Update), *Filter By* (All, Assigned, Unassigned, Open, Closed), *Group By* (None,
  Assigned to, Helpdesk Team, Stage, Status, Customer) and a search box. The test customer has no
  tickets, so the page shows only: **"There are currently no Ticket for your account."** The
  table's row layout couldn't be seen.
- **What exists as JSON:** only the count — `POST /my/counters` with
  `{"counters": ["ticket_count"]}` → `{"ticket_count": 0}` (matches the page). The app uses this.
- **What doesn't:** a JSON call to `/my/tickets` → 400 (HTML); `/my/tickets_json`,
  `/my/ticket_json`, `/api/tickets`, `/api/helpdesk/tickets`, `/helpdesk/tickets`,
  `/my/tickets/json` → 404. The site's JavaScript calls no ticket routes.

## Impact

The app's Tickets screen shows the real count. With 0 tickets it shows the website's empty-state
text; with any tickets it can only say how many there are — it **can't list them, open one, or
show its stage** until this route exists.

## Request

Read-only JSON routes for the signed-in customer's own tickets (`type='json'`,
`methods=['POST']`, `auth='user'`; optional `lang`). Names are suggestions.

### Route 1 — list: `/my/tickets_json`

Params: `{ "page": 1, "limit": 20 }` (optional). Same tickets, same order (newest first) as
`/my/tickets`.

```jsonc
{
  "tickets": [
    {
      "id": 12,
      "reference": "…",                    // as the website shows it
      "subject": "Question about my order",
      "stage": { "id": 1, "name": "New" }, // translated
      "is_closed": false,
      "assigned_to": "…",                  // name only, or null
      "team": "Customer Care",
      "create_date_formatted": "09/27/2026",
      "last_stage_update_formatted": "09/27/2026"
    }
  ],
  "page": 1,
  "has_next": false,
  "total_count": 0                         // must equal /my/counters' ticket_count
}
```

### Route 2 — detail: `/my/ticket_json`

Params: `{ "ticket_id": 12 }`. Everything the website's ticket page shows the customer: the fields
above plus the question (`description`), attachments (name + download URL) and the public message
history (author, date, body). Customer-facing only — no internal notes.

## Acceptance criteria

1. As a guest: the standard "Session Expired" JSON-RPC error (not HTML).
2. The list matches `/my/tickets` for the same customer (same tickets, order, stages), and
   `total_count` equals `ticket_count` from `/my/counters`.
3. Customer A can't read customer B's tickets (access error).
4. The detail never includes internal notes or other customers' data.
5. Stage names are translated with `lang`.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# Signed in (session cookie in $J):
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{}}' $B/my/tickets_json | python3 -m json.tool
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"counters":["ticket_count"]}}' $B/my/counters
```

## Mobile app side (for reference)

- Screen: `src/app/my/tickets.tsx`, opened from the Account tab's "Tickets" card. It shows the
  count from `/my/counters` (`src/api/tickets.ts`, `fetchTicketCount`): the website's empty-state
  text at 0, otherwise "You have N tickets" with no list. No sample rows are ever shown.
- When Route 1 ships, the screen lists the tickets; Route 2 adds a ticket detail screen.
