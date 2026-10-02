import { NETWORK_ERROR_MESSAGE } from './messages';
import { odooJsonRpc, odooRequest } from './odoo-client';

/*
 * Address Book: list/create/edit/delete addresses for the signed-in customer.
 *
 * Backend (yallashuq_seller/controllers/address_book.py, added 2026-10-02, tracker #22):
 *   - POST /my/addresses/json            (type='json')  -> list
 *   - POST /my/address/edit/json         (type='json')  -> create (address_id omitted/0) or edit
 *   - POST /my/address/delete            (type='http', form POST) -> delete (archives, not a hard
 *     delete); answers with an HTTP redirect, no JSON body, so success is read off the response
 *     rather than parsed as JSON.
 */

export type Address = {
  id: number;
  isPrimary: boolean;
  name: string;
  street: string;
  street2: string;
  city: string;
  zip: string;
  stateId: number | null;
  stateName: string;
  countryId: number | null;
  countryName: string;
  phone: string;
  email: string;
};

type AddressJson = {
  id: number;
  is_primary: boolean;
  name: string;
  street: string;
  street2: string;
  city: string;
  zip: string;
  state_id: number | false;
  state_name: string;
  country_id: number | false;
  country_name: string;
  phone: string;
  email: string;
};

function mapAddress(a: AddressJson): Address {
  return {
    id: a.id,
    isPrimary: a.is_primary,
    name: a.name || '',
    street: a.street || '',
    street2: a.street2 || '',
    city: a.city || '',
    zip: a.zip || '',
    stateId: a.state_id || null,
    stateName: a.state_name || '',
    countryId: a.country_id || null,
    countryName: a.country_name || '',
    phone: a.phone || '',
    email: a.email || '',
  };
}

export type AddressesResult =
  | { ok: true; addresses: Address[] }
  | { ok: false; message: string };

type AddressesJsonResponse =
  | { status: 'success'; addresses: AddressJson[] }
  | { status: 'error'; message: string };

export async function fetchAddresses(): Promise<AddressesResult> {
  try {
    const result = await odooJsonRpc<AddressesJsonResponse>('/my/addresses/json', {});
    if (result.status !== 'success') {
      return { ok: false, message: result.message || NETWORK_ERROR_MESSAGE };
    }
    return { ok: true, addresses: result.addresses.map(mapAddress) };
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}

export type AddressFields = {
  name: string;
  street: string;
  street2: string;
  city: string;
  zip: string;
  phone: string;
  email: string;
};

export type SaveAddressResult =
  | { ok: true; address: Address }
  | { ok: false; message: string };

type SaveAddressJsonResponse =
  | { status: 'success'; address: AddressJson }
  | { status: 'error'; message: string };

/** Pass `addressId: null` to create a new address rather than edit an existing one. */
export async function saveAddress(
  addressId: number | null,
  fields: AddressFields
): Promise<SaveAddressResult> {
  try {
    const result = await odooJsonRpc<SaveAddressJsonResponse>('/my/address/edit/json', {
      address_id: addressId || 0,
      ...fields,
    });
    if (result.status !== 'success') {
      return { ok: false, message: result.message || NETWORK_ERROR_MESSAGE };
    }
    return { ok: true, address: mapAddress(result.address) };
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}

export type DeleteAddressResult = { ok: true } | { ok: false; message: string };

/**
 * The backend route is a plain form POST that answers with a redirect (not JSON) — same shape as
 * the live site's own delete link. Any response (redirect or plain 2xx) counts as success; only a
 * network failure is reported as an error.
 */
export async function deleteAddress(addressId: number): Promise<DeleteAddressResult> {
  try {
    await odooRequest('/my/address/delete', {
      method: 'POST',
      form: { address_id: String(addressId) },
    });
    return { ok: true };
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}
