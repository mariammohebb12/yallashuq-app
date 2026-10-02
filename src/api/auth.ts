import { setCartQuantity } from '@/state/cart-quantity';

import { clearCookies } from './cookie-jar';
import { extractAlert, extractForm, extractHiddenFields } from './html-form';
import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { odooJsonRpc, odooRequest, OdooRpcError } from './odoo-client';
import { unregisterPushToken } from './push-notifications';

/*
 * ============================================================================================
 * FIXED 2026-10-02 (bug: "/web/login sends back a whole webpage instead of a simple yes/no
 * answer, so the app has to 'read' the page text to guess if login worked — fragile, could
 * break silently").
 * ============================================================================================
 * Used to scrape Odoo's HTML login form (CSRF token, hidden fields, alert text) because there
 * was no JSON login route. The backend now has one: POST /mobile/login { login, password } →
 * { status: 'success' } | { status: 'otp_required', login, message } | { status: 'error',
 * message } — real answers, not HTML to parse. It runs the exact same login logic the web form
 * does (phone lookup, the unverified-account OTP branch, Odoo's own session.authenticate), just
 * returns the result as data instead of a re-rendered page.
 * The HTML-scraping helpers (html-form.ts) are no longer used by this function, kept for
 * whatever still needs them (signup is a separate, still-HTML-only flow — not touched here).
 * ============================================================================================
 */

export type LoginResult =
  | { kind: 'success' }
  /** Backend error message (shown in the red alert). */
  | { kind: 'error'; message: string }
  /** Backend info message, e.g. account not verified and OTP resent (shown in the info alert). */
  | { kind: 'info'; message: string }
  /**
   * The account isn't verified: the backend sent a login OTP and expects the app's OTP step.
   */
  | { kind: 'otp'; login: string; message?: string };

type MobileLoginResponse = {
  status: 'success' | 'otp_required' | 'error' | (string & {});
  login?: string;
  message?: string;
};

export async function loginWithPassword(login: string, password: string): Promise<LoginResult> {
  try {
    const result = await odooJsonRpc<MobileLoginResponse | null>('/mobile/login', {
      login,
      password,
    });
    if (result?.status === 'success') {
      return { kind: 'success' };
    }
    if (result?.status === 'otp_required' && result.login) {
      return { kind: 'otp', login: result.login, message: result.message };
    }
    return { kind: 'error', message: result?.message || UNEXPECTED_RESPONSE_MESSAGE };
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof OdooRpcError ? UNEXPECTED_RESPONSE_MESSAGE : NETWORK_ERROR_MESSAGE,
    };
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
  // Fixed 2026-10-02 (tracker #25/#31): stop this device's push token from reaching whoever
  // signs in here next, now that a real backend route exists to unregister it. Done before the
  // session itself ends (the unregister call needs to still be authenticated as this user) and
  // best-effort like the logout call below — a failure here still signs the app out locally.
  await unregisterPushToken();
  try {
    await odooRequest('/web/session/logout');
  } catch {
    // Offline or server error: still sign out locally (see above).
  }
  await clearCookies();
  setCartQuantity(0);
}
