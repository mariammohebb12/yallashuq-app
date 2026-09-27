# Backend request 014 — BUG: customers are offered "Pay" on invoices of orders that are already paid (double-charge risk)

**Status:** Open — **bug, needs a decision** (fixing it changes existing behaviour). Until it's
fixed, the mobile app has **no payment action on invoices at all** (its Invoices screens are
read-only).
**Reported:** 2026-09-27
**For:** whoever takes over YallaShuq backend development
**Priority:** high — real money can be taken twice on the live site if it behaves like staging

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Request 005 ("Bugs found", bug 2) first noticed the
same contradiction on the order page.

Payment gateways: Sumit (checkout) and Lahza. Automatic provider-side refunds are **not** set up
(CLAUDE.md), so a duplicate charge can't simply be reversed from Odoo.

## What happens (staging, 2026-09-27, signed in as a test customer — nothing was paid)

1. **Order S00073** — its Order Confirmation PDF (`/my/marketplace/document/78`) says **"Payment
   Status: Paid"**, "Total Paid: ₪ 4,720.00".
2. Its invoice **INV/2026/00012** (₪ 4,720.00, `/my/invoices/58`) is listed as **"Waiting for
   Payment"**, appears under **"Overdue invoices"**, and its page shows a working **"Pay"** card
   ("Choose a payment method — Card, Secured by Lahza Gateway — Pay").
3. **`/my/invoices`** lists **10 invoices as overdue / "Waiting for Payment"**
   (INV/2026/00002–00004, 00006–00012). The **"Pay overdue"** button opens
   **`/my/invoices/overdue`**, which offers to pay them all at once: **"BATCH/2026/00001 — Amount
   ₪ 28,084.00"**, card via Lahza. The customer's orders on staging are marked paid (see 005).
4. **INV/2026/00001** (₪ 2,596.00) is **"Processing Payment"** and its page even warns *"A payment
   has already been made on this invoice, please make sure to not pay twice."* — yet still shows
   the **Pay** card.
5. **RINV/2026/00002** (a credit note) is listed with Amount Due **₪ -2,360.00** and status
   **"Waiting for Payment"**, while its own page says **"This invoice has already been paid."**

So the invoice payment state doesn't reflect payments taken at checkout, and the portal offers to
charge the customer again — one invoice at a time or all overdue invoices in one batch.

## Likely causes to check

- Checkout payments (Sumit) aren't reconciled with the invoices created afterwards (or the invoice
  is created per seller after the order split and never linked to the checkout transaction).
- The portal's Pay section is shown based on the invoice's `payment_state` alone, even when a
  confirmed transaction exists (case 4).
- The "overdue" filter / "Pay overdue" batch uses the same unreconciled state.

## What's needed (decision first — this changes existing behaviour)

1. Invoices of orders paid at checkout must show as **paid** (reconciled with the checkout
   payment), not "Waiting for Payment" / overdue.
2. The portal must **not offer Pay** (single or "Pay overdue" batch) for an invoice that is paid,
   in payment, or has a pending/confirmed transaction.
3. Credit notes must never be offered for payment and their list status must match their page.
4. Check whether the **live site** has the same data (not checked from here).
5. If any customer already paid twice, list those transactions — refunds need manual handling
   (provider refunds aren't automatic).

## Acceptance criteria

1. For every order whose confirmation says "Paid", its invoice shows "Paid" and has no Pay card.
2. "Overdue invoices" and "Pay overdue" only include invoices that are genuinely unpaid.
3. An invoice with a pending/processing payment shows no Pay card.
4. A credit note's list status and page agree, and it's never payable.

## Mobile app side (for reference)

- The app's Invoices & Bills screens (`src/app/my/invoices/`) are **read-only**: no "Pay", no
  "Pay overdue". Payment will only be added after this is fixed and confirmed on staging.
