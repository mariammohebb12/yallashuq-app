# Backend request 026 — Staging needs a way to test the "unverified account" login (OTP) step

**Status:** Open — TEST-ENVIRONMENT gap. The mobile app's login OTP step is built but can't be
tested end-to-end.
**Requested:** 2026-09-30
**For:** whoever administers the YallaShuq Odoo staging server (yallashaq.oodleslab.com)

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–025 have the same background; **016**
covers email delivery for password reset (the same "emails don't arrive on staging" problem).

A native mobile app (React Native / Expo, iOS + Android) is being built for customers.

## How the website's login OTP step works (read from its JavaScript, 2026-09-30)

`yallashuq_seller/static/src/js/login_otp.js` (in `web.assets_frontend_lazy`, identical on staging
and production): when someone signs in to an account that isn't verified yet, `/web/login`
re-renders the login page with the hidden fields `login_otp_required="True"` and
`unverified_login="<the login>"`. The script then opens a "Verify Your Email" modal that calls:

- JSON-RPC `/web/signup/otp/verify` `{ login, otp_code }` → `{ status: "success", redirect }`
- JSON-RPC `/web/signup/otp/resend` `{ login }` → `{ status: "success" }` or `{ message }`

(Login reuses the **signup** OTP routes; there are no separate login OTP routes.)

The mobile app copies this exactly (built 2026-09-30).

## The gap

Nobody has seen this step work from start to finish — on the website or in the app — because on
staging:

1. The only test customer is already verified, so `login_otp_required` is always `"False"`.
2. A new unverified account can't be created: signup needs an OTP, WhatsApp OTP isn't configured,
   and email OTPs don't arrive (see 016 and the project notes).
3. Even with an unverified account, the verify step needs the code, which is sent by the same
   email/WhatsApp that isn't working.

So it's unconfirmed what `/web/login` actually returns for an unverified account, and what
`/web/signup/otp/verify` and `/otp/resend` return in the login case.

## What's needed (staging only)

Any one of these:

1. **Fix email delivery on staging** (see 016), then create a test customer that is left
   unverified; or
2. **Provide an unverified test customer** on staging (e.g. set a test account back to
   unverified), **plus a way to read its code** — e.g. from Settings > Technical > Email > Emails,
   or the OTP record in the database.

Please also confirm:

- the exact condition for `login_otp_required="True"` (unverified email? phone? both?);
- that `/web/signup/otp/verify` signs the session in on success (the website relies on this: it
  just goes to `redirect`);
- how long a code is valid, and whether resend has a server-side limit.

## Acceptance criteria

1. On staging, signing in as the unverified test customer returns the login page with
   `login_otp_required="True"` and `unverified_login` set.
2. The code can be obtained, and `/web/signup/otp/verify` with it returns `status: "success"` and
   leaves the session signed in.
3. `/web/signup/otp/resend` sends a new code that arrives (or can be read as in option 2).

## Mobile app side (for reference)

Built 2026-09-30: `src/api/auth.ts` (detection, `verifyLoginOtp`, `resendLoginOtp`),
`src/components/otp-modal.tsx` (`variant="login"`), `src/app/login.tsx`. The detection was tested
offline against the real staging login page with the two flags changed; nothing was tested
against a real unverified account.
