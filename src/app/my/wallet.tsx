import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchWallet, type WalletSummary, type WalletTransaction } from '@/api/wallet';
import { FormMessage } from '@/components/form-message';
import { PressableField } from '@/components/form-fields';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: eWallet — the live /my/wallet page (opened from the Account tab's eWallet card).
 *
 * ⚠️ BLOCKED ON BACKEND — RUNS ON TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * No JSON route for the wallet yet (see src/api/wallet.ts); fetchWallet returns sample data and
 * this screen shows a visible "sample data" banner. When a route ships, only src/api/wallet.ts
 * changes.
 *
 * Same sections as the live page, in one column: the balance card ("Available Balance" + amount +
 * the two buttons), then "Transaction History" with the From/To date filter, Filter and Clear,
 * then one card per transaction (date, description, amount, type).
 * "Top Up" / "Withdraw" open src/app/my/wallet/topup.tsx / withdraw.tsx. Not built yet (log to the
 * console only): the date pickers, Filter and Clear.
 * The live "No Wallet" status badge isn't shown: its other values aren't known.
 */

const COPY = {
  // Confirmed from the live /my/wallet page.
  availableBalance: 'Available Balance',
  withdraw: 'Withdraw',
  transactionHistory: 'Transaction History',
  from: 'From',
  to: 'To',
  filter: 'Filter',
  clear: 'Clear',
  empty: 'No transactions found.',
  // Asked for in the app; the live button says "Add Money".
  topUp: 'Top Up',
  sampleData: 'Sample data — not your real wallet',
  datePlaceholder: 'mm/dd/yyyy',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; wallet: WalletSummary; isSampleData: boolean };

export default function EWalletScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchWallet();
    if (id !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', wallet: result.wallet, isSampleData: result.isSampleData }
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

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: 'eWallet' }} />
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : state.status === 'error' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <FormMessage type="error" message={state.message} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {state.isSampleData && <SampleDataBanner message={COPY.sampleData} />}
          <BalanceCard balanceFormatted={state.wallet.balanceFormatted} />

          <Text style={styles.heading}>{COPY.transactionHistory}</Text>
          <DateFilter />

          {state.wallet.transactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{COPY.empty}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {state.wallet.transactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function BalanceCard({ balanceFormatted }: { balanceFormatted: string }) {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>{COPY.availableBalance}</Text>
      <Text style={styles.balanceAmount}>{balanceFormatted}</Text>
      <View style={styles.balanceButtons}>
        <Pressable
          onPress={() => router.push('/my/wallet/topup')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.pillButton, styles.pillFilled, pressed && styles.pressed]}>
          <Text style={[styles.pillText, styles.pillTextFilled]}>{COPY.topUp}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/my/wallet/withdraw')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.pillButton, styles.pillOutline, pressed && styles.pressed]}>
          <Text style={[styles.pillText, styles.pillTextOutline]}>{COPY.withdraw}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Live: From / To date inputs + Filter / Clear. Not wired up yet. */
function DateFilter() {
  return (
    <View style={styles.filterCard}>
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <PressableField
            label={COPY.from}
            placeholder={COPY.datePlaceholder}
            icon="calendar"
            onPress={() => console.log('[eWallet] From date pressed — not wired up yet')}
          />
        </View>
        <View style={styles.dateField}>
          <PressableField
            label={COPY.to}
            placeholder={COPY.datePlaceholder}
            icon="calendar"
            onPress={() => console.log('[eWallet] To date pressed — not wired up yet')}
          />
        </View>
      </View>
      <View style={styles.filterButtons}>
        <Pressable
          onPress={() => console.log('[eWallet] Filter pressed — not wired up yet')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.smallButton, styles.pillFilled, pressed && styles.pressed]}>
          <Text style={[styles.smallButtonText, styles.pillTextFilled]}>{COPY.filter}</Text>
        </Pressable>
        <Pressable
          onPress={() => console.log('[eWallet] Clear pressed — not wired up yet')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.smallButton, styles.clearButton, pressed && styles.pressed]}>
          <Text style={[styles.smallButtonText, styles.clearText]}>{COPY.clear}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TransactionCard({ transaction }: { transaction: WalletTransaction }) {
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${transaction.dateFormatted}, ${transaction.description}, ${transaction.amountFormatted}, ${transaction.type.label}`}>
      <View style={styles.cardRow}>
        <View style={styles.cardInfo}>
          <Text style={styles.description}>{transaction.description}</Text>
          <Text style={styles.date}>{transaction.dateFormatted}</Text>
        </View>
        <View style={styles.cardEnd}>
          <Text style={[styles.amount, transaction.isCredit && styles.amountCredit]}>
            {transaction.amountFormatted}
          </Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{transaction.type.label}</Text>
          </View>
        </View>
      </View>
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
  },
  balanceCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  balanceLabel: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.mutedText,
    marginBottom: 6,
  },
  balanceAmount: {
    fontFamily: Fonts.primaryBold,
    fontSize: 38,
    color: Colors.primaryOrange,
  },
  balanceButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  pillButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pillFilled: {
    backgroundColor: Colors.primaryOrange,
  },
  pillOutline: {
    backgroundColor: Colors.white,
  },
  pillText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
  },
  pillTextFilled: {
    color: Colors.white,
  },
  pillTextOutline: {
    color: Colors.primaryOrange,
  },
  heading: {
    fontFamily: Fonts.primaryBold,
    fontSize: 22,
    color: Colors.sectionHeading,
    marginTop: 28,
    marginBottom: 12,
  },
  filterCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    marginBottom: 14,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  smallButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
    backgroundColor: Colors.white,
  },
  clearText: {
    color: Colors.dark,
  },
  emptyBox: {
    borderRadius: 16,
    backgroundColor: Colors.white,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 15,
    color: Colors.mutedText,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  description: {
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.dark,
  },
  date: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.helperText,
  },
  cardEnd: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amount: {
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.dark,
  },
  amountCredit: {
    color: Colors.verifiedText,
  },
  typeBadge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    backgroundColor: Colors.activeRowBackground,
  },
  typeText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.chipText,
  },
  pressed: {
    opacity: 0.85,
  },
});
