# Backend request 025 — `/my/orders/<id>/json` order lines need a product id

**Status:** Open — small, add-only CODE change. Blocks moving the app's "Order Again" feature off
HTML scraping. Not urgent: the scraping workaround still works.
**Requested:** 2026-09-30
**For:** whoever maintains the YallaShuq Odoo backend (`yallashuq_seller/controllers/orders.py`)

## Context (read this first)

YallaShuq (yallashuq.com; staging: yallashaq.oodleslab.com) is a multi-seller marketplace built on
**Odoo 18 Enterprise** with custom addons. The backend repo is
`github.com/pranavkakkar24/yallashuq`, branch `develop`. It was built by Oodles Technologies, who
are **no longer involved in the project**. Don't assume anything was agreed with them. This
document is meant to be complete on its own. Requests 001–024 have the same background.

A native mobile app (React Native / Expo, iOS + Android) is being built for customers. Its Home
screen has an **"Order Again"** row: the products the signed-in customer bought before, each shown
as a normal catalog product card (image, today's price/discount, seller) with a button that adds
it to the cart again.

## What exists

The orders JSON routes asked for in request 005 now exist (commit df4de4c, live on production;
**not deployed on staging yet** — 404 there, checked 2026-09-30):

- `/my/orders/json` — the customer's orders (newest first, paginated).
- `/my/orders/<int:order_id>/json` — one order, with `lines[]`. Each line has:
  `id` (the sale.order.line id), `name`, `product_uom_qty`, `price_unit`, `price_subtotal`,
  `price_total`, `is_extended_warranty`.

## The gap

A line says **what was bought only as text** (`name`, e.g. `"[YO223] Badminton Racket"`). There is
no product reference, so the app can't find the product in the catalog. Matching by name isn't
acceptable: names can be edited, are translated per language, can include the internal reference
or not, and different sellers can sell products with the same name.

Today the app works around this by reading the **HTML** order pages (`/my/orders/<id>`) and taking
the product.template id from each line's product link (`/shop/<slug>-<template id>`). That breaks
as soon as the page template changes.

## What's needed (add-only — don't rename or remove existing fields)

Add to each item of `lines[]` in `/my/orders/<int:order_id>/json`:

| Field | Type | Meaning |
|---|---|---|
| `product_template_id` | int or `false` | `line.product_id.product_tmpl_id.id` — **this is the one the app needs** |
| `product_id` | int or `false` | `line.product_id.id` (the variant) — nice to have |
| `is_delivery` | bool | `line.is_delivery` — nice to have, so delivery lines (e.g. "Delivery (John Doe)") can be skipped reliably |

`false` when the line has no product (e.g. a note or section line).

`is_extended_warranty` **already exists and is useful**: the app will use it to leave protection
plan / extended warranty lines out of "Order Again", since they aren't products to buy again.

The same customer-only access rules as the rest of the route apply (a customer must only ever see
their own orders). Nothing else about the route needs to change.

## How the app will use it

`/my/orders/json` → the newest 20 orders → `/my/orders/<id>/json` for each (in parallel) → each
line's `product_template_id`, skipping extended-warranty and delivery lines, first occurrence only
→ the catalog card for that product. Products no longer in the catalog are skipped.

## Not done

No backend code was read or changed. The fields above come from the route contract as relayed by
the project owner (`yallashuq_seller/controllers/orders.py`), not from a live response.
