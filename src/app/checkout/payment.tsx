import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState, type ReactNode } from 'react';
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
  type TextInputProps,
} from 'react-native';

import { fetchCheckout, type CheckoutAddress, type CheckoutData } from '@/api/checkout';
import { CheckoutSummary } from '@/components/checkout-summary';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors, HomeGradients } from '@/theme/theme';

/*
 * Screen: Checkout, step 3 — Payment (the live /shop/payment page). Opened by "Confirm" on the
 * Delivery step, which passes the chosen delivery / billing address ids.
 *
 * ⚠️ UI-ONLY MOCK — NO REAL PAYMENT ⚠️
 * - The card fields live ONLY in this screen's local state: never logged, stored or sent anywhere,
 *   and discarded when the screen closes. "Pay now" processes nothing — it opens the placeholder
 *   "Order Confirmed" screen. (A real integration must go through the Sumit hosted payment page /
 *   tokenization, not raw card numbers typed into the app.)
 * - Addresses are the Delivery step's sample addresses; the order summary is the (mock) cart.
 *
 * Matches the live page: breadcrumb (Review Order / Delivery / Payment), "Confirm order" with the
 * chosen addresses (+ Edit → back to Delivery), "Choose a payment method" with ONE option — Card,
 * via Sumit (no Lahza option on the live site; that gap is logged separately, so no gateway
 * picker here) — then the shared Order summary and "Pay now".
 */

const COPY = {
  // COPY FROM THE USER (2026-09-26): the live payment page's labels.
  reviewOrder: 'Review Order',
  delivery: 'Delivery',
  payment: 'Payment',
  confirmOrder: 'Confirm order',
  deliveryAddress: 'Delivery address',
  billingAddress: 'Billing address',
  edit: 'Edit',
  choosePayment: 'Choose a payment method',
  card: 'Card',
  cardNumber: 'Card Number',
  expiryMonth: 'Expiry Month',
  expiryYear: 'Expiry Year',
  cvv: 'CVV',
  citizenId: 'Citizen ID',
  securedBy: 'Secured by Sumit Gateway',
  payNow: 'Pay now',
  // PLACEHOLDER COPY (not confirmed anywhere).
  title: 'Checkout',
  sampleBanner: 'Sample data — not your real addresses. No payment is taken.',
  empty: 'Your cart is empty!',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CheckoutData; isSampleData: boolean };

