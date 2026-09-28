import type {
  OrderDetail,
  OrderPaymentStatus,
  OrderReturn,
  OrderStatus,
  OrderSummary,
} from '../orders';

/*
 * ⚠️ TEMPORARY MOCK ORDERS — NOT REAL, DO NOT SHIP ⚠️
 * TODO: replace with the real order list/detail routes once they exist
 * (docs/backend-requests/005-orders-json.md), then delete this file.
 *
 * Shaped like the staging test customer's real /my/orders page (checked 2026-09-26): the same 13
 * order references, dates and times, in the same order, with "Return" on the same 6 of them, and
 * the same totals — except S00072, which shows the real Microwave Oven (so it has a different
 * image from the first two) at its real price, giving ₪ 3,540.00 instead of staging's ₪ 2,596.00.
 * The products on the first three orders (racket, headphones, microwave) are real staging
 * products with their real images; which product was in which staging order isn't known.
 * Line items, taxes ("18% PA", "VAT 18%") and the free per-seller delivery line follow the one
 * order inspected in detail (S00073). Everything else is made up:
 * - statuses and sellers (detail only, like the rest of the richer data; requested in #005);
 * - the customer contact (placeholder values, NOT the test customer's real details);
 * - the tracking number/carrier on S00073 (staging showed no tracking anywhere);
 * - payment status: paid everywhere except S00066 (still packing, not paid yet), so the
 *   "payment successfully processed" banner shows only where it's true.
 *
 * Variety on the detail screen: S00073 shipped + paid + returnable + tracking; S00072 delivered +
 * paid + returnable; S00066 packing + not paid + no delivery yet + no return; S00063 and S00060
 * delivered + paid + an existing return request.
 *
 * The totals math below exists ONLY in this mock. The real app must not calculate amounts or
 * taxes: the backend returns them.
 */

const STATUS: Record<'packing' | 'shipped' | 'delivered', OrderStatus> = {
  packing: { code: 'packing', label: 'Packing' },
  shipped: { code: 'shipped', label: 'Shipped' },
  delivered: { code: 'delivered', label: 'Delivered' },
};

const SELLERS = {
  johnDoe: { id: -1, name: 'John Doe' }, // The seller of the staging orders.
  sample: { id: -2, name: 'Sample Seller' },
};

type MockProduct = {
  /** product.template id on staging; null for the made-up sample product. */
  templateId: number | null;
  /** Template name: what the review popup and the order line show. */
  templateName: string;
  /** Internal reference (live: "[YO223] Badminton Racket"); null when unknown. */
  sku: string | null;
  price: number;
  imagePath: string | null;
};

// Real staging products (name, price and thumbnail from the catalog); the sample product has none.
const RACKET: MockProduct = {
  templateId: 52,
  templateName: 'Badminton Racket',
  sku: 'YO223', // Seen on staging's order S00073.
  price: 2000,
  imagePath: '/web/image/product.template/52/image_256',
};
const HEADPHONES: MockProduct = {
  templateId: 50,
  templateName: 'Wireless Headphones',
  sku: null,
  price: 2000,
  imagePath: '/web/image/product.template/50/image_256',
};
const MICROWAVE: MockProduct = {
  templateId: 54,
  templateName: 'Microwave Oven',
  sku: null,
  price: 3000,
  imagePath: '/web/image/product.template/54/image_256',
};
const SAMPLE_PRODUCT: MockProduct = {
  templateId: null,
  templateName: 'Sample Product',
  sku: null,
  price: 2200,
  imagePath: null,
};

type MockSpec = {
  id: number;
  date: string;
  time: string;
  status: keyof typeof STATUS;
  seller: keyof typeof SELLERS;
  product: MockProduct;
  quantity: number;
  returnAvailable: boolean;
};

// Staging's list order (not strictly by date: S00073 comes before S00074).
const SPECS: MockSpec[] = [
  { id: 73, date: '09/16/2026', time: '14:17:53', status: 'shipped', seller: 'johnDoe', product: RACKET, quantity: 2, returnAvailable: true },
  { id: 74, date: '09/16/2026', time: '14:03:08', status: 'shipped', seller: 'johnDoe', product: HEADPHONES, quantity: 1, returnAvailable: true },
  { id: 72, date: '09/15/2026', time: '14:57:28', status: 'delivered', seller: 'johnDoe', product: MICROWAVE, quantity: 1, returnAvailable: true },
  { id: 71, date: '09/15/2026', time: '14:55:28', status: 'delivered', seller: 'sample', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: true },
  { id: 68, date: '09/15/2026', time: '14:48:10', status: 'delivered', seller: 'johnDoe', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: true },
  { id: 67, date: '09/15/2026', time: '11:54:12', status: 'shipped', seller: 'johnDoe', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: true },
  { id: 66, date: '09/14/2026', time: '14:18:55', status: 'packing', seller: 'johnDoe', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: false },
  { id: 65, date: '09/11/2026', time: '19:45:10', status: 'packing', seller: 'sample', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: false },
  { id: 63, date: '09/11/2026', time: '18:01:55', status: 'delivered', seller: 'johnDoe', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: false },
  { id: 62, date: '09/11/2026', time: '15:29:53', status: 'delivered', seller: 'johnDoe', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: false },
  { id: 61, date: '09/11/2026', time: '15:28:26', status: 'delivered', seller: 'sample', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: false },
  { id: 60, date: '09/11/2026', time: '15:15:37', status: 'delivered', seller: 'johnDoe', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: false },
  { id: 59, date: '09/11/2026', time: '14:43:12', status: 'delivered', seller: 'johnDoe', product: SAMPLE_PRODUCT, quantity: 1, returnAvailable: false },
];

