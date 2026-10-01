# Backend request 028 — "Warranty Eligible" filter returns nothing while a product card says it's eligible

**Status:** Open — BUG (data/logic mismatch). The mobile app's Warranty Eligible filter works, but
always shows "0 products" because of this.
**Requested:** 2026-10-01
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller` and
`yallashuq_extended_warranty`. The backend repo is `github.com/pranavkakkar24/yallashuq`, branch
`develop`. It was built by Oodles Technologies, who are **no longer involved in the project**.
Don't assume anything was agreed with them. This document is meant to be complete on its own.
Related: **002** (catalog filters; first noted there), **018** (Protection Plans broken — it
already saw the website's filter return 0 products, but not the card flag below), **027** (other
`/shop/products/json` input bugs).

## What was seen (production, 2026-10-01, logged out)

Production lists 2 products. The product cards (same `_build_product_cards` helper for
`/home/catalog/more` and `/shop/products/json`) say:

| Product | id | `warranty_eligible` on the card |
|---|---|---|
| Lamp | 52 | **true** |
| Wireless Bluetooth Headphones | 50 | false |

Yet filtering on that same flag returns **no products**:

- `POST /shop/products/json` `{"warranty_eligible": true}` → `total_count: 0`, `cards: []`
- The website's own checkbox, `GET /shop?warranty_eligible=1`, also lists no products.

So the filter and the card's `warranty_eligible` value come from different sources (or different
conditions), and they disagree. Customers see a product marked as warranty-eligible that the
"Warranty Eligible" filter never shows.

## What's needed

1. Decide which is right for the Lamp: is it warranty-eligible or not?
2. Make the filter's domain and the card's `warranty_eligible` value use the **same** definition
   (one shared helper/field), so a product shows under the filter exactly when its card says
   `warranty_eligible: true`.
3. If eligibility depends on a protection plan being configured, check it against **018** (the
   plans are currently broken: ₪0.00 price, wrong linked product).

## Acceptance criteria

1. For every published product: it appears in `/shop/products/json` with
   `warranty_eligible: true` **if and only if** its card has `"warranty_eligible": true`.
2. Same for the website's `/shop?warranty_eligible=1`.

### Quick test (production)

```bash
B=https://yallashuq.com
rpc() { curl -s -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":$1}" $B/shop/products/json; }
rpc '{}' | python3 -c "import json,sys; print([(c['id'],c['warranty_eligible']) for c in json.load(sys.stdin)['result']['cards']])"
rpc '{"warranty_eligible":true}' | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['total_count'])"
```

## Mobile app side (for reference)

Shop's Warranty Eligible checkbox (`src/app/(tabs)/shop.tsx`) sends `warranty_eligible: true` and
shows whatever the backend returns — it doesn't filter or re-check in the app. No app change is
needed when this is fixed.
