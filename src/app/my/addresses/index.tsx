import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { deleteAddress, fetchAddresses, setDefaultAddress, type Address } from '@/api/addresses';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Address Book (list) — app-only screen (client request 2026-10-02, tracker #22), reached from
 * the Account tab's "Address Book" row. No live-site page exists for this; layout follows the
 * same rounded-card convention as My Returns / My Orders.
 *
 * DATA: real, /my/addresses/json (yallashuq_seller/controllers/address_book.py). Deleting calls
 * the existing /my/address/delete route (archives, not a hard delete).
 */

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; addresses: Address[] };

export default function AddressBookScreen() {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setState({ status: 'loading' });
    const result = await fetchAddresses();
    if (request !== requestId.current) {
      return;
    }
    if (!result.ok) {
      setState({ status: 'error', message: result.message });
      return;
    }
    setState({ status: 'ready', addresses: result.addresses });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++;
      };
    }, [load])
  );

  async function handleDelete(address: Address) {
    if (deletingId !== null) {
      return;
    }
    setActionError(null);
    setDeletingId(address.id);
    const result = await deleteAddress(address.id);
    setDeletingId(null);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    await load();
  }

  async function handleSetDefault(address: Address) {
    if (address.isDefault || settingDefaultId !== null) {
      return;
    }
    setActionError(null);
    setSettingDefaultId(address.id);
    const result = await setDefaultAddress(address.id);
    setSettingDefaultId(null);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    await load();
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: t('addressBook.title') }} />
      {state.status === 'loading' && (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      )}
      {state.status === 'error' && (
        <View style={styles.content}>
          <FormMessage type="error" message={state.message} />
        </View>
      )}
      {state.status === 'ready' && (
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
          {actionError && <FormMessage type="error" message={actionError} />}
          {state.addresses.length === 0 ? (
            <Text style={styles.emptyText}>{t('addressBook.empty')}</Text>
          ) : (
            state.addresses.map((address) => (
              <View key={address.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {address.name}
                  </Text>
                  {address.isDefault && (
                    <Text style={styles.primaryBadge}>{t('addressBook.default')}</Text>
                  )}
                </View>
                <Text style={styles.cardLine}>{address.street}</Text>
                {address.street2 ? <Text style={styles.cardLine}>{address.street2}</Text> : null}
                <Text style={styles.cardLine}>
                  {[address.city, address.stateName, address.zip].filter(Boolean).join(', ')}
                </Text>
                {address.phone ? <Text style={styles.cardLine}>{address.phone}</Text> : null}

                <View style={styles.cardActions}>
                  {!address.isDefault && (
                    <Pressable
                      onPress={() => handleSetDefault(address)}
                      disabled={settingDefaultId !== null}
                      style={styles.actionButton}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: settingDefaultId !== null,
                        busy: settingDefaultId === address.id,
                      }}>
                      {settingDefaultId === address.id ? (
                        <ActivityIndicator size="small" color={Colors.primaryOrange} />
                      ) : (
                        <SymbolView
                          name={{ ios: 'star', android: 'star-outline', web: 'star' }}
                          size={15}
                          tintColor={Colors.primaryOrange}
                        />
                      )}
                      <Text style={styles.actionText}>{t('addressBook.setDefault')}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => router.push(`/my/addresses/${address.id}`)}
                    style={styles.actionButton}
                    accessibilityRole="button">
                    <SymbolView
                      name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                      size={15}
                      tintColor={Colors.primaryOrange}
                    />
                    <Text style={styles.actionText}>{t('addressBook.edit')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(address)}
                    disabled={deletingId !== null}
                    style={styles.actionButton}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: deletingId !== null, busy: deletingId === address.id }}>
                    {deletingId === address.id ? (
                      <ActivityIndicator size="small" color={Colors.errorText} />
                    ) : (
                      <SymbolView
                        name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                        size={15}
                        tintColor={Colors.errorText}
                      />
                    )}
                    <Text style={[styles.actionText, styles.deleteText]}>
                      {t('addressBook.delete')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <Pressable
            onPress={() => router.push('/my/addresses/new')}
            style={styles.addButton}
            accessibilityRole="button">
            <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor={Colors.white} />
            <Text style={styles.addButtonText}>{t('addressBook.addNew')}</Text>
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
    gap: 12,
  },
  emptyText: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.mutedText,
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardName: {
    flex: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.sectionHeading,
  },
  primaryBadge: {
    fontFamily: Fonts.primaryBold,
    fontSize: 11,
    color: Colors.primaryOrange,
  },
  cardLine: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.mutedText,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    color: Colors.primaryOrange,
  },
  deleteText: {
    color: Colors.errorText,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
    marginTop: 8,
  },
  addButtonText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.white,
  },
});
