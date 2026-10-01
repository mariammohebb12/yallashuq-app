# Backend request 029 — Orders become "delivered" the moment they are confirmed

**Status:** Open — BUG, root cause found (read-only investigation, 2026-10-01). **Needs a business
decision before any fix** — see "Decision needed". Nothing has been changed.
**Requested:** 2026-10-01
**For:** Basem (business decision), then whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons. The backend repo is
`github.com/pranavkakkar24/yallashaq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–028 have the same background; **005**
(orders JSON) first noted this bug, and **006** (returns) saw its effects.

The marketplace's intended order progression is **Packing → Shipped → Delivered**, driven by the
real delivery flow. The original scope document lists a known bug: orders can become "Delivered"
right at confirmation instead. This request explains why.

## Root cause

**`yallashuq_delivery_hub/models/sale_order.py`, `SaleOrder.action_confirm()` (lines ~287–341),
the block commented `# AUTO VALIDATE PICKINGS`.** Right after an order is confirmed, for every open
delivery order (stock picking) it:

1. sets every move's done quantity to the full ordered quantity,
2. calls `button_validate()` (with `skip_backorder` / `skip_immediate`), and
3. if the picking still isn't done, forces it with `_action_done()`.

So the stock delivery is marked **done** at confirmation — before anything is packed, handed to a
courier, or delivered.

**Every paid order goes through it.** Both payment-success handlers confirm the order:

- `marketplace_commission/models/payment_transaction.py` → `_set_done()` calls `action_confirm()`
  for `grow`, `local`, `lahza` and `sumit` transactions.
- `yallashuq_seller/models/payment_transaction.py` → `_set_done()` →
  `_ysq_process_order_accounting()` calls `action_confirm()`, then creates the invoice.

Chain: **payment succeeds → order confirmed → all its deliveries validated immediately.**

**History.** The block first appears in commit `1178e63` ("bug fixes jitender and ranjan",
2026-06-18). Commit `d69a3b8` ("validate automatcally", 2026-09-09) made it unconditional: a
failure to create the courier shipment is now caught and ignored, so validation always goes ahead.
Neither commit says why auto-validation was wanted (see Risk 1 for a likely reason).

No other code sets the order itself to delivered: the other `action_confirm` overrides
(`marketplace_commission`, `yallashuq_extended_warranty`, `yallashuq_gifts_ewallet`) only call
`super()` and do their own bookkeeping, and nothing writes "delivered" to `sale.order.state`.

## What it breaks

| Where | Effect of a delivery validated at confirmation |
|---|---|
| Odoo's own `sale.order.delivery_status` | becomes `full` ("Fully Delivered"), `qty_delivered` filled in |
| Customer order page (`/my/orders/<id>`) | "Last Delivery Orders" shows the delivery as finished straight away |
| Returns (`yallashuq_returns/models/sale_order.py`, `_is_returnable()`) | requires `delivery_status == "full"`, so **returns open the moment an order is paid** — consistent with staging offering returns on orders that couldn't have arrived |
| Seller dashboard (`yallashuq_seller/controllers/main.py` ~519–522) | an order counts as **"shipped"** as soon as it has a done outgoing picking, i.e. immediately |
| Stock | taken out at confirmation, not when the goods actually leave |
| Delivery hub shipments | the `button_validate` override (`yallashuq_delivery_hub/models/stock_picking.py` ~216–224) moves the shipment to "packing" — but the step that should close the picking at delivery (below) then has nothing left to do |

Small related finding: MishMesh's order summary (`ai_assistance/models/ai_chat.py` ~233–243) builds
its status from shipment states but has no case for `packing`, so an order in packing reads as
"Processing".

## The intended design already exists

`yallashuq_delivery_hub` already has the real flow:

- shipment states draft → confirmed → **packing → ready → shipped → out_for_delivery →
  delivered** (`delivery_shipment.py`), updated by courier webhooks
  (`/api/delivery/webhook/<provider_code>`), the WhatsApp quick reply
  (`yallashuq_delivery_whatsapp_auto`) or manual buttons;
