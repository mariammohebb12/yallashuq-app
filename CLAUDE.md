# YallaShuq Mobile App — Project Context

## Project Overview
Customer mobile app (iOS + Android) for YallaShuq (yallashuq.com), a multi-seller marketplace
connecting customers with independent suppliers in Israel, the Palestinian Authority, and permitted
cross-border routes. The backend already exists (Odoo 18 Enterprise, custom addons) — this project
builds a native mobile app that connects to it. This is NOT a generic shopping app — it must
correctly reflect a real multi-seller marketplace: split orders, seller-specific delivery, commissions,
settlements, refunds vs. chargebacks, etc.

- Client: Basem Bahbah (non-technical)
- Backend built by: Oodles Technologies (Basem no longer working with them)
- Backend repo: github.com/pranavkakkar24/yallashuq (branch: develop)
- Live site: yallashuq.com
- Staging: yallashaq.oodleslab.com

## Tech Stack
- React Native (TypeScript preferred) + Expo, one codebase for Android and iOS
- Backend: Odoo 18 Enterprise with custom YallaShuq addons — connect through Odoo's existing
  HTTP/JSON routes (see "Existing Backend Routes" below). These routes exist today but are NOT yet
  fully mobile-ready: they need consistent auth, pagination, versioning and mobile-specific error
  handling. Do not assume they're production-ready as-is — flag issues as they're hit.

## Languages
English, Arabic, Hebrew, Russian.
- Full LTR support (English, Russian)
- Full RTL support (Arabic, Hebrew)
- UI must remain functional and correctly laid out when switching languages — build with this in
  mind from the start (no hardcoded left/right assumptions in layout).

## Design System (confirmed from live site source — not guessed)

### Colors
- Primary Orange: `#f28316`
- Light Orange: `#ffb36b`
- Dark: `#1b1208`
- Brand Gradient: `linear-gradient(135deg, #1b1208 0%, #f28316 55%, #ffb36b 100%)`

### Fonts
- Primary (used site-wide, forced with !important on nearly every page — headings AND body):
  `'Playfair Display Custom', serif`
- Secondary (small/muted text only, e.g. review labels): `'Archivo', sans-serif`

## Core Marketplace Concepts (must be reflected correctly in the app, not simplified away)
- **Multi-seller cart**: one cart can contain products from multiple sellers. Delivery is
  calculated separately per seller. Free-delivery threshold applies per seller.
- **Delivery rule hierarchy**: free-delivery threshold → Super Admin rule → seller's own charge.
- **Order splitting**: one checkout/payment becomes separate orders per seller after payment
  succeeds. Customer experience stays as ONE checkout/payment — never multiple payments.
- **Seller-of-record**: resolved by the system (product/seller config), not by payment or delivery.
  Supplier sale → supplier is seller of record. YallaShuq sale → YallaShuq is seller of record.
- **Payment gateways**: Sumit and Lahza (region-specific). Hosted payment page where required.
  Must handle failed payments, retries, and prevent duplicate/double charges.
- **Order status progression**: Packing → Shipped → Delivered. (Backend has a known bug where
  orders can incorrectly become "Delivered" at confirmation — do not assume status logic is
  correct; verify against real data.)
- **Refund vs. chargeback**: refund = started through platform return/refund process, can be
  partial. Chargeback = started by payment provider/customer dispute, admin/finance resolves it.
  These are different flows — do not conflate them.
- **What the customer should see**: products/prices, delivery charge, taxes, payment status, order
  number/status, seller info required for legal display, tracking, confirmation, receipts/invoices,
  return/refund/warranty/review/support options. Customer does NOT see internal commission,
  provider cost, seller net payable, or internal reconciliation data.

## Existing Backend Routes (confirmed from Technical Handover doc — use these, don't invent new ones)
- Signup/identity: `/web/signup`, `/web/signup/whatsapp/send_otp`, `/web/signup/whatsapp/verify_otp`,
  `/web/signup/email/send_otp`, `/web/signup/email/verify_otp`, `/web/signup/otp/verify`,
  `/web/signup/otp/resend`, `/web/signup/check_phone`, `/web/signup/check_email`, `/web/signup/states`
- Cart/checkout/payment: `/shop/cart/update`, `/shop/cart/update_json`, `/shop/checkout`,
  `/shop/payment`, `/shop/payment/validate`
- Payment callbacks: `/payment/webhook/<provider_code>`, `/payment/lahza/webhook`,
  `/payment/sumit/payment`, `/api/payment/webhook/<gateway_code>`
- Delivery: `/api/delivery/rate`, `/api/delivery/create`, `/api/delivery/track`,
  `/api/delivery/webhook/<provider_code>`, `/marketplace/delivery/whatsapp/update`,
  `/delivery/scan/shipment/<shipment_id>`
- Customer portal: `/my/marketplace/documents`, `/my/marketplace/document/<document_id>`,
  plus returns, warranty, review, wallet, and MishMesh order-support routes under `/my/`
