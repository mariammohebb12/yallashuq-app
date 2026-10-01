# Backend request 002 — Filtering, sorting and sellers for the JSON product catalog

**Status:** Partly done — filters and sort shipped on production as `/shop/products/json`
(2026-10-01, see "Update" below); the **seller list** is still open.
**Requested:** 2026-09-25
**For:** whoever takes over YallaShuq backend development

## Update 2026-10-01 — `/shop/products/json` (production only)

Built in `yallashuq_seller/controllers/main.py`. Public JSON-RPC route (`type='json'`: a GET with
a query string is rejected with 400). Params `page, category, search, sort, seller, free_shipping,
warranty_eligible`; response `{status, page, page_count, total_count, has_next, next_page,
filters, cards}` with the same card shape as `/home/catalog/more`. Sort: `popular`, `price_low`,
`newest`. Still a 404 on staging. The app's Shop screen now uses it for sort, Free Shipping,
Warranty Eligible and category.

Still open / found while checking production (2026-10-01, logged out):

1. **No seller list.** The route accepts `seller=<id>`, but nothing returns the sellers (ids +
   names) and cards have no seller id, so the app's "All Sellers" stays "Coming soon".
2. **Warranty Eligible returns nothing although a product is flagged eligible.** With
   `warranty_eligible: true` the route returns 0 products, yet the "Lamp" card (id 52) says
   `"warranty_eligible": true`. The website's own `/shop?warranty_eligible=1` also shows none, so
   the filter and the card flag disagree somewhere in the backend.
3. **Boolean params taken from strings.** `"warranty_eligible": "false"` (a string) is treated as
   true. The app sends real booleans; worth parsing strictly.
4. **Unknown category → server error.** `category: 99999` fails with "Odoo Server Error"
   (MissingError, full traceback in the reply — see #024) instead of an empty list or a clean error.

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. See also request 001 (cart contents), which has the
same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It uses the
existing Odoo routes with a normal Odoo session cookie (guests included). It only displays what
the backend returns and never filters, sorts or calculates marketplace data itself.

## The problem

The app lists products with the JSON route the live homepage uses for its "Load More" button:

```
GET /home/catalog/more?hp_page=1
→ {"page": 1, "has_next": false, "next_page": 1, "cards": [ {id, variant_id, name, price,
   original_price, has_discount, discount_pct, url, image, rating_avg, rating_count,
   warranty_eligible, warranty_tags, free_shipping, ribbon, seller_name, seller_company,
   free_shipping_min_qty, free_shipping_remaining_qty, free_shipping_seller_eligible,
   currency_symbol, currency_position}, … ]}
```

That works well for an unfiltered list. But the Shop screen needs what the web `/shop` page has
(sellers list, Free Shipping / Warranty Eligible filters, sort), and **this route ignores every
filter parameter**.

Verified on staging, 2026-09-25 (4 products in the catalog):

| Query | `/shop` (HTML page) | `/home/catalog/more` (JSON) |
|---|---|---|
| *(none)* | 4 products | 4 products |
| `search=tv` | 1 (Smart Tv) | **4**, filter ignored |
| `sort=price_low` | reordered by price | **same order**, ignored |
| `sort=newest` | *(not checked)* | **same order**, ignored |
| `seller=67` | *(not checked)* | **4**, ignored |
| `seller=999` (doesn't exist) | 4 (also ignored) | **4**, ignored |
| `free_shipping=1` | 0 | **4**, ignored |
| `warranty_eligible=1` | 0 | **4**, ignored |
| `category=1` | 0 | **4**, ignored |

What's missing from the JSON, all for the same reason (the route was built only to add more cards
to the homepage):

1. **Filters:** `search`, `seller`, `free_shipping`, `warranty_eligible` and `category` aren't applied.
2. **Sort:** `sort` isn't applied. The `/shop` page offers `popular` (default), `price_low` and `newest`.
3. **No seller id on cards:** there's only `seller_name` / `seller_company`, so a card can't be linked to a seller filter.
4. **No sellers list:** the `/shop` sidebar's "All Sellers" list (name, avatar, product count;
   e.g. id 67 "John Doe", 4) is only available as HTML.
5. **No total count:** the `/shop` page shows "4 products". The JSON only has `has_next`, so the
   app can't show the count until every page is loaded.

## Request

