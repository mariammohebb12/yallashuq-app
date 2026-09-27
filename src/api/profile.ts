import { tagAttribute } from './html-form';
import { NETWORK_ERROR_MESSAGE } from './messages';
import { odooRequest } from './odoo-client';

/*
 * TEMPORARY / WORKAROUND FOR A MISSING JSON ENDPOINT — reads the live /my/account HTML form.
 *
 * First / Last Name aren't stored anywhere the app can read as JSON: res.partner only has `name`
 * ("David Miller"; no first_name/last_name fields — checked on staging 2026-09-27), and the
 * /my/account page splits it server-side into its pre-filled `first_name` / `last_name` inputs.
 * Reading those inputs gives exactly what the website shows, without guessing the split rule.
 * Replace with the JSON route asked for in docs/backend-requests/004-account-summary-json.md.
 */

export type ProfileNames = { firstName: string; lastName: string };

export type ProfileNamesResult =
  | { ok: true; names: ProfileNames | null } // null = signed out (redirected to login)
  | { ok: false; message: string };

function inputValue(html: string, name: string): string {
  for (const [input] of html.matchAll(/<input\b[^>]*>/gi)) {
    if (tagAttribute(input, 'name') === name) {
      return tagAttribute(input, 'value') ?? '';
    }
  }
  return '';
}

export async function fetchProfileNames(): Promise<ProfileNamesResult> {
  try {
    const response = await odooRequest('/my/account');
    if (response.status !== 200) {
      return { ok: true, names: null };
    }
    const html = await response.text();
    return {
      ok: true,
      names: { firstName: inputValue(html, 'first_name'), lastName: inputValue(html, 'last_name') },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}
