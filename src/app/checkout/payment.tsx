import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { fetchCheckout, type CheckoutAddress, type CheckoutData } from '@/api/checkout';
import { getCookieHeader } from '@/api/cookie-jar';
import { odooUrl } from '@/api/odoo-client';
import { CheckoutSummary } from '@/components/checkout-summary';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors, HomeGradients } from '@/theme/theme';

/*
 * Screen: Checkout, step 3 — Payment (the live /shop/payment page). Opened by "Confirm" on the
 * Delivery step, which passes the chosen delivery / billing address ids.
 *
 * FIXED 2026-10-02 (session 2) — was a UI-ONLY MOCK (raw card fields that sent nothing anywhere);
 * now opens the REAL /shop/payment page in a WebView, i.e. a real hosted payment page, matching
 * the Developer Scope's "Hosted payment page where required" requirement instead of collecting
 * card numbers inside the app.
 *
 * How it works: "Pay now" opens the real Odoo /shop/payment page (the same page the live website
 * serves, with the real Sumit/Lahza integration already built into the backend — nothing new was
 * invented here) inside a WebView, carrying the app's own Odoo session cookie so it shows the
 * customer's real signed-in session. The customer picks a gateway and completes payment exactly
 * as they would on the website. Completion is detected by watching for the real redirect the
 * backend's own /shop/payment/validate route sends on success (`/shop/confirmation`, confirmed by
 * reading yallashuq_seller/controllers/main.py directly) — at that point the WebView closes and
 * the app's own Order Confirmed screen opens. A close (✕) button lets the customer back out at
 * any time; nothing is auto-dismissed if the gateway page itself shows an error — the user sees
 * the gateway's own real error inside the WebView.
 *
 * ⚠️ Known pre-existing risk, NOT fixed here (separate, already-tracked gap): the real Odoo cart
 * only reflects products actually added via Add to Cart (odooJsonRpc /shop/cart/update_json,
 * genuinely real — see cart.ts). Quantity CHANGES made on the app's own Cart screen are currently
 * mock-only and are never sent to the backend (cart.ts's setCartLineQuantity, docs/backend-
 * requests/001-cart-summary-json.md). That means if a customer changes a quantity in the app's
 * Cart screen, the real hosted payment page opened here can show a different total than what the
 * app displayed, because the backend never heard about that change. Flagging this plainly rather
 * than hiding it: this screen does not introduce that risk, but it does make it reachable for the
 * first time (there was no real payment step to expose it through before).
 *
 * Still sample data: the Delivery step's own address list (checkout.ts, #019) and the cart
 * contents shown in the Confirm order / Order summary sections above the Pay button — unrelated,
 * already-logged gaps, not touched by this fix.
 *
 * NOT TESTED END-TO-END ON A DEVICE: no way to run the app from this session (no device_bash all
 * session). The cookie-passing approach (WebView `source.headers` for the first request, plus
 * `injectedJavaScriptBeforeContentLoaded` setting `document.cookie` for everything after) is the
 * standard react-native-webview technique for sharing a session without adding a new native
 * cookie-manager package — but if the real device shows the gateway page as signed OUT, that's
 * the first thing to check, and the fix would be adding `@react-native-cookies/cookies` (a new
 * native dependency, needs a new dev build — not added speculatively here).
 */

// Copy moved into src/i18n/locales/en.json under "payment" (RTL/i18n work, 2026-10-01).

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CheckoutData; isSampleData: boolean };

/** `/shop/payment/validate` redirects here on success (confirmed in main.py, see header comment). */
const SUCCESS_PATH = '/shop/confirmation';