export default function CheckoutPaymentScreen() {
  const params = useLocalSearchParams<{ deliveryAddressId?: string; billingAddressId?: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const result = await fetchCheckout();
    if (request !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', data: result.data, isSampleData: result.isSampleData }
        : { status: 'error', message: result.message }
    );
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
        <Stack.Screen options={{ title: COPY.title }} />
        <ActivityIndicator color={Colors.primaryOrange} />
      </View>
    );
  }

  const findAddress = (id?: string) =>
    state.status === 'ready'
      ? (state.data.addresses.find((a) => String(a.id) === id) ??
        state.data.addresses.find((a) => a.id === state.data.defaultAddressId) ??
        null)
      : null;

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: COPY.title }} />
      {state.status === 'ready' && state.isSampleData && (
        <View style={styles.bannerBar}>
          <View style={styles.sampleBanner} accessibilityRole="alert">
            <Text style={styles.sampleBannerText}>{COPY.sampleBanner}</Text>
          </View>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Breadcrumb />
        {state.status === 'error' ? (
          <FormMessage type="error" message={state.message} />
        ) : state.data.cart.sellerGroups.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{COPY.empty}</Text>
          </View>
        ) : (
          <View style={styles.sections}>
            {/* ---- Confirm order ---- */}
            <Section title={COPY.confirmOrder}>
              <AddressSummary
                label={COPY.deliveryAddress}
                address={findAddress(params.deliveryAddressId)}
              />
              <View style={styles.divider} />
              <AddressSummary
                label={COPY.billingAddress}
                address={findAddress(params.billingAddressId)}
              />
            </Section>

            {/* ---- Choose a payment method ---- */}
            <Section title={COPY.choosePayment}>
              <CardPaymentOption />
            </Section>

            <CheckoutSummary cart={state.data.cart} />

            {/* ---- Pay now (processes nothing; see the header comment) ---- */}
            <Pressable
              onPress={() => router.replace('/checkout/confirmed')}
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.pressed}>
              <LinearGradient
                colors={HomeGradients.orangeButton.colors}
                locations={HomeGradients.orangeButton.locations}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.payButton}>
                <SymbolView
                  name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                  size={15}
                  tintColor={Colors.white}
                />
                <Text style={styles.payText}>{COPY.payNow}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Review Order / Delivery / Payment — earlier steps are tappable to go back. */
function Breadcrumb() {
  return (
    <View style={styles.breadcrumb} accessibilityRole="header">
      <Pressable onPress={() => router.navigate('/cart')} hitSlop={8} accessibilityRole="link">
        <Text style={styles.crumbLink}>{COPY.reviewOrder}</Text>
      </Pressable>
      <Text style={styles.crumbSeparator}>/</Text>
      <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="link">
        <Text style={styles.crumbLink}>{COPY.delivery}</Text>
      </Pressable>
      <Text style={styles.crumbSeparator}>/</Text>
      <Text style={styles.crumbActive}>{COPY.payment}</Text>
    </View>
  );
}

function AddressSummary({ label, address }: { label: string; address: CheckoutAddress | null }) {
  const line = address
    ? [
        address.street,
        address.street2,
        [address.city, address.zip].filter(Boolean).join(' '),
        address.region,
        address.country,
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  return (
    <View style={styles.addressSummary}>
      <View style={styles.addressText}>
        <Text style={styles.addressLabel}>{label}</Text>
        {address && (
          <>
            <Text style={styles.addressName}>{address.name}</Text>
            <Text style={styles.addressLine}>{line}</Text>
          </>
        )}
      </View>
      {/* Back to the Delivery step. */}
      <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="link">
        <Text style={styles.link}>{COPY.edit}</Text>
      </Pressable>
    </View>
  );
}

/**
 * The single live payment option. Its fields stay in this component's state only (never sent,
 * logged or saved) and are discarded with it.
 */
function CardPaymentOption() {
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [citizenId, setCitizenId] = useState('');

  return (
    <View
      style={[styles.option, styles.optionSelected]}
      accessibilityRole="radio"
      accessibilityState={{ checked: true }}>
      <View style={styles.optionHeader}>
        <View style={styles.radio}>
          <View style={styles.radioDot} />
        </View>
        <SymbolView
          name={{ ios: 'creditcard', android: 'credit_card', web: 'credit_card' }}
          size={18}
          tintColor={Colors.dark}
        />
        <Text style={styles.optionName}>{COPY.card}</Text>
      </View>

      <CardField label={COPY.cardNumber} value={cardNumber} onChangeText={setCardNumber} maxLength={19} />
      <CardField label={COPY.expiryMonth} value={expiryMonth} onChangeText={setExpiryMonth} maxLength={2} />
      <CardField label={COPY.expiryYear} value={expiryYear} onChangeText={setExpiryYear} maxLength={4} />
      <CardField label={COPY.cvv} value={cvv} onChangeText={setCvv} maxLength={4} secureTextEntry />
      <CardField label={COPY.citizenId} value={citizenId} onChangeText={setCitizenId} />

      <View style={styles.secured}>
        <SymbolView
          name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          size={12}
          tintColor={Colors.helperText}
        />
        <Text style={styles.securedText}>{COPY.securedBy}</Text>
      </View>
    </View>
  );
}

/** Numeric field; autofill / password-manager saving is off on purpose (UI-only mock). */
function CardField({ label, ...inputProps }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        autoComplete="off"
        autoCorrect={false}
        textContentType="none"
        importantForAutofill="no"
        {...inputProps}
      />
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
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  crumbLink: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  crumbSeparator: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.subtleText,
  },
  crumbActive: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
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
  muted: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 15,
    color: Colors.mutedText,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.inputBorder,
  },
  addressSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  addressText: {
    flex: 1,
    gap: 2,
  },
  addressLabel: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    textTransform: 'uppercase',
    color: Colors.helperText,
    marginBottom: 2,
  },
  addressName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.sectionHeading,
  },
  addressLine: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedText,
  },
  link: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  // Same selected-option look as the Delivery step.
  option: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    padding: 14,
    gap: 12,
  },
  optionSelected: {
    borderColor: Colors.primaryOrange,
    backgroundColor: Colors.activeRowBackground,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionName: {
    flex: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.dark,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primaryOrange,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
  secured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securedText: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.helperText,
  },
  payButton: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 17,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
