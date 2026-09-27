import { fetchCartSummary, type CartSummary } from './cart';
import { MOCK_DELIVERY_METHOD_NAME, mockAddAddress, mockAddresses } from './mocks/checkout.mock';

/*
 * ---------------------------------------------------------------------------------------------
 * Checkout, step 1: Address & Delivery (the live /shop/checkout page).
 *
 * ⚠️ BLOCKED ON BACKEND — ADDRESSES RUN ON TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * The live page renders the saved addresses and delivery methods as HTML only. Until a JSON
 * source exists, fetchCheckout returns SAMPLE addresses (src/api/mocks/checkout.mock.ts). The
 * order summary is the Cart's own data (fetchCartSummary — itself still the mock cart, #001), so
 * both screens always agree. Nothing is calculated here.
 * ---------------------------------------------------------------------------------------------
 */

export type CheckoutAddress = {
  id: number;
  name: string;
  street: string;
  /** Apartment / unit; "" if none. */
  street2: string;
  city: string;
  region: string;
  zip: string;
  /** Country name as displayed. */
  country: string;
  email: string;
  phone: string;
};

/** What the Add Address form collects (the backend assigns the id). */
export type NewAddress = Omit<CheckoutAddress, 'id'>;

export type DeliveryMethod = {
  id: number;
  name: string;
  /** Backend-formatted price for this cart, e.g. "₪ 25.00". */
  priceFormatted: string;
};

export type CheckoutData = {
  addresses: CheckoutAddress[];
  /** Pre-selected address (live: the customer's default); null if they have none. */
  defaultAddressId: number | null;
  deliveryMethods: DeliveryMethod[];
  cart: CartSummary;
};

export type CheckoutResult =
  | { ok: true; data: CheckoutData; isSampleData: boolean }
  | { ok: false; message: string };

/**
 * TEMPORARY: sample addresses + the (mock) cart. The delivery method's price is the cart's own
 * delivery total. TODO: real addresses / delivery methods once a JSON source exists.
 */
export async function fetchCheckout(): Promise<CheckoutResult> {
  const cartResult = await fetchCartSummary();
  if (!cartResult.ok) {
    return cartResult;
  }
  const { cart } = cartResult;
  const addresses = mockAddresses();
  return {
    ok: true,
    isSampleData: true,
    data: {
      addresses,
      defaultAddressId: addresses[0]?.id ?? null,
      deliveryMethods: [
        { id: -1, name: MOCK_DELIVERY_METHOD_NAME, priceFormatted: cart.totals.deliveryFormatted },
      ],
      cart,
    },
  };
}

/**
 * TEMPORARY: adds the address to the in-memory mock list only (nothing is saved anywhere real;
 * it's gone after an app reload). No JSON route for saving addresses is confirmed yet — the live
 * form posts HTML to /shop/address.
 */
export async function saveAddress(
  address: NewAddress
): Promise<{ ok: true; address: CheckoutAddress } | { ok: false; message: string }> {
  return { ok: true, address: mockAddAddress(address) };
}
