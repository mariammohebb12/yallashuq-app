/**
 * App configuration from environment variables (see `.env`).
 * Expo inlines `EXPO_PUBLIC_*` values at build time; restart the dev server after changing them.
 */

const odooBaseUrl = process.env.EXPO_PUBLIC_ODOO_BASE_URL;
if (!odooBaseUrl) {
  throw new Error('EXPO_PUBLIC_ODOO_BASE_URL is not set. Add it to .env (see .env for the format).');
}

export const Config = {
  /** Odoo backend origin, e.g. https://yallashaq.oodleslab.com (trailing slash stripped). */
  odooBaseUrl: odooBaseUrl.replace(/\/+$/, ''),
} as const;