- when a shipment reaches **delivered**, `_update_shipment_status()` calls
  `picking._action_done_from_delivery()` (`delivery_shipment.py` ~680–682,
  `stock_picking.py` ~226), which validates the stock picking **at delivery**.

The auto-validation at confirmation short-circuits this.

## Risks (read before deciding)

### Risk 1 — automatic invoicing may depend on it

Right after confirming, `_ysq_process_order_accounting()` calls `order._create_invoices(final=True)`
(`yallashuq_seller/models/payment_transaction.py` ~81). If regular products are invoiced on
**delivered quantities** (Odoo's "Invoicing Policy: Delivered quantities"), that invoice can only be
created because the pickings were already forced to done. Removing the auto-validation could then
make post-payment invoicing fail or produce empty invoices.

The code doesn't settle this: only extended-warranty products force `invoice_policy = 'order'`; the
policy for every other product is a database setting (Sales → Settings → Invoicing Policy, and each
product's own field). **Check on staging and production before changing anything:**

- Sales → Configuration → Settings → *Invoicing Policy*;
- `product.template.invoice_policy` across sellable products (any `delivery`?);
- whether Sumit/Lahza receipts (`sumit_document_*`) rely on the invoice existing at payment time.

### Risk 2 — this is a behaviour change, not an additive fix

Removing or gating the block changes what live orders do: when stock leaves, when returns become
available, what sellers see as "shipped", and possibly invoicing. It also does **not** fix orders
already confirmed — their pickings are already done. This needs a real decision by whoever owns
the business logic, not a code-only call.

## Recommendation (not a decision)

**Stop validating pickings at confirmation and let the real delivery flow drive it**:

1. In `SaleOrder.action_confirm()`, keep creating the marketplace shipments, but no longer validate
   or force-complete the pickings there.
2. Pickings are then validated by the existing path when the shipment is delivered
   (`_action_done_from_delivery()`), so `delivery_status`, returns eligibility, the seller dashboard
   and stock follow real delivery.
3. Only if Risk 1 confirms invoicing depends on it: switch regular products to "Ordered quantities"
   invoicing **or** move invoice creation to delivery — a separate accounting decision.

Alternatives to weigh:

- **Gate instead of remove:** keep auto-validation only for products with no physical delivery
  (services, digital, gift cards), where "delivered at confirmation" is correct.
- **Leave as is but stop showing it:** derive the customer/seller status from shipment states only
  (and fix returns to check shipment delivery). Less risky for stock/invoicing, but stock and
  `delivery_status` stay wrong.

Prerequisite for the recommended direction: shipments must actually reach "delivered" in practice
(courier webhooks working, or the WhatsApp/manual step being used). If they don't, pickings would
stay open forever.

## Decision needed (Basem)

1. Should stock deduction, returns eligibility and "shipped/delivered" follow **real delivery**
   (recommended) — accepting the change for live orders?
2. How should invoicing work at payment time (depends on Risk 1's findings)?
3. What to do with orders already confirmed (leave as is, or review manually)?

## Acceptance criteria (once decided)

1. Paying for an order with a physical product leaves its picking **not done**;
   `delivery_status` is not `full`; the order is not returnable; the seller dashboard doesn't count
   it as shipped.
2. Marking its shipment delivered (webhook, WhatsApp or manual) validates the picking; only then
   does `delivery_status` become `full` and returns open.
3. An invoice / receipt is still produced at payment exactly as before (or as newly decided).
4. Orders with no physical delivery (if gated) behave as decided.

### How to reproduce (staging, once it has the current `develop`)

1. As a test customer, buy one physical product and pay (Sumit/Lahza test mode).
2. In the backend, open the order: *Delivery* smart button → the picking is already **Done**;
   the order's delivery status reads **Fully Delivered**.
3. On `/my/orders/<id>` the delivery shows as finished and the Return button is available.

## Mobile app side (for reference)

The app shows no order status badge until the backend sends a real Packing / Shipped / Delivered
status (see 005). Nothing in the app needs to change for this fix; once fixed, the app's order
status and return availability will follow real delivery automatically.
