import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchGiftCards, type GiftCard } from '@/api/gift-cards';
import { FormMessage } from '@/components/form-message';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: My Gift Cards — the live /my/gift-cards page (opened from the Account tab).
 *
 * Real data from /my/gift-cards/json (see src/api/gift-cards.ts) — NOT yet tested end-to-end.
 * Where that route isn't deployed (staging, 2026-09-30) fetchGiftCards returns sample data and
 * this screen shows a visible "sample data" banner.
 *
 * ⚠️ NOT VISUALLY VERIFIED WITH A POPULATED CARD: the staging test customer has no gift cards, so
 * only the empty state matches something seen on the live page. The card layout is a plain one
 * built from the route's fields only (program name, balance, masked code, expiration, status) —
 * not a confirmed design. The Screen List entry for this screen hasn't been checked.
 */

const COPY = {
  // Confirmed from the live /my/gift-cards page.
  screenTitle: 'My Gift Cards',
  empty: 'You have no gift cards yet.',
  // PLACEHOLDER COPY: field labels aren't confirmed (no populated live card seen yet).
  balance: 'Balance',
  code: 'Code',
  expires: 'Expires',
  status: 'Status',
  sampleData: 'Sample data — not your real gift cards',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; giftCards: GiftCard[]; isSampleData: boolean };

export default function GiftCardsScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchGiftCards();
    if (id !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', giftCards: result.giftCards, isSampleData: result.isSampleData }
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
      <Stack.Screen options={{ title: COPY.screenTitle }} />
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
          {state.giftCards.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{COPY.empty}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {state.giftCards.map((card) => (
                <GiftCardCard key={card.id} card={card} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function GiftCardCard({ card }: { card: GiftCard }) {
  const details = [
    `${COPY.balance} ${card.balanceFormatted}`,
    `${COPY.code} ${card.maskedCode}`,
    card.expirationFormatted && `${COPY.expires} ${card.expirationFormatted}`,
    card.state.label && `${COPY.status} ${card.state.label}`,
  ].filter(Boolean);
  return (
    <View style={styles.card} accessible accessibilityLabel={[card.programName, ...details].join(', ')}>
      {card.programName ? <Text style={styles.programName}>{card.programName}</Text> : null}
      <Text style={styles.label}>{COPY.balance}</Text>
      <Text style={styles.balance}>{card.balanceFormatted}</Text>
      <View style={styles.rows}>
        <DetailRow label={COPY.code} value={card.maskedCode} />
        {card.expirationFormatted && (
          <DetailRow label={COPY.expires} value={card.expirationFormatted} />
        )}
        {card.state.label ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{COPY.status}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{card.state.label}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
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
  programName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.dark,
    marginBottom: 12,
  },
  label: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.mutedText,
  },
  balance: {
    fontFamily: Fonts.primaryBold,
    fontSize: 30,
    color: Colors.primaryOrange,
    marginTop: 4,
  },
  rows: {
    marginTop: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.helperText,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: Fonts.primarySemiBold,
    fontSize: 14,
    color: Colors.dark,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    backgroundColor: Colors.activeRowBackground,
  },
  badgeText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.chipText,
  },
});
