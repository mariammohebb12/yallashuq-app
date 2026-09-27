import type { WalletOption, WalletSummary } from '../wallet';

/*
 * ⚠️ TEMPORARY MOCK WALLET — NOT REAL, DO NOT SHIP ⚠️
 * TODO: replace with a real wallet route once one exists (no JSON route for the wallet on
 * staging, checked 2026-09-27), then delete this file.
 *
 * The staging test customer's real /my/wallet shows ₪ 0.00 and "No transactions found.", so
 * every value here is made up so the layout isn't empty. The row fields (date, description,
 * amount, type) are what the screen was asked to show — the live page's transaction columns
 * haven't been seen yet (no test customer with a transaction).
 */
export function mockWallet(): WalletSummary {
  return {
    balanceFormatted: '₪ 250.00',
    transactions: [
      {
        id: -1,
        dateFormatted: '09/24/2026',
        description: 'Wallet top-up',
        amountFormatted: '+ ₪ 200.00',
        type: { code: 'topup', label: 'Top-up' },
        isCredit: true,
      },
      {
        id: -2,
        dateFormatted: '09/18/2026',
        description: 'Refund for order S00072',
        amountFormatted: '+ ₪ 120.00',
        type: { code: 'refund', label: 'Refund' },
        isCredit: true,
      },
      {
        id: -3,
        dateFormatted: '09/10/2026',
        description: 'Withdrawal request',
        amountFormatted: '- ₪ 100.00',
        type: { code: 'withdrawal', label: 'Withdrawal' },
        isCredit: false,
      },
      {
        id: -4,
        dateFormatted: '09/02/2026',
        description: 'Wallet top-up',
        amountFormatted: '+ ₪ 30.00',
        type: { code: 'topup', label: 'Top-up' },
        isCredit: true,
      },
    ],
  };
}

/**
 * The Withdraw screen's "Select Wallet" options. On staging this dropdown (`card_id`) is EMPTY
 * for the test customer, so what a real option's label looks like isn't known.
 */
export function mockWithdrawWallets(): WalletOption[] {
  return [{ id: -1, label: 'Sample wallet (mock data)' }];
}