export default function CheckoutPaymentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ deliveryAddressId?: string; billingAddressId?: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);
  // The real hosted gateway page, opened on "Pay now". null = not open (showing the order review).
  const [gateway, setGateway] = useState<{ cookieHeader: string | undefined } | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const handledSuccess = useRef(false);

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
        <Stack.Screen options={{ title: t('payment.title') }} />
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

  async function openSecurePayment() {
    handledSuccess.current = false;
    setGatewayLoading(true);
    const cookieHeader = await getCookieHeader(odooUrl('/shop/payment'));
    setGateway({ cookieHeader });
  }

  function handleNavigationChange(navState: WebViewNavigation) {
    if (handledSuccess.current) {
      return;
    }
    let path: string;
    try {
      path = new URL(navState.url).pathname;
    } catch {
      return;
    }
    if (path.startsWith(SUCCESS_PATH)) {
      handledSuccess.current = true;
      setGateway(null);
      router.replace('/checkout/confirmed');
    }
  }

  // Sets the real session cookie on the WebView's own cookie store (not just the first request's
  // headers) so navigations/redirects inside the real payment flow stay signed in. Standard
  // react-native-webview technique — see the NOT TESTED note in the header comment.
  const cookieInjection = gateway?.cookieHeader
    ? gateway.cookieHeader
        .split(';')
        .map((pair) => pair.trim())
        .filter(Boolean)
        .map((pair) => `document.cookie = ${JSON.stringify(`${pair}; path=/`)};`)
        .join('\n') + '\ntrue;'
    : undefined;

  if (gateway) {
    return (
      <SafeAreaView style={styles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.gatewayHeader}>
          <Pressable
            onPress={() => setGateway(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('payment.cancelPayment')}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor={Colors.dark} />
          </Pressable>
          <Text style={styles.gatewayTitle} numberOfLines={1}>
            {t('payment.securePaymentTitle')}
          </Text>
          <View style={styles.gatewayHeaderSpacer} />
        </View>
        <WebView
          source={{
            uri: odooUrl('/shop/payment'),
            headers: gateway.cookieHeader ? { Cookie: gateway.cookieHeader } : undefined,
          }}
          injectedJavaScriptBeforeContentLoaded={cookieInjection}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onNavigationStateChange={handleNavigationChange}
          onLoadStart={() => setGatewayLoading(true)}
          onLoadEnd={() => setGatewayLoading(false)}
          style={styles.webview}
        />
        {gatewayLoading && (
          <View style={[styles.page, styles.centered, styles.gatewayLoadingOverlay]}>
            <ActivityIndicator color={Colors.primaryOrange} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('payment.title') }} />
      {state.status === 'ready' && state.isSampleData && (
        <View style={styles.bannerBar}>
          <View style={styles.sampleBanner} accessibilityRole="alert">
            <Text style={styles.sampleBannerText}>{t('payment.sampleBanner')}</Text>
          </View>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Breadcrumb />
        {state.status === 'error' ? (
          <FormMessage type="error" message={state.message} />
        ) : state.data.cart.sellerGroups.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{t('payment.empty')}</Text>
          </View>
        ) : (
          <View style={styles.sections}>
            {/* ---- Confirm order ---- */}
            <Section title={t('payment.confirmOrder')}>
              <AddressSummary
                label={t('payment.deliveryAddress')}
                address={findAddress(params.deliveryAddressId)}
              />
              <View style={styles.divider} />
              <AddressSummary
                label={t('payment.billingAddress')}
                address={findAddress(params.billingAddressId)}
              />
            </Section>

            {/* ---- Choose a payment method ---- */}
            <Section title={t('payment.choosePayment')}>
              <SecurePaymentNotice />
            </Section>

            <CheckoutSummary cart={state.data.cart} />

            {/* ---- Pay now: opens the real hosted gateway page (see header comment) ---- */}
            <Pressable
              onPress={openSecurePayment}
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
                <Text style={styles.payText}>{t('payment.payNow')}</Text>
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
  const { t } = useTranslation();
  return (
    <View style={styles.breadcrumb} accessibilityRole="header">
      <Pressable onPress={() => router.navigate('/cart')} hitSlop={8} accessibilityRole="link">
        <Text style={styles.crumbLink}>{t('payment.reviewOrder')}</Text>
      </Pressable>
      <Text style={styles.crumbSeparator}>/</Text>
      <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="link">
        <Text style={styles.crumbLink}>{t('payment.delivery')}</Text>
      </Pressable>
      <Text style={styles.crumbSeparator}>/</Text>
      <Text style={styles.crumbActive}>{t('payment.payment')}</Text>
    </View>
  );
}

function AddressSummary({ label, address }: { label: string; address: CheckoutAddress | null }) {
  const { t } = useTranslation();
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
        <Text style={styles.link}>{t('payment.edit')}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Replaces the old in-app card form: no card fields are collected here at all. "Pay now" opens
 * the real gateway page (Sumit/Lahza, whichever the backend has enabled) in a WebView — this is
 * just the explanatory card shown before that.
 */
function SecurePaymentNotice() {
  const { t } = useTranslation();
  return (
    <View style={[styles.option, styles.optionSelected]}>
      <View style={styles.optionHeader}>
        <SymbolView
          name={{ ios: 'creditcard', android: 'credit_card', web: 'credit_card' }}
          size={18}
          tintColor={Colors.dark}
        />
        <Text style={styles.optionName}>{t('payment.card')}</Text>
      </View>
      <Text style={styles.securePaymentDescription}>{t('payment.securePaymentNotice')}</Text>
      <View style={styles.secured}>
        <SymbolView
          name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          size={12}
          tintColor={Colors.helperText}
        />
        <Text style={styles.securedText}>{t('payment.securedBy')}</Text>
      </View>
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
  securePaymentDescription: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedText,
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
  gatewayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.inputBorder,
    backgroundColor: Colors.white,
  },
  gatewayTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.dark,
  },
  gatewayHeaderSpacer: {
    width: 18,
  },
  webview: {
    flex: 1,
  },
  gatewayLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.pageBackground,
  },
});
