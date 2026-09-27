import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { addWalletTopUpToCart } from '@/api/wallet';
import { FieldError, FieldLabel } from '@/components/form-fields';
import { FormMessage } from '@/components/form-message';
import { setCartQuantity } from '@/state/cart-quantity';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Top Up — the live /my/wallet/topup page (opened by "Top Up" on the eWallet screen).
 *
 * Same content as the live card, in one column: "Top Up Your Wallet" header, the explanation,
 * "Select Amount" (₪ prefix, defaults to 50, decimals allowed), the checkout notice and
 * "Add Balance". Like the live site, a top-up is bought through the normal checkout: "Add Balance"
 * puts a "Wallet Top-Up ₪…" line in the cart and opens Checkout (Address & Delivery).
 *
 * ⚠️ MOCK CART ONLY ⚠️ The line goes into the app's temporary mock cart (see
 * addWalletTopUpToCart in src/api/wallet.ts); nothing is sent to the backend and no balance
 * changes.
 */

const COPY = {
  // Confirmed from the live /my/wallet/topup page.
  title: 'Top Up Your Wallet',
  intro:
    'To add funds to your wallet, please purchase a top-up credit. Once paid, the balance will be instantly available.',
  selectAmount: 'Select Amount',
  checkoutNotice: 'You will be redirected to the checkout page to complete the payment.',
  addBalance: 'Add Balance',
  // Confirmed from the live /my/wallet page.
  screenTitle: 'eWallet',
  // PLACEHOLDER COPY (the live form relies on the browser's own message for min="1").
  invalidAmount: 'Enter an amount of at least ₪1.',
};

// Live input: value="50" min="1" step="0.01".
const DEFAULT_AMOUNT = '50';
const MIN_AMOUNT = 1;

/** A positive amount with up to 2 decimals ("," accepted as the decimal separator); else null. */
function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const amount = Number(normalized);
  return amount >= MIN_AMOUNT ? amount : null;
}

export default function TopUpScreen() {
  const [amountText, setAmountText] = useState(DEFAULT_AMOUNT);
  const [focused, setFocused] = useState(false);
  const [amountError, setAmountError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function addBalance() {
    const amount = parseAmount(amountText);
    if (amount === null) {
      setAmountError(COPY.invalidAmount);
      return;
    }
    setAmountError(undefined);
    setSubmitError(null);
    setSubmitting(true);
    const result = await addWalletTopUpToCart(amount);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }
    setCartQuantity(result.cartQuantity);
    router.push('/checkout');
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: COPY.screenTitle }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{COPY.title}</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.intro}>{COPY.intro}</Text>

            <View>
              <FieldLabel>{COPY.selectAmount}</FieldLabel>
              <View
                style={[
                  styles.amountGroup,
                  focused && styles.amountGroupFocused,
                  amountError !== undefined && styles.amountGroupInvalid,
                ]}>
                <View style={styles.currency}>
                  <Text style={styles.currencyText}>₪</Text>
                </View>
                <TextInput
                  value={amountText}
                  onChangeText={(text) => {
                    setAmountText(text);
                    setAmountError(undefined);
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  keyboardType="decimal-pad"
                  accessibilityLabel={COPY.selectAmount}
                  style={styles.amountInput}
                />
              </View>
              <FieldError message={amountError} />
            </View>

            <View style={styles.notice}>
              <SymbolView
                name={{ ios: 'info.circle', android: 'info', web: 'info' }}
                size={16}
                tintColor={Colors.helperText}
              />
              <Text style={styles.noticeText}>{COPY.checkoutNotice}</Text>
            </View>

            {submitError && <FormMessage type="error" message={submitError} />}

            <Pressable
              onPress={addBalance}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting }}
              style={({ pressed }) => [
                styles.button,
                (pressed || submitting) && styles.pressed,
              ]}>
              <SymbolView
                name={{ ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' }}
                size={18}
                tintColor={Colors.white}
              />
              <Text style={styles.buttonText}>{COPY.addBalance}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  // Live: orange (bg-primary) card header with white bold centered title.
  cardHeader: {
    backgroundColor: Colors.primaryOrange,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cardTitle: {
    fontFamily: Fonts.primary,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
  },
  cardBody: {
    padding: 20,
    gap: 18,
  },
  intro: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.mutedText,
    textAlign: 'center',
  },
  // Same prefix group as the signup phone field (#e2e8f0 border, #f8fafc prefix).
  amountGroup: {
    flexDirection: 'row',
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
    backgroundColor: Colors.inputBackground,
    overflow: 'hidden',
  },
  amountGroupFocused: {
    borderColor: Colors.primaryOrange,
    backgroundColor: Colors.white,
  },
  amountGroupInvalid: {
    borderColor: Colors.errorText,
  },
  currency: {
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.phoneCountryBackground,
    borderEndWidth: 1,
    borderEndColor: Colors.phoneGroupBorder,
  },
  currencyText: {
    fontFamily: Fonts.primary,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontFamily: Fonts.primary,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
    backgroundColor: Colors.phoneCountryBackground,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noticeText: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.dark,
  },
  button: {
    flexDirection: 'row',
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
