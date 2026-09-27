# Backend request 001 — JSON endpoint for the current cart's contents

**Status:** Open — blocks the mobile app's Cart screen (it runs on temporary sample data until this ships)
**Requested:** 2026-09-25
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It talks
to the existing Odoo HTTP/JSON routes the same way the website does:

- **Session:** a normal Odoo session cookie (`session_id`). Guests get one too, and the cart is
  the standard `website_sale` session cart (`request.website.sale_get_order()`), so a guest cart
  is the one Odoo attaches to the user after sign-in.
- **JSON routes:** called as Odoo JSON-RPC (`type='json'`):
  `POST {"jsonrpc": "2.0", "method": "call", "params": {...}}`.
- **No calculations in the app:** the app displays what the backend returns and does not
  compute marketplace values (seller ownership, delivery pricing, tax, totals).

## The problem

The app adds products to the cart with the same route the website uses:

```
POST /shop/cart/update_json
{"jsonrpc": "2.0", "method": "call", "params": {"product_id": 63, "add_qty": 1, "display": false}}
```

That works. The problem is that there's **no route that returns the cart's contents as JSON**:

| Route | What it returns | Usable by the app? |
|---|---|---|
| `/shop/cart/update_json` (`display: false`) | `cart_quantity`, `amount`, and `notification_info` for the line that was **just added** | No. Totals only, not the cart's lines. |
| `/shop/cart/update_json` (`display: true`) | Also the lines, but as **rendered QWeb HTML** (`website_sale.cart_lines`) | No. The app would have to parse HTML. |
| `/shop/cart/quantity` | The item count only | No |
| `/shop/cart` | The full HTML page | No. The app would have to parse HTML. |

In `yallashuq_seller/controllers/main.py`, `cart_update_json` is a thin override of Odoo's
`WebsiteSale.cart_update_json`, so it has the same limits.

The result: the app can show a cart **count** (badge), but it can't show the Cart screen.

## Request

Add one read-only JSON route that returns the current session's cart: its lines, grouped by
seller, with each seller's delivery charge and the cart totals, all computed by the backend.

### Route

