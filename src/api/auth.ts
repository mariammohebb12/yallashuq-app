import { setCartQuantity } from '@/state/cart-quantity';

import { clearCookies } from './cookie-jar';
import { extractAlert, extractForm, extractHiddenFields } from './html-form';
import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { odooJsonRpc, odooRequest, OdooRpcError } from './odoo-client';

/*
 * ============================================================================================
 * TEMPORARY / WORKAROUND FOR MISSING JSON LOGIN ENDPOINT
 * ============================================================================================
 * The backend has no JSON login API. The only login route is Odoo's HTML form route
 * `/web/login` (overridden by yallashuq_seller/controllers/sign_up_controller.py), built for
 * browsers:
 *   - it needs a `csrf_token` (plus other hidden fields, e.g. `login_otp_required`,
 *     `unverified_login`) that only exist inside the HTML of the login page, so we GET the page
 *     and scrape every hidden input out of the form, passing them back unchanged;
 *   - on success it answers with an HTTP redirect (no data), so we treat a redirect as success;
 *   - on failure (wrong credentials, unverified account + OTP resent, ...) it re-renders the whole
 *     login page with the message inside an alert element, so we scrape that message out of the
 *     HTML.
 * This breaks as soon as the web login template changes. Replace this file's internals with a
 * call to a proper JSON endpoint (returning { success, error, redirect }) once the backend adds
 * one — see CLAUDE.md, "Known Blockers". The scraping helpers live in html-form.ts.
 * ============================================================================================
 */

export type LoginResult =
  | { kind: 'success'; redirect: string }
  /** Backend error message (shown in the red alert). */
  | { kind: 'error'; message: string }
  /** Backend info message, e.g. account not verified and OTP resent (shown in the info alert). */
  | { kind: 'info'; message: string }
  /**
   * The account isn't verified: the page came back with `login_otp_required=True` and
   * `unverified_login` set — the live site's trigger for its login OTP modal (see below).
   */
  | { kind: 'otp'; login: string; message?: string };

const LOGIN_FORM_CLASS = 'oe_login_form';

export async function loginWithPassword(login: string, password: string): Promise<LoginResult> {
  try {
    // 1) Load the login page: gets (or reuses, from the cookie jar) the session cookie — which
    //    also carries any guest cart — and the form's hidden fields, including the CSRF token
    //    bound to that session.
    const page = await odooRequest('/web/login', { followRedirects: true });
    const form = extractForm(await page.text(), LOGIN_FORM_CLASS);
    const hiddenFields = form ? extractHiddenFields(form) : undefined;
    if (!hiddenFields?.csrf_token) {
      return { kind: 'error', message: UNEXPECTED_RESPONSE_MESSAGE };
    }

    // 2) Submit the form exactly as the web page does: every hidden field passed through as-is
    //    (csrf_token, type, redirect, login_otp_required, unverified_login, ...), plus the two
    //    visible fields. `login` is sent as typed: the backend handles email/phone lookup.
    const response = await odooRequest('/web/login', {
      method: 'POST',
      form: { ...hiddenFields, login, password },
    });

    if (response.location) {
      // A redirect back to the login page is not a successful login.
      if (new URL(response.location).pathname.startsWith('/web/login')) {
        return { kind: 'error', message: UNEXPECTED_RESPONSE_MESSAGE };
      }
      return { kind: 'success', redirect: response.location };
    }

    const html = await response.text();
    const alert = extractAlert(html, LOGIN_FORM_CLASS);

    // Same condition as the live login_otp.js widget: the OTP modal opens only when the page
    // came back with login_otp_required === "True" and a non-empty unverified_login.
    const returnedForm = extractForm(html, LOGIN_FORM_CLASS);
    const returnedFields = returnedForm ? extractHiddenFields(returnedForm) : undefined;
    if (returnedFields?.login_otp_required === 'True' && returnedFields.unverified_login) {
      return { kind: 'otp', login: returnedFields.unverified_login, message: alert?.message };
    }

    if (alert) {
      return alert.level === 'danger'
        ? { kind: 'error', message: alert.message }
        : { kind: 'info', message: alert.message };
    }
    return { kind: 'error', message: UNEXPECTED_RESPONSE_MESSAGE };
  } catch {
    return { kind: 'error', message: NETWORK_ERROR_MESSAGE };
  }
}

/*
 * Login OTP (unverified account) — the live site's yallashuq_seller/static/src/js/login_otp.js
 * (web.assets_frontend_lazy, checked 2026-09-30 on staging and production):
 *   - verify: JSON-RPC /web/signup/otp/verify { login, otp_code } → { status: "success",
 *     redirect } signs the session in; otherwise { message };
 *   - resend: JSON-RPC /web/signup/otp/resend { login } → { status: "success" } or { message }.
 * Fallback messages are that script's own strings. NOT TESTED END-TO-END: triggering this needs
 * an unverified account, and creating one on staging is blocked (signup OTP: WhatsApp not
 * configured, emails not arriving — see CLAUDE.md).
 */
export type LoginOtpResult = { ok: true } | { ok: false; message: string };

async function loginOtpCall(
  path: string,
  params: object,
  fallback: string,
  connectionError: string
): Promise<LoginOtpResult> {
  try {
    const result = await odooJsonRpc<{ status?: string; message?: string } | null>(path, params);
    return result?.status === 'success' ? { ok: true } : { ok: false, message: result?.message || fallback };
  } catch (error) {
    // Live: a JSON-RPC error reply has no `result`, so the script shows its fallback; only a
    // failed request shows the connection message.
    return { ok: false, message: error instanceof OdooRpcError ? fallback : connectionError };
  }
}

/** On success the session is signed in (the live page then goes to `redirect`, default /my). */
export function verifyLoginOtp(login: string, code: string): Promise<LoginOtpResult> {
  return loginOtpCall(
    '/web/signup/otp/verify',
    { login, otp_code: code },
    'Invalid code',
    'Connection error. Please try again.'
  );
}

export function resendLoginOtp(login: string): Promise<LoginOtpResult> {
  return loginOtpCall(
    '/web/signup/otp/resend',
    { login },
    'Failed to resend',
    'Error resending code.'
  );
}

/*
 * Sign out: GET /web/session/logout — standard Odoo, the same link the live site's "Log Out" uses
 * (checked on staging 2026-09-28, signed in as the test customer). NOT IN CLAUDE.md's CONFIRMED
 * ROUTE LIST. It ends the session on the server and answers with a redirect (not followed).
 *
 * The app's stored cookies are cleared either way, so the app is signed out even when the request
 * fails (e.g. offline) — in that case the old server session simply stays until Odoo expires it.
 * The cart badge goes back to 0: the backend's cart belongs to the old session.
 */
export async function signOut(): Promise<void> {
  try {
    await odooRequest('/web/session/logout');
  } catch {
    // Offline or server error: still sign out locally (see above).
  }
  await clearCookies();
  setCartQuantity(0);
}
