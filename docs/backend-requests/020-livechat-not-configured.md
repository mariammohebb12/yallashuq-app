# Backend request 020 — Livechat is not configured (nobody will ever answer)

**Status:** Open — CONFIGURATION gap (not a code gap). Blocks any Livechat feature in the mobile
app (nothing built)
**Requested:** 2026-09-28
**For:** whoever administers the YallaShuq Odoo backend (Settings / Website / Live Chat)

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–019 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. Its scope
includes customer support chat with AI-to-human handover.

## What exists (checked 2026-09-28, live and staging identical)

- **`/livechat`** loads (200) but is Odoo's standard channel list page and says:
  *"There are no public livechat channels to show."*
- There is **one** Live Chat channel (id 1), still on **Odoo's untouched defaults**: name
  "YourWebsite.com", default purple colours (`#875A7B`), button text "Have a Question? Chat with
  us.", welcome message "Hello, how may I help you?". Its standalone page
  `/im_livechat/support/1` shows "YourWebsite.com — Website Live Chat — Powered by Odoo".
- The read-only availability check, JSON-RPC **`/im_livechat/init`** `{ "channel_id": 1 }`, returns
  **`"available_for_me": false`** and **`"rule": {}`** on live and staging, for guests and for a
  signed-in customer. So the chat button never appears and no conversation can start.
- No chat session was started during testing (it could notify a real operator).

(The chat-like widgets customers do see — the MishMesh shopping assistant and the "YallaShuq
Support" ticket widget — are separate features and not affected by this.)

## The gap

There is nothing to connect to: no operator is assigned/available and no chatbot or rule is set
on the channel, so any message a customer sent would never be answered. This is **configuration,
not code** — Odoo's Live Chat module is installed and working.

## Request

On **staging first**, then live:

1. Configure channel 1 (or a new channel) for YallaShuq: real name, YallaShuq colours
   (`#f28316` / `#1b1208`), welcome message and button text (to be confirmed with the client).
2. Assign **operators** (real support staff, with working hours) **and/or** a **chatbot**
   (Odoo Live Chat › Chatbots) so a customer always gets an answer or a clear "we're offline"
   message.
3. Add **channel rules** (Live Chat › Channels › Rules) for the pages/countries where chat should
   show.
4. Tell us who answers, in which languages (English, Arabic, Hebrew, Russian), and during which
   hours.

Once that works on the website, the app will need a way to use it (a separate, later request):
start a session, send/receive messages, and hand over from the MishMesh assistant to a human.

## Acceptance criteria

1. On staging, `/im_livechat/init` for the configured channel returns `available_for_me: true`
   (during operator hours, or always when a chatbot is set).
2. A test chat started from the website gets a reply from the operator or chatbot.
3. Outside operator hours the customer sees an offline message (or the chatbot), never silence.
4. Same checks on live before the app builds anything.

## Mobile app side (for reference)

Nothing built. Livechat stays out of the app until this is configured and confirmed.