| | |
|---|---|
| Route | `/shop/cart/summary_json` (suggested name; any name works, as long as it's documented) |
| Type | `type='json'`, `auth='public'`, `website=True`, `methods=['POST']` |
| Params | none (`{}`); optionally `lang` (`en_US` / `ar_001` / `he_IL` / `ru_RU`) if the route doesn't already follow the session/website language |
| Works for | guests and signed-in customers (same session cart the website uses) |
| Side effects | **none**. It must not create an order when there isn't one (use `sale_get_order()` without `force_create`). |

### Response (`result`)

Amounts are sent **twice**: as a raw number, and as a string already formatted with the order's
currency (the app shows the formatted string as-is). All text is translated to the request's
language.

```jsonc
{
  "order_id": 812,              // null when there is no cart yet
  "cart_quantity": 3,           // same value as update_json's cart_quantity
  "currency": { "code": "ILS", "symbol": "₪" },

  "seller_groups": [
    {
      // Seller of record for these lines, resolved by the backend's own rules
      // (supplier sale -> the supplier, YallaShuq sale -> YallaShuq).
      "seller": {
        "id": 14,
        "name": "John Doe",                 // display name, as on product cards ("Sold by: …")
        "legal_name": "John Doe Trading",   // whatever must be shown to the customer for legal
                                            // reasons (company name, registration no., …)
        "is_marketplace": false             // true when YallaShuq itself is the seller of record
      },
      "lines": [
        {
          "line_id": 1532,                  // sale.order.line id (used with update_json line_id/set_qty)
          "product_id": 63,                 // product.product id
          "product_template_id": 50,        // product.template id (product page / URL)
          "name": "Wireless Bluetooth Headphones",
          "variant_description": "Black",   // attribute values, "" if none
          "image_url": "/web/image/product.product/63/image_256",
          "quantity": 1,
          "max_quantity": 5,                // null = no limit (stock / sale limits the website enforces)
          "price_unit": 2000.0,
          "price_unit_formatted": "₪2000.00",
          "price_subtotal": 2000.0,         // line total before tax
          "price_subtotal_formatted": "₪2000.00",
          "price_total": 2000.0,            // line total incl. tax
          "price_total_formatted": "₪2000.00",
          "discount_percent": 0,
          "warning": ""                     // e.g. stock warning shown on the website, "" if none
        }
      ],
      "subtotal": 2000.0,
      "subtotal_formatted": "₪2000.00",
      "delivery": {
        "calculated": true,                 // false until a delivery address/method is known
        "amount": 0.0,
        "amount_formatted": "₪0.00",
        "is_free": true,
        // Free-delivery threshold for THIS seller, if one applies:
        "free_threshold": 500.0,            // null if none
        "free_threshold_formatted": "₪500.00",
        "remaining_for_free": 0.0,          // how much more to spend with this seller; 0 when reached
        "remaining_for_free_formatted": "₪0.00"
      }
    }
  ],

  "totals": {
    "subtotal": 2000.0,        "subtotal_formatted": "₪2000.00",   // all lines, before tax
    "delivery": 0.0,           "delivery_formatted": "₪0.00",      // sum of seller delivery
    "tax": 0.0,                "tax_formatted": "₪0.00",
    "discount": 0.0,           "discount_formatted": "₪0.00",      // discount codes / gift cards, if applied
    "total": 2000.0,           "total_formatted": "₪2000.00"       // what the customer will pay
  },

  "warnings": []               // cart-level messages the website would show, [] if none
}
```

Empty cart / no order: `order_id: null`, `cart_quantity: 0`, `seller_groups: []`, and all totals `0`.

### Business rules the response must reflect (and the app won't recompute)

- **One cart, several sellers:** lines are grouped by seller of record, as resolved by the
  backend's own configuration.
- **Delivery per seller.** The order of precedence is:
  1. the seller's free-delivery threshold
  2. the Super Admin rule
  3. the seller's own charge

  If delivery can't be known yet (no address), return `calculated: false` rather than a guess.
- **Totals** must equal what `/shop/checkout` → `/shop/payment` will charge. There's one
  checkout and one payment, even though the order is split per seller after payment.

### Must NOT be included

This data is shown to the **customer**. Don't return internal marketplace data: **commission,
provider cost, seller net payable, settlement or reconciliation fields.**

## Acceptance criteria

1. As a guest with an empty session: returns the empty shape above, HTTP 200, and creates no order.
2. After `update_json` adds product 63 on staging, the route returns one seller group containing
   that line, and `cart_quantity` matches `update_json`'s value.
3. With products from two different sellers, there are two `seller_groups`, each with its own
   `delivery` block.
4. The same session viewed on the website (`/shop/cart`) shows the same lines, quantities and totals.
5. The response contains no commission / net-payable / cost fields.
6. Text follows the requested language (at least `en_US` and `ar_001`).

### Quick test (staging)

```bash
B=https://yallashaq.oodleslab.com
J=/tmp/ysq-cookies
# Start a session, add product 63, then read the cart.
curl -s -c $J -b $J $B/shop >/dev/null
curl -s -c $J -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"product_id":63,"add_qty":1,"display":false}}' \
  $B/shop/cart/update_json
curl -s -c $J -b $J -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{}}' \
  $B/shop/cart/summary_json
```

## Related (not part of this request)

Changing quantities and removing lines can keep using the existing route, as the website's own
cart page does: `/shop/cart/update_json` with `{line_id, product_id, set_qty}` (`set_qty: 0`
removes the line). Please keep that route's current behavior stable.

## Mobile app side (for reference)

- Temporary sample data: `src/api/cart.ts` (`fetchCartSummary`) and `src/api/mocks/cart-summary.mock.ts`
- Screen: `src/app/(tabs)/cart.tsx`

When this route ships, only `fetchCartSummary` changes: the mock is replaced by a call to this
route.
