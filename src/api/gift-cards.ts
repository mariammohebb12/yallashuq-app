import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { mockGiftCards } from './mocks/gift-cards.mock';
import { odooJsonRpc } from './odoo-client';
import { formatDate as formatDateLocale, formatMoney as formatMoneyLocale } from '@/utils/locale-format';

/*
 * ---------------------------------------------------------------------------------------------
 * My Gift Cards.
 *
 * REAL CONTRACT, NOT YET TESTED END-TO-END. The route comes from the backend controller
 * yallashuq_gifts_ewallet/controllers/portal.py (portal_my_gift_cards_json), as pasted by the
 * user. It is NOT on staging yet: 404 there (checked 2026-09-30, signed in). On production it
 * exists (unauthenticated JSON-RPC returns "Odoo Session Expired"), but no signed-in response has
 * been seen yet.
 *
 * - POST (JSON-RPC) /my/gift-cards/json {} → { status, gift_cards: [...] }
 *
 * Not visually verified with a populated card: the staging test customer has none.
 *
 * - `code` is the full gift card code (not pre-masked), so the app only ever keeps and shows a
 *   masked form. The masking style ("•••• " + last 4) is the app's own, not confirmed.
 * - Amounts are plain numbers plus a currency code; shown like the wallet, "₪ 100.00" (ILS or
 *   no currency). Any other code is shown as text, e.g. "100.00 USD", never with the ₪ symbol.
 * - `state` values aren't enumerated: shown as-is (made readable), with one neutral badge.
 *
 * Fallback: ONLY when the route isn't there (a non-JSON reply, i.e. staging's 404 page),
 * fetchGiftCards returns labelled SAMPLE DATA (isSampleData: true). Any real error (signed out,
 * network, backend error) is an error state.
 * ---------------------------------------------------------------------------------------------
 */

export type GiftCardState = {
  /** The backend's loyalty.card `state`; unknown values are shown as-is. */
  code: string;
  /** Made from `state` in the app (e.g. "active" → "Active"); the backend sends no label. */
  label: string;
};

export type GiftCard = {
  id: number;
  programName: string;
  /** e.g. "₪ 100.00". */
  balanceFormatted: string;
  /** e.g. "•••• AB12". The full code is never kept. */
  maskedCode: string;
  /** MM/DD/YYYY; null when the card has no expiration date. */
  expirationFormatted: string | null;
  state: GiftCardState;
};

export type GiftCardsResult =
  | { ok: true; giftCards: GiftCard[]; isSampleData: boolean }
  | { ok: false; message: string };

/** Odoo sends `false` for empty fields. */
type GiftCardsJsonResponse = {
  status: 'success' | (string & {});
  message?: string;
  gift_cards: {
    id: number;
    code: string;
    balance: number;
    currency: string | false;
    expiration_date: string | false;
    program_name: string;
    state: string;
  }[];
};

// Fixed 2026-10-02, frontend sweep: money/date used to be hardcoded to the live website's own
// one-format-for-everyone convention (MM/DD/YYYY, plain comma grouping) regardless of the app's
// selected language — confirmed with Mariam this should NOT match the website; now locale-aware
// (src/utils/locale-format.ts). Currency contract (₪ for ILS, code suffix otherwise) unchanged.
const formatMoney = formatMoneyLocale;

function maskCode(code: string): string {
  const trimmed = (code || '').trim();
  return trimmed.length > 4 ? `•••• ${trimmed.slice(-4)}` : '••••';
}

function formatDate(value: string | false): string | null {
  return value ? formatDateLocale(value) : null;
}

function readableLabel(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** REAL (untested end-to-end, see top of file). */
export async function fetchGiftCards(): Promise<GiftCardsResult> {
  let data: GiftCardsJsonResponse;
  try {
    data = await odooJsonRpc<GiftCardsJsonResponse>('/my/gift-cards/json', {});
  } catch (error) {
    // A non-JSON reply (SyntaxError) is the 404 HTML page of a server without the route.
    if (error instanceof SyntaxError) {
      if (__DEV__) {
        console.log('[gift cards] /my/gift-cards/json not deployed on this server — SAMPLE DATA');
      }
      return { ok: true, giftCards: mockGiftCards(), isSampleData: true };
    }
    return {
      ok: false,
      message: error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE,
    };
  }
  if (data?.status !== 'success' || !Array.isArray(data.gift_cards)) {
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  return {
    ok: true,
    isSampleData: false,
    giftCards: data.gift_cards.map((card) => ({
      id: card.id,
      programName: card.program_name || '',
      balanceFormatted: formatMoney(card.balance ?? 0, card.currency),
      maskedCode: maskCode(card.code),
      expirationFormatted: formatDate(card.expiration_date),
      state: { code: card.state || '', label: readableLabel(card.state || '') },
    })),
  };
}
