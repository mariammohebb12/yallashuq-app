# Backend request 021 — MishMesh assistant: unreliable, over-claims, no timeout

**Status:** Open — BUG / quality. Blocks wiring the mobile app's MishMesh popup (it stays a visual
shell until this is fixed)
**Requested:** 2026-09-28
**For:** whoever takes over YallaShuq backend development

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

## Acceptance criteria

1. On staging, a conversational message gets a real (non-canned) reply.
2. Every reply arrives within the agreed timeout; a failure gives `status: "error"` + a message.
3. No reply claims order tracking, refunds, payments or order changes; asking for them leads to a
   pointer to the right page or to human support, and nothing is performed.
4. The popup's example prompts return real products.
5. The existing keyword product results keep working as today.

## Mobile app side (for reference)

- `src/components/mishmesh-chat.tsx` is a **visual shell** (no calls to `/inventory_engine/chat`).
  It stays that way until this request is fixed and confirmed on staging.
- Related: Smart Search (`src/app/smart-search.tsx`) already uses the keyword route
  `/inventory/search/query`, which works.
