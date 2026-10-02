import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchAddresses, saveAddress, type AddressFields } from '@/api/addresses';
import { FormMessage } from '@/components/form-message';
import { TextField } from '@/components/form-fields';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Address Book (add/edit) — app-only screen (client request 2026-10-02, tracker #22).
 * `id` is "new" for creating an address, otherwise the address id to edit.
 *
 * DATA: real, /my/address/edit/json (create when address_id is 0/omitted, edit otherwise).
 */

const EMPTY: AddressFields = {
  name: '',
  street: '',
  street2: '',
  city: '',
  zip: '',
  phone: '',
  email: '',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' };

export default function AddressEditScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const addressId = isNew ? null : Number(id);

  const [load, setLoad] = useState<LoadState>({ status: isNew ? 'ready' : 'loading' });
  const [fields, setFields] = useState<AddressFields>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || addressId === null) {
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await fetchAddresses();
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setLoad({ status: 'error', message: result.message });
        return;
      }
      const existing = result.addresses.find((a) => a.id === addressId);
      if (!existing) {
        setLoad({ status: 'error', message: t('addressBook.notFound') });
        return;
      }
      setFields({
        name: existing.name,
        street: existing.street,
        street2: existing.street2,
        city: existing.city,
        zip: existing.zip,
        phone: existing.phone,
        email: existing.email,
      });
      setLoad({ status: 'ready' });
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, addressId, t]);

  function update<K extends keyof AddressFields>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (submitting) {
      return;
    }
    if (!fields.name.trim()) {
      setSubmitError(t('addressBook.nameRequired'));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await saveAddress(addressId, fields);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }
    router.back();
  }

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{ title: isNew ? t('addressBook.addNew') : t('addressBook.edit') }}
      />
      {load.status === 'loading' && (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      )}
      {load.status === 'error' && (
        <View style={styles.content}>
          <FormMessage type="error" message={load.message} />
        </View>
      )}
      {load.status === 'ready' && (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
          {submitError && <FormMessage type="error" message={submitError} />}

          <TextField
            label={t('addressBook.fields.name')}
            value={fields.name}
            onChangeText={(value) => update('name', value)}
          />
          <TextField
            label={t('addressBook.fields.street')}
            value={fields.street}
            onChangeText={(value) => update('street', value)}
          />
          <TextField
            label={t('addressBook.fields.street2')}
            value={fields.street2}
            onChangeText={(value) => update('street2', value)}
          />
          <TextField
            label={t('addressBook.fields.city')}
            value={fields.city}
            onChangeText={(value) => update('city', value)}
          />
          <TextField
            label={t('addressBook.fields.zip')}
            value={fields.zip}
            onChangeText={(value) => update('zip', value)}
          />
          <TextField
            label={t('addressBook.fields.phone')}
            value={fields.phone}
            onChangeText={(value) => update('phone', value)}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('addressBook.fields.email')}
            value={fields.email}
            onChangeText={(value) => update('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Pressable
            onPress={handleSave}
            disabled={submitting}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}>
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>{t('addressBook.save')}</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 16,
  },
  saveButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.white,
  },
});
