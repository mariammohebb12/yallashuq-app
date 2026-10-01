# Backend request 021 — MishMesh assistant: unreliable, over-claims, no timeout

**Status:** Open — BUG / quality. Partly improved on production (see "Update 2026-10-01"); the
app's MishMesh popup is now wired to the real route (with its own 30 s timeout).
**Requested:** 2026-09-28
**For:** whoever takes over YallaShuq backend development

## Update 2026-10-01 — where this stands

Checked on production (logged out) and in the backend code (`odoo_inventory_engine`,
`ai_assistance`, `mishmesh_helpdesk_support`):

| Item | Status |
|---|---|
| 2. Slow / unreliable replies | **Better:** "hello" answered in ~5 s, a follow-up with history in ~7 s (were 50–90 s). Still no guarantee — see item 5. |
| 3. "Track orders" over-claim | **Fixed in the reply seen:** the greeting now says tracking and returns need the customer to log in. Refund/payment wording not re-tested. |
| 4. Example prompt can't work | **STILL OPEN.** The website and the app (copied from it) still suggest *"I want chairs for my dining room"*, and the catalog still has no chairs (production lists 2 products), so the suggested first message finds nothing. Replace the examples with ones the catalog can answer, or make them configurable. |
| 5. No server-side timeout | **STILL OPEN.** The OpenAI call in `ai_assistance/models/ai_chat.py` (`get_storefront_response`) has no `timeout`, so the route can still hang. The app now gives up after 30 s on its own. |
| 6. Handoff from the chat | **Built in the backend, not verified:** `mishmesh_helpdesk_support` (commit `f756149`) now runs the ticket + channel escalation for the website/app channel and replies with text. Not tried on production on purpose (it would create a real ticket); guest behaviour unknown. |
| New: error replies | `{status: "error", message}` returns the raw Python exception text (`str(e)`) — should be a fixed, user-safe message. |

**App-side gap (mobile, not backend) — slow-reply feedback.** While waiting, the app shows only the
website's "..." bubble, for up to 30 s, with no sign that a slow reply is still expected (no
skeleton, no "still thinking…" after a few seconds, no cancel). With replies of 5–7 s today (and
50–90 s historically) this reads as frozen. Worth a proper loading state when MishMesh's
reliability is revisited — wording and design to be confirmed with the client first.

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–020 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. Its scope
says MishMesh is for **product discovery only**: it must **not** perform refunds or payment actions,
and must hand over to human support when needed.

## What exists

The website's "MISHMESH SHOPPING ASSISTANT" popup (addon `odoo_inventory_engine`, script
`/odoo_inventory_engine/static/src/js/inventory_chat.js`, identical on live and staging) calls:

- **JSON-RPC `POST /inventory_engine/chat`** with
  `{ "query": "<message>", "history": [{ "role": "user" | "assistant", "content": "..." }] }`
- → `{ "status": "success", "ai_message": "<text>", "results": [<products>] }` (plus
  `product_data` for the seller-side form-fill tool). Products have the same fields as
  `/inventory/search/query` (`id, name, price, currency, qty, seller, category, url, image, …`).
- Public (guests allowed). `GET` → 400.

The popup's intro says: *"Tell me what you want to buy — I can help you find products fast. Try
something like “I want chairs for my dining room”, “show warranty products”."*

## What was tested (2026-09-28, guest, requests identical to the popup's)

**Live**