const NOT_PAID_ORDERS = [66];

// Real staging returns (checked 2026-09-27): RET/00006 on S00063 and RET/00005 on S00060, with
// their real pickup dates, items qty (1) and badges ("Accepted" as the order's return page shows
// it; the /my/returns list says "Seller Accepted" for the same returns). Staging also has
// RET/00007 on S00066 and RET/00004 on S00059; not attached here — S00066 is "packing" in this
// mock. The status codes are made up; only the labels were seen.
const RECEIVED: OrderReturn['progress'] = { code: 'received', label: 'Received & Verified' };
const ACCEPTED: OrderReturn['decision'] = { code: 'accepted', label: 'Accepted' };
const RETURNS: Record<number, OrderReturn[]> = {
  63: [
    {
      id: 6,
      name: 'RET/00006',
      pickupDateFormatted: '09/17/2026',
      itemsQtyFormatted: '1',
      progress: RECEIVED,
      decision: ACCEPTED,
    },
  ],
  60: [
    {
      id: 5,
      name: 'RET/00005',
      pickupDateFormatted: '09/12/2026',
      itemsQtyFormatted: '1',
      progress: RECEIVED,
      decision: ACCEPTED,
    },
  ],
};

const PAYMENT: Record<'paid' | 'notPaid', OrderPaymentStatus> = {
  paid: { code: 'paid', label: 'Paid' },
  notPaid: { code: 'not_paid', label: 'Not Paid' },
};

const VAT_RATE = 0.18; // Staging: "18% PA" per line, "VAT 18%" in the totals.

/** "4720" → "4,720.00" (the live page's number format). */
function number(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "4720" → "₪ 4,720.00" (the live page's amount format). */
function money(amount: number): string {
  return `₪ ${number(amount)}`;
}

function amounts(spec: MockSpec) {
  const untaxed = spec.product.price * spec.quantity;
  const tax = untaxed * VAT_RATE;
  return { untaxed, tax, total: untaxed + tax };
}

function summary(spec: MockSpec): OrderSummary {
  return {
    id: spec.id,
    name: `S000${spec.id}`,
    dateFormatted: spec.date,
    timeFormatted: spec.time,
    totalFormatted: money(amounts(spec).total),
    returnAvailable: spec.returnAvailable,
    // Site-relative, as the backend would send it (orders.ts turns it into a URL).
    firstProductImageUrl: spec.product.imagePath,
  };
}

export function mockOrderList(): OrderSummary[] {
  return SPECS.map(summary);
}

export function mockOrderDetail(id: number): OrderDetail | null {
  const spec = SPECS.find((entry) => entry.id === id);
  if (!spec) {
    return null;
  }
  const { untaxed, tax, total } = amounts(spec);
  const seller = SELLERS[spec.seller];
  // Sample document numbers in staging's format, derived from the order id.
  const documentNumber = String(spec.id).padStart(5, '0');
  return {
    ...summary(spec),
    status: STATUS[spec.status],
    seller,
    contact: {
      name: 'Sample Customer',
      addressLines: ['Sample Street 1', 'Sample Building', 'Sample City 00000', 'Sample Region'],
      phone: '+000 00 000 0000',
      email: 'customer@example.com',
    },
    lines: [
      {
        id: spec.id * 10 + 1,
        name: spec.product.templateName,
        isDelivery: false,
        sku: spec.product.sku,
        quantityFormatted: `${number(spec.quantity)} Units`,
        priceUnitFormatted: number(spec.product.price),
        taxesLabel: '18% PA',
        amountFormatted: money(untaxed),
      },
      {
        id: spec.id * 10 + 2,
        name: `Delivery (${seller.name})`,
        isDelivery: true,
        sku: null,
        quantityFormatted: '1.00 Units',
        priceUnitFormatted: 'FREE',
        taxesLabel: '18% PA',
        amountFormatted: money(0),
      },
    ],
    totals: {
      untaxedFormatted: money(untaxed),
      taxGroups: [{ label: 'VAT 18%', amountFormatted: money(tax) }],
      totalFormatted: money(total),
    },
    paymentStatus: NOT_PAID_ORDERS.includes(spec.id) ? PAYMENT.notPaid : PAYMENT.paid,
    paymentTermsLabel: 'Immediate Payment', // Staging: "Payment terms: Immediate Payment".
    invoices: [
      {
        id: -spec.id,
        name: `INV/2026/${documentNumber}`,
        dateFormatted: spec.date,
      },
    ],
    deliveries:
      spec.status === 'packing'
        ? []
        : [
            {
              id: -spec.id,
              name: `WH/OUT/${documentNumber}`,
              dateFormatted: spec.date,
              status: STATUS[spec.status],
              tracking:
                spec.id === 73 ? { number: 'SAMPLE-TRACKING-0001', carrier: 'Sample Carrier' } : null,
            },
          ],
    termsUrl: '/terms',
    returns: RETURNS[spec.id] ?? [],
  };
}
