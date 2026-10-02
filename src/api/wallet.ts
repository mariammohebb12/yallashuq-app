import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { mockAddWalletTopUp, mockCartSummary } from './mocks/cart-summary.mock';
import { mockWallet, mockWithdrawWallets } from './mocks/wallet.mock';
import { odooJsonRpc } from './odoo-client';
import { formatDate as formatDateLocale, formatMoney as formatMoneyLocale } from '@/utils/locale-format';

/*
 * ---------------------------------------------------------------------------------------------
 * eWallet (balance + transaction history + withdrawal requests).
 *
 * REAL CONTRACT, NOT YET TESTED END-TO-END. The routes below come from the backend controller
 * yallashuq_gifts_ewallet/controllers/wallet_json.py (commit 8c74008, deployed to production
 * 2026-09-30), as pasted by the user. They are NOT on staging yet: both return a 404 HTML page
 * there (checked 2026-09-30, signed in). On production they exist (unauthenticated JSON-RPC
 * returns "Odoo Session Expired"), but no signed-in response has been seen yet.
 *
 * - POST (JSON-RPC) /my/wallet/json { page, limit, date_from, date_to }
 * - POST (JSON-RPC) /my/wallet/withdraw/json { amount, payment_details, card_id }
 *
 * The backend sends amounts as plain numbers with no currency. The app shows them as
 * "₪ 1,234.00", like the live /my/wallet page. Nothing is calculated in the app: the balance is
 * the backend's `total_balance` as-is.
 *
 * Fallback: ONLY when the route isn't there (a non-JSON reply, i.e. staging's 404 page),
 * fetchWallet returns the labelled SAMPLE DATA (isSampleData: true → the screen shows its
 * "Sample data" banner). Any real error (signed out, network, backend error) is an error state.
 * ---------------------------------------------------------------------------------------------
 */

export type WalletTransactionType = {
  /** The backend's `operation`; the possible values aren't documented yet. */
  code: 'topup' | 'refund' | 'withdrawal' | (string & {});
  /** Made from `operation` in the app (e.g. "top_up" → "Top up"); the backend sends no label. */
  label: string;
};

export type WalletTransaction = {
  id: number;
  dateFormatted: string;
  description: string;
  /** Signed, e.g. "+ ₪ 200.00". */
  amountFormatted: string;
  type: WalletTransactionType;
  /** Money in (true) or out (false); only used for the amount's color. */
  isCredit: boolean;
};

export type WalletSummary = {
  /** The backend's `total_balance`, e.g. "₪ 0.00" (shown under "Available Balance"). */
  balanceFormatted: string;
  transactions: WalletTransaction[];
  /** Returned by the backend but not shown on the screen yet (null on sample data). */
  frozenBalanceFormatted: string | null;
  dailyLimitFormatted: string | null;
  /** e.g. 'active' or 'none'. */
  walletStatus: string | null;
  /** Transaction paging: the screen only asks for the first page. */
  page: number;
  pageCount: number;
  totalCount: number;
};

export type WalletResult =
  | { ok: true; wallet: WalletSummary; isSampleData: boolean }
  | { ok: false; message: string };

/** Odoo sends `false` for empty fields. */
type WalletJsonResponse = {
  status: 'success' | (string & {});
  message?: string;
  total_balance: number;
  frozen_balance: number;
  daily_limit: number;
  wallet_status: string;
  page: number;
  page_count: number;
  total_count: number;
  transactions: {
    id: number;
    operation: string;
    amount: number;
    balance_before: number;
    balance_after: number;
    note: string | false;
    date: string | false;
  }[];
};

export type WalletQuery = {
  page?: number;
  limit?: number;
  /** "YYYY-MM-DD" */
  dateFrom?: string;
  dateTo?: string;
};

// Fixed 2026-10-02, frontend sweep: money/date used to be hardcoded to the live website's own
// one-format-for-everyone convention (MM/DD/YYYY, plain comma grouping) regardless of the app's
// selected language — confirmed with Mariam this should NOT match the website; now locale-aware
// (src/utils/locale-format.ts). Currency contract (₪, ILS-only here) is unchanged.
const formatMoney = formatMoneyLocale;
const formatDate = formatDateLocale;

