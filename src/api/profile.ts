import { htmlToText, tagAttribute } from './html-form';
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

/*
 * TEMPORARY / WORKAROUND FOR A MISSING JSON ENDPOINT — reads the live "My Account" page (/my).
 *
 * Address and phone aren't in any JSON route (see docs/backend-requests/004-account-summary-json.md),
 * but the page's profile panel (`.o_portal_my_details`) shows them, already formatted by Odoo:
 * the address as one line per <div> (street, street 2, "city zip", state, country) next to the
 * `aria-label="Address"` icon, and the phone in a <span> next to `aria-label="Phone"` (checked on
 * staging 2026-09-28 with the test customer). Reading that block shows exactly what the website
 * shows. Replace with the #004 JSON route once it exists.
 */

export type ProfileDetails = {
  /** Address lines as the website shows them; [] when the customer has none. */
  addressLines: string[];
  /** null when the customer has none. */
  phone: string | null;
};

export type ProfileDetailsResult =
  | { ok: true; details: ProfileDetails | null } // null = signed out, or the panel wasn't found
  | { ok: false; message: string };

const PANEL_START = 'o_portal_my_details';

function oneLine(html: string): string {
  return htmlToText(html).replace(/\s+/g, ' ').trim();
}

export function parseProfileDetails(html: string): ProfileDetails | null {
  const start = html.indexOf(PANEL_START);
  if (start === -1) {
    return null; // Page layout changed (or not the account page): don't guess.
  }
  // The panel ends at its "Edit information" link (href="/my/account").
  const end = html.indexOf('/my/account', start);
  const panel = html.slice(start, end === -1 ? undefined : end);

  const addressStart = panel.search(/aria-label="Address"/);
  const addressEnd = panel.search(/aria-label="(?:Phone|Email)"/);
  const addressLines =
    addressStart === -1
      ? []
      : [...panel.slice(addressStart, addressEnd === -1 ? undefined : addressEnd).matchAll(
          /<div>([^<]*)<\/div>/g
        )]
          .map(([, text]) => oneLine(text))
          .filter(Boolean);

  const phoneMatch = /aria-label="Phone"[^>]*>\s*<\/i>\s*<span>([\s\S]*?)<\/span>/.exec(panel);
  const phone = phoneMatch ? oneLine(phoneMatch[1]) || null : null;

  return { addressLines, phone };
}

export async function fetchProfileDetails(): Promise<ProfileDetailsResult> {
  try {
    const response = await odooRequest('/my');
    if (response.status !== 200) {
      return { ok: true, details: null };
    }
    return { ok: true, details: parseProfileDetails(await response.text()) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}
