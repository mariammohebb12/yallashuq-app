# Backend request 022 — Customer notifications are completely missing (no inbox, no push)

**Status:** Partly done — the inbox storage + routes exist on production (2026-10-01, see
"Update" below) and the app's inbox is built on them. Still open: nothing creates notifications,
and there is no push.
**Requested:** 2026-09-28
**For:** whoever takes over YallaShuq backend development

## Update 2026-10-01 — inbox routes shipped (production only)

Commit `f756149` (`yallashuq_seller`) added the model `yallashuq.notification` (partner, title,
body, type ∈ order/warranty/return/promotional/support/general, is_read, read_date, optional
res_model/res_id link) and three `auth='user'` JSON-RPC routes:

- `/my/notifications/json` `{page, limit ≤ 50, unread_only}` → `{status, page, page_count,
  total_count, unread_count, notifications: [{id, title, body, type, is_read, created_at,
  res_model, res_id}]}`
- `/my/notifications/<id>/read` → `{status}` · `/my/notifications/read_all` → `{status, marked_count}`

On production they exist (signed out → "Session Expired"); staging is a 404. The model is new, so
the module must be **upgraded** on each server (`-u yallashuq_seller`) or signed-in calls fail.

The app's inbox (bell in the main tabs' header with the unread count, list, tap = mark read +
open the linked order/return, "Mark all as read") uses them; sample data only on a 404.

Still open:

1. **Nothing creates notifications.** `yallashuq.notification._notify()` has no callers: decide
   which events notify customers (order status Packing/Shipped/Delivered — after request 029 —,
   returns/refunds, warranty claims, support replies, promotions) and call it there.
2. **No push.** Nothing reaches the phone by itself; needs a provider/account decision (Firebase
   Cloud Messaging + APNs, OneSignal, or Expo push) plus a route to register device tokens.
3. **Links:** the app opens `sale.order` and `return.request` links; other models (warranty,
   tickets) have no app screen yet, so those notifications only mark read.
4. **Preferences** (which types a customer wants) — not in the model yet.

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–021 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. Its scope
includes notifications for: order status (packing / shipped / delivered), returns / refunds /
warranty, promotional messages, an in-app inbox with history, notification preferences, and push
notifications.

## What exists today (checked 2026-09-28, live and staging)

**Nothing customer-facing.**

- **No bell, no inbox, no notifications page** on live or staging (home, product page, and signed in
  on staging: `/my`, `/my/account`, `/my/orders/<id>`). Order pages have a "Communication history"
  section that is empty.
- **No notification routes**: `/my/notifications`, `/api/notifications`, `/api/push/register`,
  `/mobile/register_device` → 404.
- **Odoo's built-in messaging gives customers nothing usable:**
  - `/mail/inbox/messages` (staff inbox) → `{"messages": []}` for the customer; guests → "Session
    expired".
  - `/mail/data` `{fetch_params: ["init_messaging"]}` → `{}`.
  - `/mail/thread/messages` on each of the test customer's 13 orders → exactly **one empty system
    message** each; **no status-change messages** (Packing / Shipped / Delivered) are posted.
- **No push service anywhere:** no Firebase / FCM, APNs, OneSignal or Expo push in the site's
  JavaScript, and none configured in the mobile app project.
- **Only Odoo's standard *browser* web push exists** (`/web/service-worker.js`, model
  `mail.push.device` "Push Notification Device", a VAPID public key is set). It serves Odoo's
  internal chat in web browsers, customers can't access the device model ("Administration/Settings"
  only), and it can't deliver native iOS/Android push.

Related, not notifications for the app:
- `/marketplace/delivery/whatsapp/update` exists (GET → 400; not called — it may send messages or
  change a delivery). WhatsApp sending is not configured on the backend.
- Emails (order confirmation etc.) are standard Odoo, but emails currently don't arrive on staging
  (outgoing mail server / email queue — see the known blockers).
- `/shop/add/stock_notification` is Odoo's standard back-in-stock **email** sign-up.

## Request

Additive only, on **staging first**:

1. **Notification record** per customer: `id, type (order_status / return / refund / warranty /
   promo / support), title, body, related record (e.g. order id + name), created_at, read`.
   Created by the backend when the event happens (order status change, return/refund/warranty
   update, …). Note: order status notifications depend on the known status bug (orders can become
   "Delivered" at confirmation) being fixed first.
2. **JSON routes** (signed-in customer only, own records only):
   - list, paginated, newest first, with unread count;
   - mark one / all as read;
   - read and save **preferences** (per type on/off, including promotional opt-in).
3. **Device registration** for native push: register / unregister a device token
   (`{token, platform: ios|android, app_version}`), tied to the customer; removed on logout.
4. **Push delivery** through a real service — Expo Push (simplest for this Expo app), or Firebase
   Cloud Messaging + APNs — sending each new notification to the customer's devices, respecting
   their preferences. Credentials/keys configured on staging and live.
5. Errors as JSON; route names are suggestions — use what fits the codebase and tell us.

## Acceptance criteria

1. Changing a test order's status on staging creates a notification for its customer, visible via
   the list route with `read: false`.
2. Mark-as-read updates the unread count; another customer's notification id → 403.
3. Preferences are saved and respected (a disabled type creates no push).
4. A registered test device receives a push for the new notification.
5. Nothing changes on the existing website.

## Mobile app side (for reference)

Nothing built. Notifications (inbox, badges, preferences, push) stay out of the app until this
exists on staging. The app project has no push library or push credentials yet — those will be
added when the backend side is ready.
