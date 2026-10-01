import { mockOrderDetail } from './orders.mock';
import type { ReturnDetail, ReturnForm, ReturnSummary } from '../returns';

/*
 * ⚠️ TEMPORARY MOCK RETURNS — NOT REAL, DO NOT SHIP ⚠️
 * Only used where /my/returns/json and /my/returns/<id>/json are missing (a 404, e.g. staging);
 * delete once both are deployed everywhere. The return form mock is still used (no route yet).
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

/**
 * The live /my/returns table for the staging test customer, row for row and in its order
 * (checked 2026-09-28): Return #, Order, Pickup Date, Refunded, both status badges.
 * Only RET/00006 and RET/00005 have sample details above; the other two open "not found".
 */
const RETURN_LIST: ReturnSummary[] = [
  {
    id: 7,
    name: 'RET/00007',
    order: { id: 66, name: 'S00066' },
    pickupDateFormatted: '09/20/2026',
    refundedFormatted: '₪ 2,360.00',
    progress: RECEIVED,
    decision: SELLER_ACCEPTED,
  },
  {
    id: 6,
    name: 'RET/00006',
    order: { id: 63, name: 'S00063' },
    pickupDateFormatted: '09/17/2026',
    refundedFormatted: '₪ 2,360.00',
    progress: RECEIVED,
    decision: SELLER_ACCEPTED,
  },
  {
    id: 5,
    name: 'RET/00005',
    order: { id: 60, name: 'S00060' },
    pickupDateFormatted: '09/12/2026',
    refundedFormatted: '₪ 2,360.00',
    progress: RECEIVED,
    decision: SELLER_ACCEPTED,
  },
  {
    id: 4,
    name: 'RET/00004',
    order: { id: 59, name: 'S00059' },
    pickupDateFormatted: '09/16/2026',
    refundedFormatted: '₪ 2,360.00',
    progress: RECEIVED,
    decision: SELLER_ACCEPTED,
  },
];

export function mockReturnList(): ReturnSummary[] {
  return RETURN_LIST;
}

/**
 * The live form's "Reason for Return" options, exactly as staging lists them (checked 2026-09-27),
 * without the empty "Select reason" option.
 */
const REASONS: ReturnForm['reasons'] = [
  { code: 'damaged', label: 'Damaged Product' },
  { code: 'wrong_item', label: 'Wrong Item Received' },
  { code: 'not_as_described', label: 'Not as Described' },
  { code: 'quality_issue', label: 'Quality Issue' },
  { code: 'size_issue', label: 'Size/Fit Issue' },
  { code: 'changed_mind', label: 'Changed Mind' },
  { code: 'other', label: 'Other' },
];

/**
 * The return form for a mock order: its product lines (not the delivery line), each returnable up
 * to the quantity ordered — like staging's S00073 form ("Badminton Racket", 2 / 2). Parsing the
 * quantity out of "2.00 Units" happens ONLY in this mock; the real route returns numbers.
 */
export function mockReturnForm(orderId: number): ReturnForm | null {
  const order = mockOrderDetail(orderId);
  if (!order) {
    return null;
  }
  return {
    order: { id: order.id, name: order.name },
    lines: order.lines
      .filter((line) => !line.isDelivery)
      .map((line) => ({
        lineId: line.id,
        productName: line.name,
        maxQuantity: Math.max(1, Math.round(parseFloat(line.quantityFormatted) || 1)),
      })),
    reasons: REASONS,
  };
}