- Seller portal: dashboard, products, orders, financial report, receipt upload — authenticated
  seller access only (not part of this app's initial scope)

Backend readiness by role (from Technical Handover §16):
- **Customer** role should get: profile, products, cart, payment, order, documents, delivery,
  returns, warranty, wallet, support
- Mobile should call the backend and display its result — it should NOT duplicate marketplace
  calculations (seller ownership, delivery pricing, commission, tax, payment status, settlement,
  refund allocation). The backend remains responsible for all of that.

~65 API endpoints are expected in total across the full scope; ~11 backend changes were already
identified as needed (order-status workflow bug, seller shipping charge edge case, etc.) — backend
fixes are part of this project's real scope, not assumed to be already correct.

## Screen List
35 customer-facing screens confirmed so far toward the ~37 target (numbered 1–35, #25 is an open
gap — not filled with a guess). Full details (URLs, fields, content) are tracked in a separate
"Screen List" document — always check that document for the current, authoritative list before
building a screen; do not rely on this file for exact screen content.

Core flow order: Home → Shop → Product → Cart → Checkout (Address → Payment) → Account area
(Orders, Warranties, Gift Cards, eWallet, Returns, Marketplace Documents).

## Feature Scope Checklist (from Developer Scope doc — use to track completeness)
- [ ] Auth: register, login, email/WhatsApp OTP verification, password reset, guest browsing with
      cart retained after sign-in, address management (add/edit/delete), account deletion, rate
      limiting on login/verification
- [ ] Shopping: browse, search, product detail, filter/sort, filter by seller/free-shipping/warranty,
      seller storefronts, protection plans, discount codes, gift cards
- [ ] Multi-seller cart + checkout + both payment gateways
- [ ] Orders: history, detail, tracking, status progression, receipt/invoice PDF
- [ ] Returns & refunds (in-app, not requiring the customer to leave)
- [ ] Warranty: list, detail, claims, claim status, notifications
- [ ] Product reviews: read + write
- [ ] eWallet: balance, top-up, withdraw, transactions
- [ ] Notifications: order/status, packing/shipping/delivery, returns/refunds/warranty,
      promotional, inbox/history, preferences
- [ ] MishMesh AI assistant integration (product discovery only — must NOT perform refunds or
      payment actions independently; must hand off to human support when needed)
- [ ] Customer support: chat, tickets, ticket status, AI-to-human handover

## Known Blockers / Open Items
- Notifications and saved address book are not yet confirmed on the live site — do not build
  until confirmed with real data.
- Seller storefront: built 2026-10-01 on the user's explicit go-ahead (`src/app/store/[id].tsx`,
  `src/api/store.ts`) against /store/<id>/json — name + logo + product count only (client scope).
  Checked on production with seller 73; not on staging. Not linked from anywhere yet: no real data
  in the app carries a seller id (cards/product detail have the seller's name only).
- Order tracking detail: built 2026-09-30 on the user's explicit go-ahead
  (`src/app/my/orders/[id]/tracking.tsx`, `src/api/delivery-tracking.ts`) against the pasted
  /api/delivery/track contract — NOT yet verified with real data (staging still runs the old fake
  stub that always says "shipped"). Verify with a real shipment before relying on it.
- Seller-side screens (Dashboard, Inventory, Seller Orders, etc.) are NOT in the original
  37-screen customer scope — separate, later phase.
- Automatic provider-side refunds are NOT currently supported by Sumit/Lahza config — refunds
  need to distinguish "internal refund record" from "actual gateway refund" (per Technical
  Handover §19.4). Do not assume a refund button triggers real money movement yet.
- WhatsApp Business API verification was previously blocking signup; may now be resolved —
  confirm current status before relying on it.
- Login has no JSON API — app currently parses the HTML login response as a workaround. Backend
  needs a proper JSON /api/login-style endpoint that returns { success, error, redirect } instead
  of an HTML page. (Workaround lives in `src/api/auth.ts`; customer signup `/web/signup` has the
  same limitation — `src/api/signup.ts`, shared helpers in `src/api/html-form.ts`.)
- WhatsApp OTP sending is not yet configured on the backend (as of Sept 2026). This means
  /web/signup/whatsapp/send_otp may fail or send nothing right now, which blocks phone
  verification, which blocks all signup — this is a backend/infra gap outside the mobile app, not
  a bug here. The code is built to work correctly the moment WhatsApp gets configured
  server-side; no app changes should be needed when that happens.
- Email OTP requests succeed against the backend, but no email is arriving (tested with a real
  Gmail address) — likely an unconfigured outgoing mail server or a stuck email queue on staging,
  not an app bug. Needs a backend developer to check Odoo's Outgoing Mail Servers and Email Queue
  (Settings > Technical > Email > Emails) for Exception/Cancelled entries.

## Development Workflow — IMPORTANT
- We work in small, confirmed steps — one screen/feature at a time.
- Do NOT invent screens, colors, fonts, copy text, API endpoints, or backend behavior that isn't
  explicitly confirmed in this file, the Screen List document, or the prompt for that step.
- After each step, stop and wait for confirmation before moving to the next.
- If something needed to complete a step is missing or unclear, ask — do not fill the gap with an
  assumption presented as fact.
- Connect each screen to real Odoo data as it's built, not mock data wired up later.