Make `/home/catalog/more` (or a new route; see "Route" below) filter, sort and describe the
catalog **exactly like the web `/shop` page does**. `/shop` is the reference for which products
match. The app must never get a different result than the website for the same filters.

### Route

| | |
|---|---|
| Preferred | Extend the existing `GET /home/catalog/more` (the app already uses it, and the homepage's "Load More" keeps working since new params are optional). |
| Alternative | A new route, e.g. `GET /shop/catalog_json`, taking the same params as `/shop`. |
| Auth | `auth='public'`, `website=True` (guests must work) |
| Side effects | none |

### Query parameters (all optional; names match the existing `/shop` page)

| Param | Values | Meaning |
|---|---|---|
| `hp_page` | 1, 2, … | Page number (existing) |
| `search` | text | Same search as `/shop?search=` |
| `sort` | `popular` (default) \| `price_low` \| `newest` | Same as the `/shop` sort select |
| `seller` | seller id | Only that seller's products. An unknown id returns **no products** (not all of them). |
| `free_shipping` | `1` | Only free-shipping products |
| `warranty_eligible` | `1` | Only warranty-eligible products |
| `category` | product category id | Same as `/shop?category=` (the homepage's category links) |

Filters combine with AND, as on `/shop`.

### Response: the existing shape, plus four fields

```jsonc
{
  "page": 1,
  "has_next": false,
  "next_page": 1,
  "total": 4,                       // NEW: products matching the current filters (all pages)
  "cards": [
    {
      "id": 54,
      "variant_id": 67,
      "seller_id": 67,              // NEW: same id the seller filter / sellers list use
      "name": "Microwave Oven",
      "...": "all existing card fields, unchanged"
    }
  ],
  "sellers": [                      // NEW: the "All Sellers" list, as in the /shop sidebar
    // avatar_url below is an example path; use whatever the /shop sidebar uses.
    { "id": 67, "name": "John Doe", "avatar_url": "/web/image/res.partner/67/avatar_128", "product_count": 4 }
  ],
  "applied": {                      // NEW: the filters the backend actually applied
    "search": "", "sort": "popular", "seller": null,
    "free_shipping": false, "warranty_eligible": false, "category": null
  }
}
```

Notes:
- **Keep every existing field unchanged**, since the app and the homepage already use them.
- **`sellers`** should follow the same rules as the `/shop` sidebar. If the sidebar counts
  products within the current search/filters, do the same, and say which it is.
- **`applied`** lets the app show exactly what the backend used, and detect a parameter it doesn't
  support rather than showing an unfiltered list as if it were filtered. That is the current
  failure: `seller=999` silently returns everything.
- **Don't include internal data:** no commission, costs, or seller payout/settlement fields.

## Acceptance criteria (run on staging)

1. With no params, the result is identical to today's response, plus the new fields, and the homepage's "Load More" still works.
2. `search=tv` returns only Smart Tv, and `total` is 1.
3. `sort=price_low` returns the same order as `/shop?sort=price_low` (Badminton Racket, Wireless Headphones, Microwave Oven, Smart Tv).
4. `free_shipping=1`, `warranty_eligible=1` and `category=1` each return the same products as the
   matching `/shop` URL (0 on today's staging data).
5. `seller=67` returns John Doe's products, and `seller=999` returns an empty `cards` list with `total: 0`.
6. Each card has `seller_id`, and `sellers` lists John Doe (67) with the same count as the `/shop` sidebar.
7. `applied` reflects each request above.
8. Paging (`hp_page`, `has_next`, `next_page`) still works when filters are applied.

### Quick test

```bash
B=https://yallashaq.oodleslab.com
for q in "" "search=tv" "sort=price_low" "seller=67" "seller=999" "free_shipping=1" "warranty_eligible=1" "category=1"; do
  echo "== $q"
  curl -s "$B/home/catalog/more?hp_page=1&$q" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("total"), [c["name"] for c in d["cards"]], d.get("applied"))'
done
```

## Related (not part of this request)

- The homepage's category list (Desks, Components, …) is also only available as HTML, so the app
  has it hardcoded for now. A JSON list of shop categories (id, name, image) would remove that.
  It could be a later request, or a `categories` list in this response if that's easy.

## Mobile app side (for reference)

- Data: `src/api/catalog.ts` (`fetchCatalogPage`)
- Screen: `src/app/(tabs)/shop.tsx`. The "All Sellers" dropdown, Filters card, sort and the
  category notice are shown disabled with "Coming soon" until this ships.
