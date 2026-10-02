import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { fetchCheckout, type CheckoutAddress, type CheckoutData } from '@/api/checkout';
import { CheckoutSummary } from '@/components/checkout-summary';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors, HomeGradients } from '@/theme/theme';

/*
 * Screen: Checkout, step 1 — Address & Delivery (the live /shop/checkout page). Opened from
 * Cart's "Checkout". The Payment step is not built yet.
 *
 * ⚠️ BLOCKED ON BACKEND — ADDRESSES ARE TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * Saved addresses are sample data (src/api/checkout.ts) with a visible banner. The order summary
 * and seller-wise delivery are the Cart's data (still the mock cart, #001).
 *
 * Sections follow staging's page (checked 2026-09-26), reflowed into one column — the live
 * sidebar (order summary) comes after the address/delivery sections: Delivery address (cards +
 * "Add address"), Choose a delivery method, Billing address ("Same as delivery address"; when off,
 * the same card list for billing), Order summary (item count, Subtotal/Delivery/Taxes/Total, the
 * discount code field, Seller-wise Delivery), then Confirm / Back to cart.
 * One checkout and one payment for the whole cart, even with several sellers.
 *
 * "Confirm" opens the Payment step (src/app/checkout/payment.tsx) with the chosen addresses.
 * The Order summary card is shared with Payment (src/components/checkout-summary.tsx).
 *
 * Fixed 2026-10-02: the address list is now real (src/api/checkout.ts). "Add address" and
 * "Edit" now open the real Address Book screen (src/app/my/addresses/[id].tsx — "new" or the
 * address id), the same screen My Account's Address Book uses, instead of logging / the old
 * mock-only Add Address form. Selecting a delivery method only changes what's highlighted here
 * (no real "choose a method" route confirmed yet).
 */

// Copy moved into src/i18n/locales/en.json under "checkout" (RTL/i18n work, 2026-10-01).

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CheckoutData; isSampleData: boolean };

export default function CheckoutAddressScreen() {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [deliveryAddressId, setDeliveryAddressId] = useState<number | null>(null);
  const [billingAddressId, setBillingAddressId] = useState<number | null>(null);
  const [deliveryMethodId, setDeliveryMethodId] = useState<number | null>(null);
  const [billingSame, setBillingSame] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const result = await fetchCheckout();
    if (request !== requestId.current) {
      return;
    }
    if (!result.ok) {
      setState({ status: 'error', message: result.message });
      return;
    }
    const { data } = result;
    setState({ status: 'ready', data, isSampleData: result.isSampleData });
    // Keep the customer's choices across reloads; otherwise start from the defaults.
    setDeliveryAddressId((current) => current ?? data.defaultAddressId);
    setBillingAddressId((current) => current ?? data.defaultAddressId);
    setDeliveryMethodId((current) => current ?? data.deliveryMethods[0]?.id ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++;
      };
    }, [load])
  );

  if (state.status === 'loading') {
    return (
      <View style={[styles.page, styles.centered]}>
        <Stack.Screen options={{ title: t('checkout.title') }} />
        <ActivityIndicator color={Colors.primaryOrange} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: t('checkout.title') }} />
      {state.status === 'ready' && state.isSampleData && (
        <View style={styles.bannerBar}>
          <View style={styles.sampleBanner} accessibilityRole="alert">
            <Text style={styles.sampleBannerText}>{t('checkout.sampleBanner')}</Text>
          </View>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {state.status === 'error' ? (
          <FormMessage type="error" message={state.message} />
        ) : state.data.cart.sellerGroups.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>{t('checkout.empty')}</Text>
            <BackToCart />
          </View>
        ) : (
          <View style={styles.sections}>
            {/* ---- Delivery address ---- */}
            <Section title={t('checkout.deliveryAddress')}>
              <AddressList
                addresses={state.data.addresses}
                selectedId={deliveryAddressId}
                onSelect={setDeliveryAddressId}
              />
            </Section>

            {/* ---- Choose a delivery method ---- */}
            <Section title={t('checkout.chooseDelivery')}>
              {state.data.deliveryMethods.map((method) => {
                const selected = method.id === deliveryMethodId;
                return (
                  <Pressable
                    key={method.id}
                    onPress={() => setDeliveryMethodId(method.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.option, selected && styles.optionSelected]}>
                    <Radio selected={selected} />
                    <Text style={styles.optionName}>{method.name}</Text>
                    <Text style={styles.optionPrice}>{method.priceFormatted}</Text>
                  </Pressable>
                );
              })}
            </Section>

            {/* ---- Billing address ---- */}
            <Section title={t('checkout.billingAddress')}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('checkout.sameAsDelivery')}</Text>
                <Switch
                  value={billingSame}
                  onValueChange={setBillingSame}
                  trackColor={{ true: Colors.primaryOrange, false: Colors.iconButtonBorder }}
                  accessibilityLabel={t('checkout.sameAsDelivery')}
                />
              </View>
              {!billingSame && (
                <AddressList
                  addresses={state.data.addresses}
                  selectedId={billingAddressId}
                  onSelect={setBillingAddressId}
                />
              )}
            </Section>

            {/* ---- Order summary (live sidebar) ---- */}
            <CheckoutSummary cart={state.data.cart} />

            {/* ---- Confirm / Back to cart ---- */}
            <View style={styles.footer}>
              {/* Next step: Payment, with the chosen addresses. */}
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/checkout/payment',
                    params: {
                      deliveryAddressId: String(deliveryAddressId),
                      billingAddressId: String(billingSame ? deliveryAddressId : billingAddressId),
                    },
                  })
                }
                accessibilityRole="button"
                style={({ pressed }) => [styles.confirmPressable, pressed && styles.pressed]}>
                <LinearGradient
                  colors={HomeGradients.orangeButton.colors}
                  locations={HomeGradients.orangeButton.locations}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmButton}>
                  <Text style={styles.confirmText}>{t('checkout.confirm')}</Text>
                </LinearGradient>
              </Pressable>
              <View style={styles.orRow}>
                <Text style={styles.muted}>{t('checkout.or')}</Text>
                <BackToCart />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AddressList({
  addresses,
  selectedId,
  onSelect,
}: {
  addresses: CheckoutAddress[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.addressList}>
      {addresses.map((address) => (
        <AddressCard
          key={address.id}
          address={address}
          selected={address.id === selectedId}
          onSelect={() => onSelect(address.id)}
        />
      ))}
      {/* Opens the real Address Book add screen. */}
      <Pressable
        onPress={() => router.push('/my/addresses/new')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.addCard, pressed && styles.pressed]}>
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' }}
          size={16}
          tintColor={Colors.primaryOrange}
        />
        <Text style={styles.addText}>{t('checkout.addAddress')}</Text>
      </Pressable>
    </View>
  );
}

