import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { odooJsonRpc } from './odoo-client';
import {
  toSmartSearchResult,
  type RawSmartSearchResult,
  type SmartSearchResult,
} from './smart-search';

/*
 * ---------------------------------------------------------------------------------------------
 * MishMesh assistant: POST (JSON-RPC) /inventory_engine/chat — public, guests allowed.
 *
 * REAL CONTRACT (odoo_inventory_engine/controllers/main.py, read 2026-10-01; checked on production
 * the same day, logged out):
 * - params {query, history: [{role: 'user' | 'assistant', content}]}
 * - → {status: 'success', ai_message, results, product_data?} or {status: 'error', message}
 * - `results` come from the inventory engine's fuzzy_search — the SAME rows as Smart Search's
 *   /inventory/search/query (id, name, price, currency, qty, seller, image, url, …), NOT the
 *   catalog's product cards: no variant id (so no Add to Cart), small image_128. Mapped with Smart
 *   Search's own mapper.
 * - The [HIDE_RESULTS] / [CONFIRM_PRODUCT] / [CREATE_PRODUCT] tags are stripped server-side.
 *   `product_data` is the seller "add product" form-fill tool: ignored by this customer app.
 * - The error `message` is the raw Python exception text, so the app shows its own generic message
 *   instead (the backend's text is only logged in development).
 * - Escalation (mishmesh_helpdesk_support, commit f756149): asking for a person can make the
 *   backend create a real support ticket + channel and reply with text saying so. The reply carries
 *   no flag; the chat checks /mishmesh/support/status afterwards (see mishmesh-chat.tsx).
 *
 * TIMEOUT: the backend's AI call has none (replies took 50–90 s on 2026-09-28, ~5 s on
 * 2026-10-01), and odooJsonRpc can't abort a request, so after CHAT_TIMEOUT_MS the app stops
 * waiting and reports `timedOut`; a reply arriving later is ignored by the caller.
 * Production replies are slow but real; staging's AI is off (it answers "I'm currently resting").
 * ---------------------------------------------------------------------------------------------
 */

export const CHAT_TIMEOUT_MS = 30_000;

/** A previous turn of the conversation, as the website's chat script sends it. */
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type ChatReply = {
  /** May be '' (e.g. results only). */
  text: string;
  results: SmartSearchResult[];
};

export type ChatResult =
  | ({ ok: true } & ChatReply)
  | { ok: false; message: string; timedOut?: boolean };

type ChatJsonResponse = {
  status: 'success' | 'error' | (string & {});
  message?: string;
  ai_message?: string | false;
  results?: RawSmartSearchResult[];
};

const TIMED_OUT = Symbol('timed out');

/**
 * Sends one message. `history` = the earlier turns only: the backend appends `query` itself (the
 * website also puts the current message in history, so it reaches the AI twice — not copied here).
 */
export async function sendChatMessage(query: string, history: ChatTurn[]): Promise<ChatResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), CHAT_TIMEOUT_MS);
  });
  let data: ChatJsonResponse | typeof TIMED_OUT;
  try {
    data = await Promise.race([
      odooJsonRpc<ChatJsonResponse>('/inventory_engine/chat', { query, history }),
      timeout,
    ]);
  } catch (error) {
    return {
      ok: false,
      // A non-JSON reply (SyntaxError) = an HTML error page; never shown as text.
      message:
        error instanceof SyntaxError
          ? UNEXPECTED_RESPONSE_MESSAGE
          : error instanceof Error && error.message
            ? error.message
            : NETWORK_ERROR_MESSAGE,
    };
  } finally {
    clearTimeout(timer);
  }
  if (data === TIMED_OUT) {
    return { ok: false, message: '', timedOut: true };
  }
  if (data?.status !== 'success') {
    if (__DEV__) {
      console.log('[mishmesh] chat error:', data?.message);
    }
    return { ok: false, message: UNEXPECTED_RESPONSE_MESSAGE };
  }
  return {
    ok: true,
    text: typeof data.ai_message === 'string' ? data.ai_message.trim() : '',
    results: (data.results ?? []).map(toSmartSearchResult),
  };
}
