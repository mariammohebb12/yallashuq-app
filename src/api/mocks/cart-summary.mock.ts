import type { CartLine, CartSellerGroup, CartSummary } from '../cart';

/*
 * ⚠️ TEMPORARY MOCK CART — NOT REAL, DO NOT SHIP ⚠️
 * TODO: replace with the real cart-contents route response once the backend endpoint exists
 * (docs/backend-requests/001-cart-summary-json.md), then delete this file.
 *
 * An in-memory cart shaped like that route's response, so the Cart screen (per-seller grouping,
 * quantity controls, totals) can be built now. "Add to Cart" still calls the real backend AND
 * adds the product here. It resets when the app reloads.
 *
 * The math below (line totals, subtotals, formatting) exists ONLY in this mock. The real app must
 * not calculate prices, delivery or tax: the backend returns them. Delivery and tax here are
 * made-up fixed values.
 */

type MockLine = {
  line: CartLine;
  sellerName: string;
  priceUnit: number;
  /** eWallet top-up credit: no mock delivery charge. */
  isTopUp?: boolean;
};

export type MockProduct = {
  variantId: number;
  templateId: number;
  name: string;
  imageUrl?: string;
  sellerName: string;
  /** Backend-formatted price, e.g. "₪2000.00" (parsed here only because this is a mock). */
  priceLabel: string;
};

// Made-up per-seller delivery rules, only so both delivery states render.
const MOCK_DELIVERY_FEE = 25;
const MOCK_FREE_THRESHOLD = 300;

let nextLineId = -100;

// Starts with one clearly fake line from a second seller, so grouping by seller is visible as
// soon as a real product is added.
let lines: MockLine[] = [
  {
    sellerName: 'Sample Seller',
    priceUnit: 50,
    line: {
      lineId: nextLineId--,
      productId: -2,
      productTemplateId: -2,
      name: 'Sample Product',
      variantDescription: 'Sample variant',
      imageUrl: '',
      quantity: 2,
      maxQuantity: null,
      priceUnitFormatted: format(50),
      priceTotalFormatted: format(100),
      warning: '',
    },
  },
];

function format(amount: number): string {
  return `₪${amount.toFixed(2)}`;
}

function parsePrice(label: string): number {
  return Number(label.replace(/[^\d.]/g, '')) || 0;
}

function withQuantity(entry: MockLine, quantity: number): MockLine {
  return {
    ...entry,
    line: {
      ...entry.line,
      quantity,
      priceTotalFormatted: format(entry.priceUnit * quantity),
    },
  };
}

export function mockAddProduct(product: MockProduct, quantity = 1) {
  const existing = lines.find((entry) => entry.line.productId === product.variantId);
  if (existing) {
    lines = lines.map((entry) =>
      entry === existing ? withQuantity(entry, entry.line.quantity + quantity) : entry
    );
    return;
  }
  const priceUnit = parsePrice(product.priceLabel);
  lines = [
    ...lines,
    {
      sellerName: product.sellerName,
      priceUnit,
      line: {
        lineId: nextLineId--,
        productId: product.variantId,
        productTemplateId: product.templateId,
        name: product.name,
        variantDescription: '',
        imageUrl: product.imageUrl ?? '',
        quantity,
        maxQuantity: null,
        priceUnitFormatted: format(priceUnit),
        priceTotalFormatted: format(priceUnit * quantity),
        warning: '',
      },
    },
  ];
}

// Made-up: which seller a top-up sits under isn't known (a top-up is presumably sold by YallaShuq
// itself — unconfirmed), nor how the live cart shows it.
const TOP_UP_SELLER = 'YallaShuq';

/**
 * Adds an eWallet top-up line, e.g. "Wallet Top-Up ₪50.00". Each top-up is its own line.
 * (The live Top Up form posts `topup_amount` to /shop/cart/update; the real line isn't known.)
 */
export function mockAddWalletTopUp(amount: number) {
  lines = [
    ...lines,
    {
      sellerName: TOP_UP_SELLER,
      priceUnit: amount,
      isTopUp: true,
      line: {
        lineId: nextLineId--,
        productId: nextLineId--,
        productTemplateId: -3,
        name: `Wallet Top-Up ${format(amount)}`,
        variantDescription: '',
        imageUrl: '',
        quantity: 1,
        maxQuantity: null,
        priceUnitFormatted: format(amount),
        priceTotalFormatted: format(amount),
        warning: '',
      },
    },
  ];
}

/** Sets a line's quantity; 0 removes it (same convention as update_json's set_qty). */
export function mockSetQuantity(lineId: number, quantity: number) {
  lines =
    quantity <= 0
      ? lines.filter((entry) => entry.line.lineId !== lineId)
      : lines.map((entry) => (entry.line.lineId === lineId ? withQuantity(entry, quantity) : entry));
}

export function mockCartSummary(): CartSummary {
  const sellerNames = [...new Set(lines.map((entry) => entry.sellerName))];
  let subtotal = 0;
  let delivery = 0;
  const sellerGroups: CartSellerGroup[] = sellerNames.map((sellerName, index) => {
    const sellerLines = lines.filter((entry) => entry.sellerName === sellerName);
    const sellerSubtotal = sellerLines.reduce(
      (sum, entry) => sum + entry.priceUnit * entry.line.quantity,
      0
    );
    // A group holding only top-ups gets no mock delivery charge (the real rule isn't known).
    const onlyTopUps = sellerLines.every((entry) => entry.isTopUp);
    const isFree = onlyTopUps || sellerSubtotal >= MOCK_FREE_THRESHOLD;
    const fee = isFree ? 0 : MOCK_DELIVERY_FEE;
    subtotal += sellerSubtotal;
    delivery += fee;
    return {
      seller: { id: -(index + 1), name: sellerName, legalName: sellerName, isMarketplace: false },
      lines: sellerLines.map((entry) => entry.line),
      subtotalFormatted: format(sellerSubtotal),
      delivery: {
        calculated: true,
        amountFormatted: format(fee),
        isFree,
        freeThresholdFormatted: format(MOCK_FREE_THRESHOLD),
        remainingForFreeFormatted: format(Math.max(0, MOCK_FREE_THRESHOLD - sellerSubtotal)),
      },
    };
  });

  return {
    orderId: null,
    cartQuantity: lines.reduce((sum, entry) => sum + entry.line.quantity, 0),
    sellerGroups,
    totals: {
      subtotalFormatted: format(subtotal),
      deliveryFormatted: format(delivery),
      taxFormatted: format(0),
      discountFormatted: null,
      totalFormatted: format(subtotal + delivery),
    },
    warnings: [],
  };
}
