import type { ReturnDetail } from '../returns';

/*
 * ⚠️ TEMPORARY MOCK RETURNS — NOT REAL, DO NOT SHIP ⚠️
 * TODO: replace with a return-detail route once it exists, then delete this file.
 *
 * Copied from staging's real /my/returns/6 and /my/returns/5 (checked 2026-09-27): product, qty,
 * price, refunded, total, pickup date/slot, order, refund method, reason, "-" return reason and
 * both badges, exactly as shown. Not copied: the customer photo (it exists on staging, at
 * /web/image/return.request/<id>/issue_image, but needs sign-in), so imageUrl is null and the
 * screen shows a placeholder.
 * Note: the orders mock shows "Sample Product" on S00063 / S00060, while the real returns are for
 * a Badminton Racket and Wireless Headphones.
 */

const RECEIVED = { code: 'received', label: 'Received & Verified' };
const SELLER_ACCEPTED = { code: 'accepted', label: 'Seller Accepted' };

const RETURNS: ReturnDetail[] = [
  {
    id: 6,
    name: 'RET/00006',
    progress: RECEIVED,
    decision: SELLER_ACCEPTED,
    lines: [
      {
        id: 61,
        productName: 'Badminton Racket',
        quantityFormatted: '1.0',
        priceFormatted: '₪ 2,000.00',
        refundedFormatted: '₪ 2,360.00',
      },
    ],
    totalExpectedRefundFormatted: '₪ 2,360.00',
    pickups: [{ dateFormatted: '09/17/2026', slotLabel: 'Morning (9 AM - 12 PM)' }],
    order: { id: 63, name: 'S00063' },
    refundMethodLabel: 'Original Payment Method',
    reasonLabel: 'Not as Described',
    returnReasonLabel: '-',
    imageUrl: null,
  },
  {
    id: 5,
    name: 'RET/00005',
    progress: RECEIVED,
    decision: SELLER_ACCEPTED,
    lines: [
      {
        id: 51,
        productName: 'Wireless Headphones',
        quantityFormatted: '1.0',
        priceFormatted: '₪ 2,000.00',
        refundedFormatted: '₪ 2,360.00',
      },
    ],
    totalExpectedRefundFormatted: '₪ 2,360.00',
    pickups: [{ dateFormatted: '09/12/2026', slotLabel: 'Morning (9 AM - 12 PM)' }],
    order: { id: 60, name: 'S00060' },
    refundMethodLabel: 'Original Payment Method',
    reasonLabel: 'Not as Described',
    returnReasonLabel: '-',
    imageUrl: null,
  },
];

export function mockReturnDetail(id: number): ReturnDetail | null {
  return RETURNS.find((entry) => entry.id === id) ?? null;
}
