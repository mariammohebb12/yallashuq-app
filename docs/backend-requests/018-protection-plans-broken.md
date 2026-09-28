# Backend request 018 — Protection Plans (extended warranty) are broken

**Status:** Open — BUG. Blocks Protection Plans in the mobile app (not built; nothing will be
wired until this is fixed)
**Requested:** 2026-09-28
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–017 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It only
displays what the backend returns — it must not calculate protection-plan prices or eligibility
itself.

## What exists

Custom addon **`yallashuq_extended_warranty`**. Its frontend script
(`/yallashuq_extended_warranty/static/src/js/warranty_toggle.js`, identical on live and staging)
gives two entry points:

1. **Product page:** a checkbox `#add_extended_warranty`. Its value is copied into a hidden input
   `add_extended_warranty` (`1` / `0`) that is sent with the normal Add to Cart form
   (`POST /shop/cart/update`).
2. **Cart:** a per-line button `.js_ysq_toggle_warranty` (`data-line-id`, `data-enabled`) that
   calls JSON-RPC **`/warranty/toggle`** with `{ "line_id": <sale.order.line id>, "enabled": true|false }`
   → `{ "success": true|false }`, then reloads the page.

**Neither entry point is visible to customers today.** No product page on live (1 product) or
staging (4 products) shows the checkbox, the staging cart shows no toggle button, and the shop's
"Warranty Eligible" filter (`/shop?warranty_eligible=1`) returns 0 products on both.

## What was tested (staging, 2026-09-28, test customer account)

| Request | Result |
|---|---|
| `/warranty/toggle`, `line_id: 0`, signed in | `{"success": false}` |
| `/warranty/toggle`, `line_id: 0`, guest | `{"success": false}` |
| `/warranty/toggle`, real line 195 (test customer's cart), as **guest** | `{"success": false}`, cart unchanged |
| `/warranty/toggle`, line 195, `enabled: true`, as the **owner** | `{"success": true}` — protection-plan block added (below) |
| `/warranty/toggle`, line 195, `enabled: false`, as the owner | `{"success": true}` — block removed, cart back to its original state |
| `GET /warranty/toggle` | 400 |

Line 195 = **Wireless Headphones** (product id 67), qty 2, ₪6,000.00 each, sold by "John Doe".
After enabling, the cart showed:

> **PROTECTION PLAN** · Vip Warranty Fee (`/shop/vip-warranty-fee-56`) · 12 Months · 2 Claims ·
> Category Fee: 10.0% of item price · **Linked to: [P6879] Microwave Oven** · Qty: 2 ·
> **₪0.00 / unit · Total: ₪0.00**

Cart summary with the plan: Subtotal ₪14,000.00, Taxes ₪2,520.00, Total ₪16,520.00 — **identical
to the total without it.**

## The bugs

1. **Price is ₪0.00.** The plan states "Category Fee: 10.0% of item price". For 2 × ₪6,000 that
   should be around ₪1,200 (before tax, if that's the intended rule) — instead nothing is charged
   and the order total doesn't change.
2. **Linked to the wrong product.** The plan was enabled on the Wireless Headphones line but says
   "Linked to: [P6879] Microwave Oven" (another line in the same cart). A claim later would be
   attached to the wrong item.
3. **No server-side eligibility check.** The headphones show no warranty option and no product is
   warranty-eligible, yet `/warranty/toggle` accepted the plan. The server must refuse a plan for
   a product (or line) that isn't eligible, whatever the client sends.

Not tested (deliberately): adding a plan via `add_extended_warranty=1` on `/shop/cart/update`
(would add products to the cart), and checkout/payment with a plan in the cart. The same bugs may
apply there.

## Request

On **staging first** (`develop` branch). These fixes change existing behaviour, so they need a
decision before code is changed:

1. Fix the price: the plan line must be priced by the configured rule (e.g. 10% of the linked
   item's price × qty) and included in subtotal, taxes and total.
2. Fix the link: the plan line must reference the exact order line it was enabled on.
3. Enforce eligibility on the server in `/warranty/toggle` **and** in the
   `add_extended_warranty` path of `/shop/cart/update`: return `{ "success": false, "error": "..." }`
   for ineligible products.
4. Confirm which products/categories should offer a plan, and which plans (name, duration,
   claims, fee rule) — then configure at least one eligible product on staging so the flow can be
   seen end to end.
5. Check the same fixes apply to the `add_extended_warranty` add-to-cart path, and that a paid
   order carries the plan through to the customer's Warranties page (`/my/warranties`).

Additive, for the app (separate step once the above is fixed): a JSON way to read the plan
options for a product (eligible yes/no, plan name, duration, claims, price) — the app can't read
them today except by scraping HTML.

## Acceptance criteria

1. On staging, enabling a plan on an eligible line adds a plan priced by the rule, linked to that
   same line, and the cart total increases by exactly that amount (plus any tax).
2. Enabling a plan on an ineligible line is refused with an error; the cart doesn't change.
3. Disabling the plan removes it and restores the original total.
4. A guest or another customer still can't toggle someone else's line.
5. An order paid with a plan shows the plan in the order and in `/my/warranties`.

## Mobile app side (for reference)

Nothing built. Protection Plans stay out of the app until this is fixed and confirmed on staging.
