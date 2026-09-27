import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { saveAddress } from '@/api/checkout';
import {
  loadSignupForm,
  loadStates,
  type CountryOption,
  type StateOption,
} from '@/api/signup';
import { DisabledButton } from '@/components/coming-soon';
import { FieldLabel, PressableField, REQUIRED_MESSAGE, TextField } from '@/components/form-fields';
import { FormMessage } from '@/components/form-message';
import { PickerModal, type PickerItem } from '@/components/picker-modal';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Add Address — opened by "Add address" on Checkout step 1 (Address & Delivery).
 * Fields in the live form's order, one column, styled like Login/Signup (shared form-fields).
 *
 * ⚠️ NOT SAVED ANYWHERE REAL ⚠️
 * "Save address" adds the address to the in-memory mock list on the Delivery step
 * (saveAddress in src/api/checkout.ts) and goes back; it's gone after an app reload. No JSON route
 * for saving addresses is confirmed yet (the live form posts HTML to /shop/address).
 *
 * Real data: the Country list (with Odoo ids) and the State/Province list come from the same
 * backend sources the signup screens use (the signup page's country list, and the JSON route
 * /web/signup/states). Country defaults to Israel.
 *
 * "Delivery Location": the text input is typeable but not saved (it's for the live map lookup),
 * and the "Location" button is disabled ("Coming soon") — map / geolocation picking is out of
 * scope for now.
 *
 * Required fields (PLACEHOLDER VALIDATION, standard Odoo checkout rules, not confirmed on the live
 * form): full name, email, phone (more than the prefix), street, city, country; State/Province
 * only when the country has states.
 */

const COPY = {
  // COPY FROM THE USER (2026-09-26): the live form's labels / placeholders.
  title: 'Add address',
  fullName: 'Full name',
  email: 'Email',
  phone: 'Phone',
  street: 'Street and Number',
  deliveryLocation: 'Delivery Location',
  deliveryAddress: 'Delivery Address',
  locationPlaceholder: 'Enter address or pick location on map',
  location: 'Location',
  street2: 'Apartment, suite, etc.',
  city: 'City',
  zip: 'Zip Code',
  country: 'Country',
  state: 'State/Province',
  statePlaceholder: 'State/Province...',
  discard: 'Discard',
  save: 'Save address',
  // PLACEHOLDER COPY (not confirmed anywhere).
  countryPlaceholder: 'Select country',
  searchCountry: 'Search country...',
  searchState: 'Search state...',
  countriesError: "The country list couldn't be loaded.",
};

const DEFAULT_COUNTRY_NAME = 'Israel';
const PHONE_PREFIX = '+972'; // Pre-filled like the live form.

type FieldKey = 'name' | 'email' | 'phone' | 'street' | 'city' | 'country' | 'state';

export default function AddAddressScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(PHONE_PREFIX);
  const [street, setStreet] = useState('');
  const [locationText, setLocationText] = useState('');
  const [street2, setStreet2] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');

  const [countries, setCountries] = useState<CountryOption[] | null>(null);
  const [countriesError, setCountriesError] = useState<string>();
  const [countryId, setCountryId] = useState<string>();
  const [states, setStates] = useState<StateOption[]>([]);
  const [stateId, setStateId] = useState<string>();
  const [openPicker, setOpenPicker] = useState<'country' | 'state' | null>(null);

  const [missing, setMissing] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  // Real country list; default to Israel.
  useEffect(() => {
    let active = true;
    loadSignupForm('customer').then((form) => {
      if (!active) {
        return;
      }
      if ('error' in form) {
        setCountriesError(COPY.countriesError);
        setCountries([]);
        return;
      }
      setCountries(form.countries);
      setCountryId(
        (current) => current ?? form.countries.find((c) => c.name === DEFAULT_COUNTRY_NAME)?.id
      );
    });
    return () => {
      active = false;
    };
  }, []);

  // States belong to the chosen country.
  useEffect(() => {
    if (countryId === undefined) {
      return;
    }
    let active = true;
    loadStates(countryId)
      .then((list) => active && setStates(list))
      .catch(() => active && setStates([]));
    return () => {
      active = false;
    };
  }, [countryId]);

  const selectedCountry = countries?.find((c) => c.id === countryId);
  const selectedState = states.find((s) => s.id === stateId);

  const countryItems = useMemo<PickerItem[]>(
    () => (countries ?? []).map((c) => ({ key: c.id, label: c.name })),
    [countries]
  );
  const stateItems = useMemo<PickerItem[]>(
    () => states.map((s) => ({ key: s.id, label: s.name })),
    [states]
  );

  function errorFor(field: FieldKey) {
    return missing[field] ? REQUIRED_MESSAGE : undefined;
  }

  function onChange(field: FieldKey, setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setMissing((current) => ({ ...current, [field]: false }));
    };
  }

  function selectCountry(id: string) {
    setOpenPicker(null);
    if (id !== countryId) {
      setCountryId(id);
      setStates([]);
      setStateId(undefined);
    }
    setMissing((current) => ({ ...current, country: false, state: false }));
  }

  function selectState(id: string) {
    setOpenPicker(null);
    setStateId(id);
    setMissing((current) => ({ ...current, state: false }));
  }

  async function handleSave() {
    const check: Record<FieldKey, boolean> = {
      name: name.trim() === '',
      email: email.trim() === '',
      phone: phone.trim() === '' || phone.trim() === PHONE_PREFIX,
      street: street.trim() === '',
      city: city.trim() === '',
      country: selectedCountry === undefined,
      state: states.length > 0 && selectedState === undefined,
    };
    setMissing(check);
    if (Object.values(check).some(Boolean)) {
      return;
    }
    setSaving(true);
    setErrorMessage(undefined);
    const result = await saveAddress({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      street: street.trim(),
      street2: street2.trim(),
      city: city.trim(),
      zip: zip.trim(),
      region: selectedState?.name ?? '',
      country: selectedCountry!.name,
    });
    setSaving(false);
    if (result.ok) {
      router.back(); // The Delivery step reloads its list when it's shown again.
    } else {
      setErrorMessage(result.message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: COPY.title }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.fields}>
          <TextField
            label={COPY.fullName}
            value={name}
            onChangeText={onChange('name', setName)}
            autoComplete="name"
            textContentType="name"
            error={errorFor('name')}
          />
          <TextField
            label={COPY.email}
            value={email}
            onChangeText={onChange('email', setEmail)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            error={errorFor('email')}
          />
          <TextField
            label={COPY.phone}
            value={phone}
            onChangeText={onChange('phone', setPhone)}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errorFor('phone')}
          />
          <TextField
            label={COPY.street}
            value={street}
            onChangeText={onChange('street', setStreet)}
            autoComplete="address-line1"
            textContentType="streetAddressLine1"
            error={errorFor('street')}
          />

          {/* ---- Delivery Location ---- */}
          <View style={styles.locationBox}>
            <Text style={styles.locationTitle}>{COPY.deliveryLocation}</Text>
            <FieldLabel>{COPY.deliveryAddress}</FieldLabel>
            <TextInput
              style={styles.locationInput}
              value={locationText}
              onChangeText={setLocationText}
              placeholder={COPY.locationPlaceholder}
              placeholderTextColor={Colors.placeholderIcon}
            />
            {/* Disabled: map / geolocation picking is out of scope for now (not faked). */}
            <DisabledButton label={COPY.location} style={styles.locationButton} />
          </View>

          <TextField
            label={COPY.street2}
            value={street2}
            onChangeText={setStreet2}
            autoComplete="address-line2"
            textContentType="streetAddressLine2"
          />
          <TextField
            label={COPY.city}
            value={city}
            onChangeText={onChange('city', setCity)}
            textContentType="addressCity"
            error={errorFor('city')}
          />
          <TextField
            label={COPY.zip}
            value={zip}
            onChangeText={setZip}
            autoComplete="postal-code"
            textContentType="postalCode"
          />
          <PressableField
            label={COPY.country}
            placeholder={COPY.countryPlaceholder}
            icon="chevron"
            value={selectedCountry?.name}
            disabled={countries === null || countries.length === 0}
            onPress={() => setOpenPicker('country')}
            error={errorFor('country')}
          />
          <FormMessage type="error" message={countriesError} />
          {/* Disabled until the country's states are loaded (none → not required). */}
          <PressableField
            label={COPY.state}
            placeholder={COPY.statePlaceholder}
            icon="chevron"
            value={selectedState?.name}
            disabled={states.length === 0}
            onPress={() => setOpenPicker('state')}
            error={errorFor('state')}
          />
        </View>

        <FormMessage type="error" message={errorMessage} />

        {/* ---- Discard / Save address ---- */}
        <View style={styles.buttons}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.discardButton, pressed && styles.pressed]}>
            <Text style={styles.discardText}>{COPY.discard}</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving, busy: saving }}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.pressed,
              saving && styles.saving,
            ]}>
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.saveText}>{COPY.save}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <PickerModal
        visible={openPicker === 'country'}
        title={COPY.country}
        items={countryItems}
        selectedKey={countryId}
        searchPlaceholder={COPY.searchCountry}
        onSelect={selectCountry}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === 'state'}
        title={COPY.state}
        items={stateItems}
        selectedKey={stateId}
        searchPlaceholder={COPY.searchState}
        onSelect={selectState}
        onClose={() => setOpenPicker(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  // Same spacing as the signup forms.
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  fields: {
    gap: 18,
  },
  locationBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
    backgroundColor: Colors.phoneCountryBackground,
    padding: 14,
    gap: 2,
  },
  locationTitle: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.dark,
    marginBottom: 10,
  },
  locationInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
  // Same disabled + "Coming soon" treatment as elsewhere (Shop filters, Order Detail).
  locationButton: {
    marginTop: 10,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  discardButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardText: {
    fontFamily: Fonts.primary,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark,
  },
  // Same as the signup forms' submit button.
  saveButton: {
    flex: 1.4,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontFamily: Fonts.primary,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  saving: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
});
