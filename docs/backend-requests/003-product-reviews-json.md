# Backend request 003 — JSON endpoint for a product's reviews (and its description)

**Status:** Open — the mobile app's Product detail screen shows only the average rating and review count until this ships; there's no product description at all
**Requested:** 2026-09-25
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001 (cart contents) and 002 (catalog
filters) have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. It uses the
existing Odoo routes with a normal Odoo session cookie (guests included), and only displays what
the backend returns.

The app's Product detail screen gets its data from two JSON routes that already exist:
- `GET /home/catalog/more`: name, image, price, seller, `rating_avg`, `rating_count`,
  free-shipping and warranty flags.
- `POST /website_sale/get_combination_info` (standard Odoo 18): price and availability.

## The problem

**1. Review details are only available as HTML.** The live product page
(`/shop/<slug>-<id>`) renders the "Customer Reviews" block on the server:

- a summary: average, stars, "Based on N ratings"
- a list of reviews, each with stars, reviewer name, date and comment ("No comment provided."
  when there's none)

"See all" and "VIEW ALL REVIEWS (N)" don't load anything: they only reveal a list that's already
in the page's HTML. There's no reviews route, JSON or otherwise. The app would have to parse the
product page's HTML, which it deliberately doesn't do.

What exists on staging/live today (2026-09-25):

| Product | Site | Rating | Reviewer | Date | Comment |
|---|---|---|---|---|---|
| 50 Wireless Bluetooth Headphones | live | 2 ★ | David Miller | 25 Sep 2026 | *(none; the site shows "No comment provided.")* |
| 52 Badminton Racket | staging | 5 ★ | Shane Watson | 16 Sep 2026 | "The product quality is very good and I am satisfied with this product." |

**2. There's no product description in any JSON route.** Neither route above returns one. (The
product pages checked don't display one either, so it may simply be empty today. The app still
needs a field for it.)

## Request

One read-only JSON route for a product's detail content: its reviews, plus its description.

### Route

| | |
|---|---|
| Route | `GET /shop/product/<int:product_template_id>/reviews_json` (suggested name; any name works, as long as it's documented) |
| Type | `type='http'` returning JSON (like `/home/catalog/more`), or `type='json'`; either is fine, just say which |
| Auth | `auth='public'`, `website=True` (guests must be able to read reviews) |
| Params | `page` (1-based, default 1), `limit` (default 10); optionally `lang` if the route doesn't follow the website language |
| Side effects | none |
| Visibility | Exactly the products and reviews the website shows on that product page (published products, and only reviews the site displays, e.g. approved/published if moderation exists). An unknown or unpublished product → 404 or an empty result, and **no server error**. |

### Response

```jsonc
{
  "product_template_id": 52,

  "summary": {
    "rating_avg": 5.0,          // must equal the catalog card's rating_avg
    "rating_count": 1           // must equal the catalog card's rating_count
  },

  "reviews": [
    {
      "id": 17,
      "author_name": "Shane Watson",     // exactly the name the website shows, nothing more
      "author_avatar_url": null,          // relative URL if the site shows one, else null
      "rating": 5,                        // 1–5
      "comment": "The product quality is very good and I am satisfied with this product.",
                                          // "" when none (the app shows its own "no comment" text)
      "date": "2026-09-16",               // ISO date the site shows
      "date_formatted": "16 Sep 2026"     // as the website formats it, in the request language
    }
  ],
  "page": 1,
  "has_next": false,
  "total": 1,

  // Part B: the product description shown to customers, if any.
  "description": {
    "html": "",                  // sanitized HTML as the website would render it ("" if none)
    "text": ""                   // the same content as plain text ("" if none)
  }
}
```

Notes:
- **Order:** newest first (or the website's order; say which).
- **Privacy:** return only what the website already shows publicly. **No emails, phone numbers,
  partner ids, order ids, or internal moderation fields.**
- **Description:** use whatever field the website uses for the customer-facing description (in
  Odoo 18 typically `description_ecommerce`, but use this project's actual field), translated to
  the request language. Don't return internal notes or seller-only fields.

## Acceptance criteria

1. Live product 50 returns `rating_avg` 2.0, `rating_count` 1, and one review: David Miller, 2 ★, date 25 Sep 2026, `comment: ""`.
2. Staging product 52 returns `rating_avg` 5.0, `rating_count` 1, and one review: Shane Watson, 5 ★, 16 Sep 2026, with the comment above.
3. A product with no reviews returns `rating_count: 0` and `reviews: []`.
4. `summary` always matches the same product's `rating_avg` / `rating_count` in `/home/catalog/more`.
5. Paging works (`page`, `has_next`, `total`) once a product has more reviews than `limit`.
6. An unknown id (e.g. 999999) returns 404 or an empty result, never a Python traceback.
7. No personal data beyond the displayed reviewer name/avatar appears in the response.
8. `description` is present on every response (empty strings when the product has none).

### Quick test

```bash
curl -s "https://yallashaq.oodleslab.com/shop/product/52/reviews_json" | python3 -m json.tool
curl -s "https://yallashuq.com/shop/product/50/reviews_json" | python3 -m json.tool
curl -s -o /dev/null -w "%{http_code}\n" "https://yallashaq.oodleslab.com/shop/product/999999/reviews_json"
```

## Related (not part of this request)

- **Writing reviews.** The app's scope includes customers writing reviews. The Technical Handover
  lists review routes under `/my/` (customer portal), but no review form is on the product page,
  and those routes haven't been checked for JSON use. That will be a separate request once the
  "write a review" flow is specified.
- **Error details are exposed on staging.** Calling `/website_sale/get_combination_info` without
  `product_id` returns the full Python traceback, including server file paths
  (`/opt/docker/odoo/...`), to any caller. Please turn off debug error output on public servers.
  This applies to every route, not just this one.

## Mobile app side (for reference)

- Screen: `src/app/product/[id].tsx`. The "Customer Reviews" card shows only average, stars and
  "Based on N ratings", and there's no description section. Both gaps are noted in the file's
  header comment.
- Data: `src/api/catalog.ts` (`findCatalogProduct`, `fetchCombinationInfo`). A
  `fetchProductReviews` would be added there when this route ships.
