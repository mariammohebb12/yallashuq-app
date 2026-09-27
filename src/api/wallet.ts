import { mockAddWalletTopUp, mockCartSummary } from './mocks/cart-summary.mock';
import { mockWallet, mockWithdrawWallets } from './mocks/wallet.mock';

/*
 * ---------------------------------------------------------------------------------------------
 * eWallet (balance + transaction history).
 *
 * ⚠️ BLOCKED ON BACKEND — RUNS ON TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * No route returns the wallet as JSON: /my/wallet, /my/wallet/topup and /my/wallet/withdraw are
 * server-rendered HTML only, the frontend JS has no wallet code, and /my/counters has no wallet
 * key (checked on staging 2026-09-27). Until a route exists, fetchWallet returns SAMPLE DATA
 * (src/api/mocks/wallet.mock.ts). Amounts are the backend's formatted strings — nothing is
 * calculated in the app.
 * ---------------------------------------------------------------------------------------------
 */

export type WalletTransactionType = {
  code: 'topup' | 'refund' | 'withdrawal' | (string & {});
  /** Backend-translated label, e.g. "Top-up". */
  label: string;
};

export type WalletTransaction = {
  id: number;
  dateFormatted: string;
  description: string;
  /** Signed and formatted by the backend, e.g. "+ ₪ 200.00". */
  amountFormatted: string;
  type: WalletTransactionType;
  /** Money in (true) or out (false); only used for the amount's color. */
  isCredit: boolean;
};

export type WalletSummary = {
  /** Live "Available Balance", e.g. "₪ 0.00". */
  balanceFormatted: string;
  transactions: WalletTransaction[];
};

export type WalletResult =
  | { ok: true; wallet: WalletSummary; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * TEMPORARY: returns a mock wallet (isSampleData: true).
 * TODO: replace with the real wallet route once it exists.
 */
export async function fetchWallet(): Promise<WalletResult> {
  return { ok: true, wallet: mockWallet(), isSampleData: true };
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
 * TEMPORARY: returns one mock wallet (isSampleData: true). The live options are only in the
 * /my/wallet/withdraw HTML (empty for the staging test customer).
 * TODO: replace with the real wallet route once it exists.
 */
export async function fetchWithdrawWallets(): Promise<WalletOptionsResult> {
  return { ok: true, wallets: mockWithdrawWallets(), isSampleData: true };
}
