import { fetchAddresses, type Address } from './addresses';
import { fetchCartSummary, type CartSummary } from './cart';
import { extractForm, extractHiddenFields } from './html-form';
import { NETWORK_ERROR_MESSAGE, UNEXPECTED_RESPONSE_MESSAGE } from './messages';
import { MOCK_DELIVERY_METHOD_NAME } from './mocks/checkout.mock';
import { odooRequest } from './odoo-client';

/*
 * ---------------------------------------------------------------------------------------------
 * Checkout, step 1: Address & Delivery (the live /shop/checkout page).
 *
 * Fixed 2026-10-02: the address list here was sample data because no JSON address route existed
 * yet (docs/backend-requests/019). The real Address Book routes built for tracker #22
 * (`/my/addresses/json` etc., src/api/addresses.ts) now cover this — fetchCheckout uses them
 * below, so the addresses shown here are the customer's real saved ones.
 *
 * STILL NOT REAL: delivery methods (no backend route confirmed for choosing one — name stays
 * `MOCK_DELIVERY_METHOD_NAME`, price is the real cart's own delivery total) and the Order
 * summary's cart totals come from `fetchCartSummary`.
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

function toCheckoutAddress(a: Address): CheckoutAddress {
  return {
    id: a.id,
    name: a.name,
    street: a.street,
    street2: a.street2,
    city: a.city,
    region: a.stateName,
    zip: a.zip,
    country: a.countryName,
    email: a.email,
    phone: a.phone,
  };
}

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
 * Real addresses (src/api/addresses.ts); the cart is still fetchCartSummary's own data. The
 * delivery method is still a placeholder name (no real "choose a method" route confirmed) — its
 * price is the real cart's own delivery total, so the number itself is correct.
 */
export async function fetchCheckout(): Promise<CheckoutResult> {
  const [cartResult, addressesResult] = await Promise.all([fetchCartSummary(), fetchAddresses()]);
  if (!cartResult.ok) {
    return cartResult;
  }
  if (!addressesResult.ok) {
    return { ok: false, message: addressesResult.message };
  }
  const { cart } = cartResult;
  const addresses = addressesResult.addresses.map(toCheckoutAddress);
  const defaultAddress = addressesResult.addresses.find((a) => a.isDefault);
  return {
    ok: true,
    isSampleData: false,
    data: {
      addresses,
      defaultAddressId: defaultAddress?.id ?? addresses[0]?.id ?? null,
      deliveryMethods: [
        { id: -1, name: MOCK_DELIVERY_METHOD_NAME, priceFormatted: cart.totals.deliveryFormatted },
      ],
      cart,
    },
  };
}

/*
 * Add Address: the live checkout form, submitted the way the website's own script does.
 *
 * TEMPORARY / WORKAROUND FOR A MISSING JSON ADDRESS ROUTE (see
 * docs/backend-requests/019-address-book-missing.md). Checked on staging 2026-09-28:
 * - GET /shop/address?address_type=delivery renders the form (class "checkout_autoformat") with
 *   hidden fields csrf_token, address_type, required_fields, delivery_latitude/longitude. It only
 *   works while the customer has a cart; without one it redirects to /shop.
 * - POST /shop/address/submit (form-encoded, csrf_token required — without it: 400) replies with
 *   JSON: {"successUrl": "/shop/checkout"} when saved, or
 *   {"invalid_fields": [...], "messages": [...]} (e.g. all empty → name, phone, street,
 *   country_id, city + "Some required fields are empty.").
 * - Side effect (standard Odoo checkout): the new delivery address also becomes the cart's
 *   delivery address on the backend.
 * The Delivery step's address list is still sample data (fetchCheckout above), so a saved
 * address doesn't appear in it yet.
 */

const ADDRESS_FORM_PATH = '/shop/address?address_type=delivery';
const ADDRESS_SUBMIT_PATH = '/shop/address/submit';

// PLACEHOLDER COPY (not confirmed anywhere): the backend refused because there's no cart.
const NO_CART_MESSAGE = 'Add a product to your cart before adding an address.';

/** What the Add Address form sends (Odoo ids for country and state). */
export type AddressInput = {
  name: string;
  email: string;
  phone: string;
  street: string;
  /** Apartment / unit; "" if none. */
  street2: string;
  city: string;
  zip: string;
  countryId: string;
  /** undefined when the country has no states or none was chosen. */
  stateId?: string;
};

export type SaveAddressResult =
  | { ok: true }
  /** invalidFields: the backend's field names, e.g. "country_id" (empty if none were named). */
  | { ok: false; message: string; invalidFields: string[] };

export async function saveAddress(input: AddressInput): Promise<SaveAddressResult> {
  try {
    const page = await odooRequest(ADDRESS_FORM_PATH);
    if (page.location) {
      return { ok: false, message: NO_CART_MESSAGE, invalidFields: [] };
    }
    const form = extractForm(await page.text(), 'checkout_autoformat');
    const hidden = form ? extractHiddenFields(form) : {};
    if (!hidden.csrf_token) {
      return { ok: false, message: UNEXPECTED_RESPONSE_MESSAGE, invalidFields: [] };
    }

    const response = await odooRequest(ADDRESS_SUBMIT_PATH, {
      method: 'POST',
      form: {
        ...hidden,
        name: input.name,
        email: input.email,
        phone: input.phone,
        street: input.street,
        street2: input.street2,
        city: input.city,
        zip: input.zip,
        country_id: input.countryId,
        state_id: input.stateId ?? '',
      },
    });
    if (response.status !== 200) {
      return { ok: false, message: UNEXPECTED_RESPONSE_MESSAGE, invalidFields: [] };
    }
    const data = JSON.parse(await response.text()) as {
      successUrl?: string;
      redirectUrl?: string;
      invalid_fields?: string[];
      messages?: string[];
    };
    if (data.successUrl) {
      return { ok: true };
    }
    if (data.redirectUrl) {
      return { ok: false, message: NO_CART_MESSAGE, invalidFields: [] };
    }
    return {
      ok: false,
      message: data.messages?.filter(Boolean).join('\n') || UNEXPECTED_RESPONSE_MESSAGE,
      invalidFields: data.invalid_fields ?? [],
    };
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE, invalidFields: [] };
  }
}
