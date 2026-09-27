# Backend request 016 — Password reset must actually deliver (email link or WhatsApp OTP)

**Status:** Open — blocks wiring the mobile app's "Send Reset Link / OTP" button (it stays
disabled, "Coming soon", until this is confirmed)
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–015 have the same background — **012
covers the JSON routes for password reset; this request is about the delivery step those routes
depend on.**

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It only
displays what the backend returns.

## The problem

The website's reset flow is `/web/reset_password`: the customer enters their email or phone
(`login`) and presses "Send Reset Link / OTP"; the page promises "Use registered email or
WhatsApp OTP to reset access". Full description of the page and its responses: request 012.

The app could submit that same form today (the way it already submits login and Contact Us), but
**nobody can confirm the second half of the flow works**, and the action affects a real account:

- **Email:** on staging, email OTP requests for signup succeed, but **no email arrives** (tested
  with a real Gmail address). Most likely an unconfigured outgoing mail server or a stuck email
  queue — see Settings › Technical › Email › Emails for Exception / Cancelled entries, and
  Settings › Technical › Outgoing Mail Servers. Reset-link emails go through the same mail system,
  so they're very likely affected too. **Not tested for reset specifically** — deliberately, so
  that no real account got a reset triggered.
- **WhatsApp:** WhatsApp OTP sending is **not configured** on the backend (as of Sept 2026), so
  the WhatsApp path can't deliver a code at all.
- **The step after delivery is unknown.** The emailed link's "set new password" page and the
  WhatsApp OTP step have never been seen (an invalid token only redirects to
  `/web/login?error=Invalid reset link.`), so the app can't build them.

If the app wired the button now, a customer could press it, be told a link/code was sent, and
never receive anything — while a real reset was started on their account.

## Impact

The app's "Forgot Password?" screen keeps its field and "Send Reset Link / OTP" **disabled
("Coming soon")**. Customers who forget their password must use the website — where, on staging
at least, the same delivery problem likely applies.

## Request

No new route here (routes are request 012). This is about making the existing flow work end to
end, on **staging first**:

1. **Email delivery:** configure/repair the outgoing mail server and clear the email queue so
   that a password-reset email is actually delivered to a real inbox.
2. **WhatsApp OTP (if it's meant to be offered):** configure WhatsApp Business sending so the
   reset OTP arrives; otherwise tell us, and the app will offer email only.
3. **Document the second step:** what the reset email's link opens (URL pattern, fields, password
   rules, how long the link is valid), and what the WhatsApp OTP step asks for (OTP length,
   validity, then new password?).

## Acceptance criteria

1. On staging, requesting a reset for a test account you control delivers the email (and/or
   WhatsApp OTP) within a couple of minutes — checked in the real inbox / phone, not only in
   Odoo's email log.
2. Following the link (or entering the OTP) lets that account set a new password and sign in
   with it.
3. Nothing changes for accounts that didn't request a reset; the existing `/web/reset_password`
   page keeps working as it does today.
4. Once confirmed on staging, the same is checked on the live site before the app enables the
   button there.

## Mobile app side (for reference)

- Screen: `src/app/reset-password.tsx` (opened by "Forgot password?" on the Login screen, which
  already works). The field and "Send Reset Link / OTP" stay disabled ("Coming soon") — a
  deliberate decision (2026-09-27) because delivery can't be confirmed and the action affects a
  real account.
- Wiring it needs **both** this request (delivery works) and request 012 (JSON routes, or at
  least a confirmed working form flow) — then the app adds the send step and the second step
  described in item 3 above.
