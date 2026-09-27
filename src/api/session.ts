import { NETWORK_ERROR_MESSAGE } from './messages';
import { odooJsonRpc, OdooRpcError } from './odoo-client';

/*
 * Who is signed in: POST /web/session/get_session_info (standard Odoo JSON-RPC, auth='user').
 * NOT IN CLAUDE.md's CONFIRMED ROUTE LIST — standard Odoo, used to decide signed in / signed out.
 *
 * Verified on staging (2026-09-25): for a guest it fails with "Odoo Session Expired"
 * (odoo.http.SessionExpiredException), which is how "signed out" is detected here.
 * NOT YET VERIFIED for a signed-in customer (needs the staging test account): the field names
 * below are standard Odoo 18 session_info keys and are read defensively.
 *
 * Standard Odoo returns no address or phone here — see the Account tab's missing-data notes.
 */

export type Session = {
  uid: number;
  /** Display name. */
  name: string;
  /** The login (email or phone — the backend accepts both). */
  login: string;
  partnerId: number | null;
};

export type SessionResult =
  | { ok: true; session: Session | null } // null = signed out
  | { ok: false; message: string };

type SessionInfoResponse = {
  uid?: number | false;
  name?: string;
  username?: string;
  partner_id?: number | false;
};

export async function fetchSession(): Promise<SessionResult> {
  try {
    const info = await odooJsonRpc<SessionInfoResponse>('/web/session/get_session_info', {});
    if (!info?.uid) {
      return { ok: true, session: null };
    }
    return {
      ok: true,
      session: {
        uid: info.uid,
        name: info.name ?? '',
        login: info.username ?? '',
        partnerId: info.partner_id || null,
      },
    };
  } catch (error) {
    if (error instanceof OdooRpcError && /session expired/i.test(error.message)) {
      return { ok: true, session: null }; // Guest: no signed-in user.
    }
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
}
