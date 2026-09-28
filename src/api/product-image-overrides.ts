import { Image } from 'react-native';

import { odooUrl } from './odoo-client';

/*
 * ⚠️ TEMPORARY DISPLAY OVERRIDE — REMOVE ONCE THE BACKEND IMAGES ARE FIXED ⚠️
 *
 * Front-end only (client request 2026-09-28): these products' backend photos look messy in the
 * app, so the app shows a local image instead. Nothing changes on the backend — the website, and
 * anything else reading Odoo, still shows the old photo.
 *
 * Remove the product's entry (and its file in assets/images/product-overrides/) as soon as the
 * Odoo admin or seller uploads a clean image to that product in Odoo (Sales → Products). Delete
 * this file once the list is empty.
 *
 * Keyed by product.template id on STAGING (yallashaq.oodleslab.com). Live may use different ids —
 * check before release.
 */
const OVERRIDES: Record<number, number> = {
  // Microwave Oven — backend photo is a busy countertop shot.
  54: require('@/assets/images/product-overrides/microwave-oven.png'),
  // Badminton Racket — NOTE: the replacement image shows a tennis-style racket (flagged
  // 2026-09-28; client chose to use it anyway).
  52: require('@/assets/images/product-overrides/badminton-racket.png'),
};

const TEMPLATE_IMAGE_PATH = /\/web\/image\/product\.template\/(\d+)\//;

/**
 * URL for a backend product image path (e.g. "/web/image/product.template/54/image_512"), or the
 * local override image when that product has one (see above).
 */
export function productImageUrl(path: string): string {
  const match = TEMPLATE_IMAGE_PATH.exec(path);
  const override = match ? OVERRIDES[Number(match[1])] : undefined;
  return override ? Image.resolveAssetSource(override).uri : odooUrl(path);
}