function operationLabel(operation: string): string {
  const words = operation.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function mapTransaction(row: WalletJsonResponse['transactions'][number]): WalletTransaction {
  // The balance going up is money in; `amount`'s own sign for withdrawals isn't documented.
  const isCredit =
    row.balance_after !== row.balance_before ? row.balance_after > row.balance_before : row.amount >= 0;
  const label = operationLabel(row.operation || '');
  return {
    id: row.id,
    dateFormatted: formatDate(row.date),
    description: row.note || label,
    amountFormatted: `${isCredit ? '+' : '-'} ${formatMoney(Math.abs(row.amount))}`,
    type: { code: row.operation, label },
    isCredit,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : NETWORK_ERROR_MESSAGE;
}

/**
 * REAL (untested end-to-end, see top of file): the wallet and one page of its transactions.
 * Falls back to labelled sample data only while the route isn't deployed (staging).
 */
export async function fetchWallet({
  page = 1,
  limit = 20,
  dateFrom,
  dateTo,
}: WalletQuery = {}): Promise<WalletResult> {
  let data: WalletJsonResponse;
  try {
    data = await odooJsonRpc<WalletJsonResponse>('/my/wallet/json', {
      page,
      limit,
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
    });
  } catch (error) {
    // A non-JSON reply (SyntaxError) is the 404 HTML page of a server without the route.
    if (error instanceof SyntaxError) {
      if (__DEV__) {
        console.log('[wallet] /my/wallet/json not deployed on this server — showing SAMPLE DATA');
      }
      return { ok: true, wallet: mockWallet(), isSampleData: true };
    }
    return { ok: false, message: errorMessage(error) };
  }
  if (data?.status !== 'success' || !Array.isArray(data.transactions)) {
    return { ok: false, message: data?.message || UNEXPECTED_RESPONSE_MESSAGE };
  }
  return {
    ok: true,
    isSampleData: false,
    wallet: {
      balanceFormatted: formatMoney(data.total_balance ?? 0),
      transactions: data.transactions.map(mapTransaction),
      frozenBalanceFormatted: formatMoney(data.frozen_balance ?? 0),
      dailyLimitFormatted: formatMoney(data.daily_limit ?? 0),
      walletStatus: data.wallet_status || null,
      page: data.page,
      pageCount: data.page_count,
      totalCount: data.total_count,
    },
  };
}

/**
 * Top Up: the live form (/my/wallet/topup) posts `topup_amount` to /shop/cart/update, which puts
 * a top-up credit in the cart; it's then paid through the normal checkout.
 *
 * TEMPORARY: only adds a "Wallet Top-Up ₪…" line to the MOCK cart (nothing is sent to the
 * backend); `cartQuantity` is the mock cart's count, for the tab badge.
 * TODO: post to the real route once the cart comes from the backend
 * (docs/backend-requests/001-cart-summary-json.md) — that form post needs the page's csrf_token.
 */
export async function addWalletTopUpToCart(
  amount: number
): Promise<{ ok: true; cartQuantity: number } | { ok: false; message: string }> {
  mockAddWalletTopUp(amount);
  return { ok: true, cartQuantity: mockCartSummary().cartQuantity };
}

/** One option of the Withdraw form's "Select Wallet" dropdown (live: `card_id`). */
export type WalletOption = { id: number; label: string };

export type WalletOptionsResult =
  | { ok: true; wallets: WalletOption[]; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * STILL MOCK (isSampleData: true). Neither new route lists the wallets a customer can withdraw
 * to: /my/wallet/withdraw/json only *takes* a `card_id`. The live options are only in the
 * /my/wallet/withdraw HTML (empty for the staging test customer).
 * TODO: needs a backend route (or a field on /my/wallet/json) that lists them.
 */
export async function fetchWithdrawWallets(): Promise<WalletOptionsResult> {
  return { ok: true, wallets: mockWithdrawWallets(), isSampleData: true };
}

export type WithdrawResult = { ok: true; withdrawalId: number } | { ok: false; message: string };

type WithdrawJsonResponse =
  | { status: 'success'; withdrawal_id: number }
  | { status: 'error'; message: string };

/**
 * REAL (untested end-to-end): submits a withdrawal request (subject to admin approval).
 * NOT wired to the Withdraw screen yet: its wallet options are still mock ids (see above), and
 * sending one to the backend would be meaningless.
 */
export async function submitWithdrawal(
  amount: number,
  paymentDetails: string,
  cardId: number
): Promise<WithdrawResult> {
  try {
    const data = await odooJsonRpc<WithdrawJsonResponse>('/my/wallet/withdraw/json', {
      amount,
      payment_details: paymentDetails,
      card_id: cardId,
    });
    if (data?.status === 'success' && typeof data.withdrawal_id === 'number') {
      return { ok: true, withdrawalId: data.withdrawal_id };
    }
    return {
      ok: false,
      message: (data?.status === 'error' && data.message) || UNEXPECTED_RESPONSE_MESSAGE,
    };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}