| Message | Time | Reply |
|---|---|---|
| "I want chairs for my dining room" (the popup's own example) | 0.6 s | *"I could not find matching products in our local inventory or active affiliate partner listings right now. Please try a different product name or check again later."* — 0 products |
| "headphones" | 0.5 s | *"I found these products for you:"* + Wireless Bluetooth Headphones ₪2,000 |
| "I want something to listen to music" | 0.4 s | same "could not find" text — 0 products |
| "hello" | **50 s, then 90 s** on a retry (one attempt passed a 30 s client timeout) | *"Hello Guest! I am MishMesh, your YallaShuq Shopping Assistant. How can I help you today? I can help you find products, **track orders**, or answer questions about our services."* |
| "what is your return policy?" | **21 s, then 80 s** | *"Hi! I am MishMesh. I'm having a bit of trouble connecting to my knowledge base right now I've found some products for you below!"* — **0 products** |

So on live, product words are answered instantly by **keyword matching** (the same engine as
`/inventory/search/query`) with fixed text, and conversational messages go to a slow AI service
that sometimes fails.

**Staging** — the AI part is off: every message (including "hello", a follow-up with history, and
"please refund my order S00073") got the same canned reply *"Hi! I am MishMesh. I'm currently
resting. Please check back later!"*. Keyword product results are still attached ("microwave" →
Microwave Oven), so staging does plain keyword matching only. The refund request caused no action.

## Human handoff (added 2026-09-28)

**Asking MishMesh for a human never hands off.** Tested as a guest:

| Message | Live | Staging |
|---|---|---|
| "I need to speak to a person" | 21 s → *"Hi! I am MishMesh. I'm having a bit of trouble connecting to my knowledge base right now I've found some products for you below!"* — 0 products | "I'm currently resting" |
| "connect me to support" | 20 s → same fallback + Wireless Bluetooth Headphones (matched on "support") | "I'm currently resting" + Badminton Racket |

No reply ever contains `mode: "human"` — the signal the website's own script
(`/mishmesh_helpdesk_support/static/src/js/mishmesh_support.js`) waits for to switch the popup into
a support chat.

**A real handoff mechanism does exist, but only outside the chat** (addon
`mishmesh_helpdesk_support`):

- **Entry point:** My Orders (`/my/orders`) shows a **"SUPPORT"** button on every order. It opens a
  "Need Support" modal ("Direct Contact admin-yallashaq@yopmail.com"; fields Subject, Name, Email,
  Phone, Details) that posts an HTML form to **`POST /my/orders/<order_id>/mishmesh_support`**
  (`csrf_token, subject, name, email, phone, message`; `GET` → 405). Individual order pages have
  no such button.
- **Session routes** (JSON-RPC; the website polls status every 8 s):

| Route | Params | Reply |
|---|---|---|
| `/mishmesh/support/status` | `{}` | `{active: false}`, or `{active: true, channel_id, ticket_id, ticket_name, is_accepted}` |
| `/mishmesh/support/messages` | `{channel_id, after_id}` | `{active, channel_id, ticket_id, messages: [{id, body, author, is_customer}]}` |
| `/mishmesh/support/send` | `{channel_id, message}` | `{status: "success"}` or `{status: "error", message}` |

**Real test on staging (test customer, one submission, marked "App test – please ignore"):**
order S00073 → `303` to `/my/orders?mishmesh_support_ticket=24`, and:

- a **Helpdesk ticket #24** "App test – please ignore (#24)" was created, stage **New**, listed
  under the customer's `/my/tickets` (count 0 → 1), page `/helpdesk/ticket/24` showing "Order
  Support Request — Order: S00073" with the form's details;
- `/mishmesh/support/status` → `{"active": true, "channel_id": 24, "ticket_id": 24,
  "ticket_name": "App test – please ignore (#24)", "is_accepted": false}` (the website shows this
  as "Awaiting Agent");
- `/mishmesh/support/messages` → `messages: []` (the form's message is on the ticket, not in the
  chat);
- `/mishmesh/support/send` from the customer → `{"status": "error", "message": "No active support
  session found."}` while not accepted — so the customer can't write until an agent accepts
  (presumably; not confirmed from outside);
- a guest gets `active: false` for channel 24 and can't send (ownership enforced);
- the MishMesh chat itself still answered "I'm currently resting" during the session.

**Staging cleanup needed:** ticket #24 is a test ticket — please close it.

## The problems

1. **Staging has no AI** — only keyword matching behind a "resting" message, so nothing
   conversational can be developed or tested there.
2. **Live is unreliable**: conversational replies take **20–90 seconds** and sometimes fail with a
   fallback that promises products and shows none.
