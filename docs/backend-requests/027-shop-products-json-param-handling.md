# Backend request 027 — `/shop/products/json`: strict boolean params and a clean reply for an unknown category

**Status:** Open — BUG (input handling). Doesn't block the mobile app (it sends real booleans and
only known category ids), but any other client can hit both.
**Requested:** 2026-10-01
**For:** whoever takes over YallaShuq backend development

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons, mainly `yallashuq_seller`. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–026 have the same background; **002**
asked for this route, and **024** covers tracebacks in production error replies.

`/shop/products/json` (`yallashuq_seller/controllers/main.py`) is the public JSON-RPC route
(`type='json'`, no sign-in) the mobile app's Shop screen uses for sort and filters. Params:
`page, category, search, sort, seller, free_shipping, warranty_eligible`. It is on production only
(404 on staging as of 2026-10-01).

## Bug 1 — the string `"false"` is treated as true

Checked on production, 2026-10-01, logged out:

| Params | `filters` echoed back | Result |
|---|---|---|
| `{"warranty_eligible": "false"}` | `"warranty_eligible": true` | filtered (0 products) |
| `{"free_shipping": "true"}` | `"free_shipping": true` | filtered (as expected) |
| `{"warranty_eligible": false}` | `"warranty_eligible": false` | unfiltered (2 products) |

The flags look like they go through Python truthiness (`bool("false") is True`). The route's
documented form (`?free_shipping=false&warranty_eligible=false`) and the website's own form
(`value="1"`) both send strings, so a client following them gets the opposite of what it asked for.

**Fix:** parse `free_shipping` and `warranty_eligible` strictly: accept JSON `true`/`false`, and
for strings only `"1"`, `"true"`, `"on"` (case-insensitive) as true; everything else false.

## Bug 2 — an unknown category id is an unhandled server error

```
POST https://yallashuq.com/shop/products/json
{"jsonrpc":"2.0","method":"call","params":{"category":99999}}
```

returns `{"error": {"code": 200, "message": "Odoo Server Error", "data": {"name":
"odoo.exceptions.MissingError", "debug": "Traceback (most recent call last): ..."}}}` instead of a
result. A deleted or mistyped category (old link, bookmark, shared URL) breaks the whole listing.

This is the same family as **024** (tracebacks in production replies), but separate: 024 is a
server setting (debug details on production). This one is a **missing check in the route**, and
it fails even with debug details turned off.

**Fix:** look the category up with `.exists()` (or catch `MissingError`) and, for an id that
doesn't exist or isn't published, return the normal success shape with `cards: []`,
`total_count: 0` (or a clean `{status: "error", message: ...}`), never an exception.

## Acceptance criteria

1. `"false"`, `"0"`, `""`, `false` and a missing param all mean "not filtered"; `"true"`, `"1"`,
   `"on"` and `true` mean "filtered". `filters` in the reply echoes the parsed value.
2. `category: 99999` (and any id of a deleted category) returns a normal reply with no products,
   or a clean error message, never "Odoo Server Error".
3. Existing behaviour is unchanged for valid input (real booleans, existing category ids).

### Quick test (production)

```bash
B=https://yallashuq.com
for P in '{"warranty_eligible":"false"}' '{"free_shipping":"0"}' '{"category":99999}'; do
  curl -s -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":$P}" $B/shop/products/json | head -c 300; echo
done
```

## Mobile app side (for reference)

`fetchShopProducts` in `src/api/catalog.ts` sends real booleans and only category ids from Home /
Categories, so neither bug shows in the app today. No app change is needed when this is fixed.
