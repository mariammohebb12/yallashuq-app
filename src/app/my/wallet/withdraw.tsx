import { Stack, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
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

import { fetchWithdrawWallets, type WalletOption } from '@/api/wallet';
import { FieldError, FieldLabel, PressableField, REQUIRED_MESSAGE } from '@/components/form-fields';
import { FormMessage } from '@/components/form-message';
import { SampleDataBanner } from '@/components/order-parts';
import { PickerModal } from '@/components/picker-modal';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Withdraw — the live /my/wallet/withdraw page (opened by "Withdraw" on the eWallet
 * screen).
 *
 * Same content as the live card, in one column, laid out like the Top Up screen: "Withdraw Funds"
 * header (dark on the live page), "Select Wallet", "Withdrawal Amount" (₪, required, min 1,
 * 2 decimals), "Payment Details" (required), the admin-approval notice and "Submit Request".
 *
 * ⚠️ UI ONLY — NOTHING IS SENT OR SAVED ⚠️
 * "Submit Request" checks the fields, then only logs that it was pressed (never the amount or
 * payment details). The live form posts card_id / amount / payment_details to
 * /my/wallet/withdraw; there's no JSON route for it. The wallet option is sample data (the live
 * dropdown is empty for the staging test customer), shown with a visible banner.
 */

const COPY = {
  // Confirmed from the live /my/wallet/withdraw page.
  title: 'Withdraw Funds',
  selectWallet: 'Select Wallet',
  amount: 'Withdrawal Amount',
  amountPlaceholder: '0.00',
  paymentDetails: 'Payment Details',
  paymentDetailsPlaceholder: 'Enter your IBAN, PayPal email, or Bank details...',
  notice: 'Withdrawal requests are subject to admin approval and may take 1-3 business days.',
  submit: 'Submit Request',
  // Confirmed from the live /my/wallet page.
  screenTitle: 'eWallet',
  sampleData: 'Sample data — not your real wallet',
  // PLACEHOLDER COPY (the live form relies on the browser's own message for min="1").
  invalidAmount: 'Enter an amount of at least ₪1.',
};

// Live input: min="1" step="0.01".
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

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; wallets: WalletOption[]; isSampleData: boolean };

type Errors = { wallet?: string; amount?: string; details?: string };