function AddressCard({
  address,
  selected,
  onSelect,
}: {
  address: CheckoutAddress;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const lines = [
    address.street,
    address.street2,
    [address.city, address.zip].filter(Boolean).join(' '),
    address.region,
    address.country,
  ].filter(Boolean);
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.addressCard, selected && styles.optionSelected]}>
      <Radio selected={selected} />
      <View style={styles.addressText}>
        <Text style={styles.addressName}>{address.name}</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.addressLine}>
            {line}
          </Text>
        ))}
      </View>
      {/* Opens the real Address Book edit screen. */}
      <Pressable
        onPress={() => router.push(`/my/addresses/${address.id}`)}
        hitSlop={8}
        accessibilityRole="link">
        <Text style={styles.link}>{t('checkout.edit')}</Text>
      </Pressable>
    </Pressable>
  );
}

function BackToCart() {
  const { t } = useTranslation();
  return (
    <Pressable onPress={() => router.navigate('/cart')} hitSlop={8} accessibilityRole="link">
      <Text style={styles.link}>{t('checkout.backToCart')}</Text>
    </Pressable>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected && <View style={styles.radioDot} />}
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
  bannerBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sampleBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sampleBannerText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.dark,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  sections: {
    gap: 14,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionTitle: {
    fontFamily: Fonts.primaryBold,
    fontSize: 17,
    color: Colors.sectionHeading,
  },
  emptyText: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 15,
    color: Colors.mutedText,
  },
  addressList: {
    gap: 10,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 14,
  },
  optionSelected: {
    borderColor: Colors.primaryOrange,
    backgroundColor: Colors.activeRowBackground,
  },
  addressText: {
    flex: 1,
    gap: 2,
  },
  addressName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.sectionHeading,
    marginBottom: 2,
  },
  addressLine: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.mutedText,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.lightOrange,
  },
  addText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.primaryOrange,
  },
  link: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 14,
  },
  optionName: {
    flex: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.dark,
  },
  optionPrice: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.primaryOrange,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.iconButtonBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioSelected: {
    borderColor: Colors.primaryOrange,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primaryOrange,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
  muted: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.mutedText,
  },
  footer: {
    gap: 12,
    alignItems: 'center',
  },
  confirmPressable: {
    alignSelf: 'stretch',
  },
  confirmButton: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.white,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
