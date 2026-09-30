# Backend request 017 — Account deletion: confirm what it actually does

**Status:** CLOSED 2026-09-30 — answered: `/my/deactivate_account` only archives the account (see
"Resolution"). The app's button is still disabled until it's wired up, which is separate work.
**Requested:** 2026-09-28
**For:** whoever takes over YallaShuq backend development (anyone with Odoo / backend access)

## Resolution (2026-09-30)

Confirmed by the project owner: **`/my/deactivate_account` only archives the account** — login is
blocked, but **no data is deleted**: order history and the partner record stay intact.

What the app did with it (commit 4facfd7): the Security screen's "Delete Account" is now
**"Deactivate Account"** (title, button, and step 2's "deactivate your account"), on purpose
different from the live page's wording. The warning "This action cannot be undone." is kept:
archiving can be reversed by an admin, but the customer has no self-service way to reactivate —
they'd have to contact support — so from their side it's effectively permanent.

Not changed by this: the app's button stays disabled until the deactivate flow is wired up (the
route is an HTML form post; see "Request" below for the JSON reply that would make that clean).

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–016 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It only
displays what the backend returns.

## What exists and was tested (staging, 2026-09-28)

The customer's **Connection & Security** page (`/my/security`) has a "Delete Account" section.
Its form posts (HTML form, `POST`) to **`/my/deactivate_account`** with these fields:

| Field | Meaning |
|---|---|
| `password` | the customer's current password |
| `validation` | the customer's login, typed out exactly |
| `request_blacklist` | optional checkbox: "Put my email and phone in a block list to make sure I'm never contacted again" |
| `csrf_token` | the page's CSRF token |

Text shown to the customer: *"Disable your account, preventing any further login. This action
cannot be undone."*, then *"1. Enter your password to confirm you own this account"* and
*"2. Confirm you want to delete your account by copying down your login (‹login›)."*

Tested with the staging test customer. **No deletion was performed** — every test was built to be
rejected:

| Request | Result |
|---|---|
| Wrong login + wrong password | 200, page re-rendered with *You should enter "‹login›" to validate your action.* |
| Correct login + wrong password | 200, page re-rendered with *Wrong password.* |
| No `csrf_token` | 400 |
| JSON-RPC body | 400 |
| `GET` | 405 |

After these tests the account's session was still valid and a fresh sign-in still worked.

On **live** (read-only, not signed in): `/my/security` redirects to `/web/login`, and
`GET /my/deactivate_account` answers 405 (a made-up `/my/` path answers 404) — so the route
exists on live too.

## What's unconfirmed — the actual question

A **correct** submission has never been made (there's no throwaway test account; signup is
currently blocked by OTP delivery). So nobody knows what it really does on this backend:

- Does it **permanently delete** the account and its personal data?
- Or does it only **deactivate** the user (archive it, block login) and keep the record?

Standard Odoo (portal module, `_deactivate_portal_user`) does the latter by default: it archives
the user and queues a deletion request that a scheduled job processes later — and records that
are still referenced (orders, invoices, etc.) may prevent the partner from being removed. It also
refuses to deactivate internal (staff) users. **None of that is confirmed for YallaShuq** — a
custom addon may override it.

This matters because the app must tell the customer exactly what will happen. The website's copy
says both "disable" and "delete"; we can't copy that into the app until we know which is true.

## Request

Please check on **staging** (read the code in the `develop` branch, and/or do one real deletion
of a throwaway account you create) and answer:

1. Does any custom YallaShuq addon override `/my/deactivate_account` or
   `res.users._deactivate_portal_user`? If so, where and what does it change?
2. Immediately after a correct submission: is the user archived, deleted, or something else?
   Is the customer logged out and redirected (to where, with what message)?
3. Is the "delete later" scheduled job (`res.users.deletion` / "Auto-vacuum" or similar)
   active on staging and live? How long before the record is actually removed?
4. What happens to the customer's **data**: contact (res.partner), addresses, orders, invoices,
   returns, reviews, wallet balance, gift cards, warranty claims, marketplace documents?
   Kept, anonymised, or deleted?
5. What does `request_blacklist` do exactly (email blacklist, phone blacklist, both)?
6. What happens if the customer has **open orders, pending returns or a wallet balance**? Is
   deletion blocked, or does it go through?
7. Can the same email/phone sign up again afterwards?

**Do not change existing behaviour** while answering this — it's a confirmation request only.
If the answer shows the behaviour needs to change (e.g. a legal/privacy requirement), raise it as
a separate request.

## Acceptance criteria

1. Written answers to questions 1–7 above, based on the code **and** one real test on staging
   with a throwaway account (never a real customer account; never on live).
2. The exact success response is recorded (status code, redirect target, any message).

## Follow-up (not part of this request)

Like login, signup and profile, this route is HTML-form only (JSON → 400). Once the behaviour is
confirmed, the app will need a JSON version (e.g. returning `{ success, error }` with separate
errors for wrong login and wrong password). That will be logged as its own request.

## Mobile app side (for reference)

- Screen: `src/app/my/security.tsx` (Account tab → "Connection & Security"). The Delete Account
  section shows the live page's copy, with every field and the button disabled ("Coming soon").
- The button stays disabled until this request is answered and the customer-facing copy is
  updated to match what really happens.
