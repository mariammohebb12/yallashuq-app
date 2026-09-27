# Backend request 012 — JSON endpoints for password reset (request + set new password)

**Status:** Open — blocks the mobile app's "Forgot Password?" screen ("Send Reset Link / OTP" is
disabled until this ships)
**Requested:** 2026-09-27
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–011 have the same background. Login and
signup have the same limitation today (the app parses their HTML responses; see CLAUDE.md
"Known Blockers").

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It only
displays what the backend returns.

## The problem

Checked on staging 2026-09-27 as a guest (no reset was triggered for any real account):

- **Entry point:** the login page's "Forgot password?" link (on the Password label row) →
  `/web/reset_password`.
- **`/web/reset_password`** (title "Custom Reset Password"): left panel "Forgot Password?" / "Enter
  your email or phone number to reset your password." / "Secure Recovery — Password links expire
  automatically" / "Email/WhatsApp Verification — Use registered email or WhatsApp OTP to reset
  access"; form "Reset your password" / "Enter your account email or phone number", one field
  **"Email or Phone Number"** (`name="login"`, required, placeholder "john@example.com or
  9715xxxxxxx"), button **"Send Reset Link / OTP"**, link "Back to Login".
- **Submitting:** `<form method="post">` to `/web/reset_password` itself, with `login` and a
  hidden `csrf_token`; the page reloads. The only script (`auth_signup/…/reset_password.js`)
  just disables the button while the page reloads.
  - JSON-RPC `POST /web/reset_password` → **400** (HTML).
  - Form post without `csrf_token` → **400** (HTML).
  - Form post **with** the page's token and an address that doesn't exist
    (`…@example.invalid`) → **200**, the same page re-rendered with **"No account found for this
    email/login."**
- **Next steps:** not visible without triggering a real reset. `GET
  /web/reset_password?token=<invalid>` → 303 to `/web/login?error=Invalid reset link.`, so the
  emailed link's "set new password" page couldn't be seen, and neither could the WhatsApp OTP
  step the page promises.

## Security note (please look at)

The "No account found for this email/login." message tells anyone whether an email or phone
number has a YallaShuq account (account enumeration). Common practice is one neutral message
for both cases (e.g. "If an account exists, we've sent a reset link / code"). Changing it changes
existing behaviour, so it needs a decision — not part of the additive request below.

## Impact

Until there's a JSON way to request and complete a reset, the app's **"Forgot Password?" screen
shows the form with the field and "Send Reset Link / OTP" disabled ("Coming soon")**. Customers
who forget their password must use the website.

## Request

JSON routes (`type='json'`, `methods=['POST']`, `auth='public'`; optional `lang`), doing exactly
what the website does, with the **same field name** (`login`). Names are suggestions.

### Route 1 — request a reset: `/web/reset_password/request_json`

```jsonc
// params
{ "login": "customer@example.com" }        // or a phone number, as on the website
// response
{ "success": true,
  "channel": "email",                        // or "whatsapp" — which one the backend used
  "message": "…" }                           // the text the website shows after sending
// errors
{ "success": false, "error": "…" }
```

### Route 2 — complete a WhatsApp OTP reset: `/web/reset_password/verify_otp_json`

Only if the WhatsApp path exists (the page says it does). Params: `login`, `otp`,
`new_password`, `confirm_password` → `{ "success": true }` or per-field `errors`.

### Route 3 — complete an email-link reset: `/web/reset_password/set_json`

Params: `token` (from the emailed link), `new_password`, `confirm_password` → `{ "success": true }`
or `errors`. (The app can also just open the emailed link in the browser; say which you prefer.)

Please document: how long links/OTPs stay valid, the password rules, and the rate limit on
requests (per login / per IP).

## Acceptance criteria

1. Route 1 sends exactly what the website form sends (same email / same WhatsApp OTP) for the
   same `login`, and returns JSON in every case (never HTML or a traceback).
2. Routes 2/3 set the password exactly like the website's own reset step; an expired or wrong
   OTP/token returns `success: false` with a message and changes nothing.
3. Repeated requests are rate-limited.
4. The existing `/web/reset_password` page keeps working unchanged.

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
# Use a test account you control:
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"login":"<test email>"}}' \
  $B/web/reset_password/request_json | python3 -m json.tool
```

## Mobile app side (for reference)

- Screen: `src/app/reset-password.tsx`, opened by "Forgot password?" on `src/app/login.tsx`
  (same place as on the website). The field and "Send Reset Link / OTP" are disabled ("Coming
  soon"); "Back to Login" works. Nothing is sent.
- When these routes ship, the app will add the OTP / new-password step(s) and show the backend's
  own messages — never its own success text.