export default function WithdrawScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [walletId, setWalletId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [details, setDetails] = useState('');
  const [focusedField, setFocusedField] = useState<'amount' | 'details' | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchWithdrawWallets();
    if (id !== requestId.current) {
      return;
    }
    if (!result.ok) {
      setState({ status: 'error', message: result.message });
      return;
    }
    setState({ status: 'ready', wallets: result.wallets, isSampleData: result.isSampleData });
    // Live: a required <select> with no empty option, so the first wallet starts selected.
    setWalletId((current) => current ?? result.wallets[0]?.id ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++;
      };
    }, [load])
  );

  function submit() {
    const nextErrors: Errors = {};
    if (walletId === null) {
      nextErrors.wallet = REQUIRED_MESSAGE;
    }
    if (!amountText.trim()) {
      nextErrors.amount = REQUIRED_MESSAGE;
    } else if (parseAmount(amountText) === null) {
      nextErrors.amount = COPY.invalidAmount;
    }
    if (!details.trim()) {
      nextErrors.details = REQUIRED_MESSAGE;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    // Deliberately logs no field values (payment details can be bank data).
    console.log('[Withdraw] Submit Request pressed — not sent or saved (no route yet)');
  }

  const wallets = state.status === 'ready' ? state.wallets : [];
  const selectedWallet = wallets.find((wallet) => wallet.id === walletId);

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: COPY.screenTitle }} />
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {state.status === 'ready' && state.isSampleData && (
            <SampleDataBanner message={COPY.sampleData} />
          )}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{COPY.title}</Text>
            </View>
            <View style={styles.cardBody}>
              {state.status === 'error' && <FormMessage type="error" message={state.message} />}

              <PressableField
                label={COPY.selectWallet}
                value={selectedWallet?.label}
                icon="chevron"
                error={errors.wallet}
                disabled={wallets.length === 0}
                onPress={() => setPickerOpen(true)}
              />

              <View>
                <FieldLabel>{COPY.amount}</FieldLabel>
                <View
                  style={[
                    styles.amountGroup,
                    focusedField === 'amount' && styles.fieldFocused,
                    errors.amount !== undefined && styles.fieldInvalid,
                  ]}>
                  <View style={styles.currency}>
                    <Text style={styles.currencyText}>₪</Text>
                  </View>
                  <TextInput
                    value={amountText}
                    onChangeText={(text) => {
                      setAmountText(text);
                      setErrors((current) => ({ ...current, amount: undefined }));
                    }}
                    onFocus={() => setFocusedField('amount')}
                    onBlur={() => setFocusedField(null)}
                    placeholder={COPY.amountPlaceholder}
                    placeholderTextColor={Colors.placeholderIcon}
                    keyboardType="decimal-pad"
                    accessibilityLabel={COPY.amount}
                    style={styles.amountInput}
                  />
                </View>
                <FieldError message={errors.amount} />
              </View>

              <View>
                <FieldLabel>{COPY.paymentDetails}</FieldLabel>
                <TextInput
                  value={details}
                  onChangeText={(text) => {
                    setDetails(text);
                    setErrors((current) => ({ ...current, details: undefined }));
                  }}
                  onFocus={() => setFocusedField('details')}
                  onBlur={() => setFocusedField(null)}
                  placeholder={COPY.paymentDetailsPlaceholder}
                  placeholderTextColor={Colors.placeholderIcon}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  accessibilityLabel={COPY.paymentDetails}
                  style={[
                    styles.textarea,
                    focusedField === 'details' && styles.fieldFocused,
                    errors.details !== undefined && styles.fieldInvalid,
                  ]}
                />
                <FieldError message={errors.details} />
              </View>

              <View style={styles.notice}>
                <SymbolView
                  name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
                  size={16}
                  tintColor={Colors.helperText}
                />
                <Text style={styles.noticeText}>{COPY.notice}</Text>
              </View>

              <Pressable
                onPress={submit}
                accessibilityRole="button"
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
                <Text style={styles.buttonText}>{COPY.submit}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
      <PickerModal
        visible={pickerOpen}
        title={COPY.selectWallet}
        items={wallets.map((wallet) => ({ key: String(wallet.id), label: wallet.label }))}
        selectedKey={walletId === null ? undefined : String(walletId)}
        onSelect={(key) => {
          setWalletId(Number(key));
          setErrors((current) => ({ ...current, wallet: undefined }));
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </KeyboardAvoidingView>
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
  // Live: dark (bg-dark) card header with white bold centered title.
  cardHeader: {
    backgroundColor: Colors.dark,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cardTitle: {
    fontFamily: Fonts.primaryBold,
    fontSize: 20,
    color: Colors.white,
    textAlign: 'center',
  },
  cardBody: {
    padding: 20,
    gap: 18,
  },
  // Same ₪ prefix group as the Top Up screen.
  amountGroup: {
    flexDirection: 'row',
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
    backgroundColor: Colors.inputBackground,
    overflow: 'hidden',
  },
  fieldFocused: {
    borderColor: Colors.primaryOrange,
    backgroundColor: Colors.white,
  },
  fieldInvalid: {
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
    fontFamily: Fonts.primaryBold,
    fontSize: 18,
    color: Colors.dark,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontFamily: Fonts.primaryBold,
    fontSize: 18,
    color: Colors.dark,
  },
  textarea: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: Fonts.primary,
    fontSize: 15,
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
  // Live: dark (btn-dark) rounded-pill button.
  button: {
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
