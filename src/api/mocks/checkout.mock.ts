import type { CheckoutAddress, DeliveryMethod, NewAddress } from '../checkout';

/*
 * ⚠️ TEMPORARY MOCK CHECKOUT ADDRESSES — NOT REAL, DO NOT SHIP ⚠️
 * TODO: replace with the customer's real saved addresses and delivery methods once a JSON source
 * exists (the live /shop/checkout page renders them as HTML only), then delete this file.
 *
 * Shaped like the address cards on staging's /shop/checkout (checked 2026-09-26): name, street,
 * apartment/unit, city, region, postal code, country. All values are made up (NOT the test
 * customer's real address). The order summary is NOT mocked here: it comes from the Cart's data.
 *
 * "Save address" (Add Address screen) now saves for real (saveAddress in ../checkout.ts) and no
 * longer appends here, so a saved address doesn't appear in this list. mockAddAddress is unused.
 */

let addresses: CheckoutAddress[] = [
  {
    id: -1,
    name: 'Sample Customer',
    street: 'Sample Street 1',
    street2: 'Apartment 4',
    city: 'Sample City',
    region: 'Sample Region',
    zip: '00000',
    country: 'Israel',
    email: 'customer@example.com',
    phone: '+972 00 000 0000',
  },
  {
    id: -2,
    name: 'Sample Customer',
    street: 'Sample Road 25',
    street2: '',
    city: 'Other City',
    region: 'Other Region',
    zip: '11111',
    country: 'State of Palestine',
    email: 'customer@example.com',
    phone: '+970 00 000 0000',
  },
];

let nextId = -100;

export function mockAddresses(): CheckoutAddress[] {
  return addresses;
}

export function mockAddAddress(address: NewAddress): CheckoutAddress {
  const saved = { ...address, id: nextId-- };
  addresses = [...addresses, saved];
  return saved;
}

/** Staging offers one method, "Standard delivery". */
export const MOCK_DELIVERY_METHOD_NAME: DeliveryMethod['name'] = 'Standard delivery';