3. **Over-claiming**: the live greeting says MishMesh can **"track orders"** — it can't (there is no
   tracking behind it; `/api/delivery/track` is a stub that returns a fixed
   `{"status":"shipped","shipping_cost":45.0}` for anything). It must also never claim it can
   handle **refunds or payments** — by scope it must not perform them. (A refund claim wasn't seen
   in these tests; this is a requirement, not an observed reply.)
4. **The example prompt can't work**: "I want chairs for my dining room" returns nothing — the
   catalog has no chairs.
5. **No timeout / error message**: the route can hang for 90 s instead of answering or failing
   cleanly.
6. **No handoff from the chat**: asking MishMesh for a person gives a canned reply and unrelated
   products. The real support session (ticket + chat) can only be started from the separate
   "SUPPORT" button in My Orders, which is completely disconnected from the conversation. Also,
   once a session exists the customer can't send a message until an agent accepts it, and the
   order support form is HTML-only (needs a scraped CSRF token).

## Request

On **staging first** (`develop` branch). Items 2, 3 and 5 change existing behaviour, so they need a
decision before code is changed:

1. Enable the AI on staging (with a test key/budget) so it matches live.
2. Server-side timeout (e.g. ≤ 10–15 s) for the AI call; on timeout or error return quickly with
   `status: "error"` and a clear message (e.g. "MishMesh is unavailable right now — try searching
   instead"), never a reply that promises products it doesn't include.
3. Restrict the assistant's instructions/prompt to what it can really do: product discovery.
   Remove "track orders" and any claim about refunds, payments, returns or order changes; for those,
   point the customer to the right page or to human support.
4. Human handover: a documented way (field in the reply, e.g. `handover: true`, or a route) for the
   app to offer "Talk to support" when MishMesh can't help.
5. Replace or remove the example prompt ("I want chairs for my dining room") with ones the catalog
   can answer, or make the examples configurable.
6. **Handoff from the chat:** when the customer asks for a person (or MishMesh can't help), start
   the real support session — the same ticket + channel the order "SUPPORT" form creates — and
   return `mode: "human"` (plus `channel_id` / `ticket_id`) in the `/inventory_engine/chat` reply,
   so the existing `/mishmesh/support/status`, `/mishmesh/support/messages` and
   `/mishmesh/support/send` routes take over. Guests: ask them to sign in (or collect contact
   details) rather than silently failing. Please also say whether the customer should be able to
   write before an agent accepts (today `send` refuses).
7. Additive: a JSON-RPC version of the order support form (`order_id, subject, message` →
   `{ticket_id, channel_id}` or errors), so the app doesn't have to scrape the CSRF token.

## Acceptance criteria

1. On staging, a conversational message gets a real (non-canned) reply.
2. Every reply arrives within the agreed timeout; a failure gives `status: "error"` + a message.
3. No reply claims order tracking, refunds, payments or order changes; asking for them leads to a
   pointer to the right page or to human support, and nothing is performed.
4. The popup's example prompts return real products.
5. The existing keyword product results keep working as today.
6. Asking MishMesh "I need to speak to a person" / "connect me to support" (signed in) no longer
   gives a canned product-search reply: it starts a real support session (ticket + channel) and
   the reply says so with `mode: "human"`. Right after, `/mishmesh/support/status` returns
   `active: true` with that `channel_id` / `ticket_id`, and `/mishmesh/support/messages` and
   `/mishmesh/support/send` work for that session (the customer can post a message and read the
   agent's reply).
7. The order "SUPPORT" button in My Orders keeps working as today.

## Mobile app side (for reference)

- `src/components/mishmesh-chat.tsx` calls `/inventory_engine/chat` (wired 2026-10-01, commit
  `784ffb1`, via `src/api/mishmesh-chat.ts`): real replies, product results as Smart Search-style
  rows, a 30 s client timeout, and the switch to human support mode when a session exists.
  Staging's AI is still off ("I'm currently resting"), so conversation can only be tried on
  production.
- Related: Smart Search (`src/app/smart-search.tsx`) already uses the keyword route
  `/inventory/search/query`, which works.
