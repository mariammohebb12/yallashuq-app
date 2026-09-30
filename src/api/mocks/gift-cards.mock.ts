import type { GiftCard } from '../gift-cards';

/*
 * ⚠️ TEMPORARY MOCK GIFT CARDS — NOT REAL, DO NOT SHIP ⚠️
 * Only used as a labelled fallback while /my/gift-cards/json isn't deployed on the server
 * (staging, checked 2026-09-30) — see src/api/gift-cards.ts. Delete once the real route is
 * verified end-to-end everywhere.
 *
 * Every value is made up. The staging test customer has no gift cards ("You have no gift cards
 * yet." on /my/gift-cards), so a real card has never been seen.
 */
export function mockGiftCards(): GiftCard[] {
  return [
    {
      id: -1,
      programName: 'Sample gift card (mock data)',
      balanceFormatted: '₪ 100.00',
      maskedCode: '•••• 0000',
      expirationFormatted: '12/31/2026',
      state: { code: 'active', label: 'Active' },
    },
  ];
}
