import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchReturns, type ReturnBadge, type ReturnSummary } from '@/api/returns';
import { FormMessage } from '@/components/form-message';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen 27: My Returns (List) — the live /my/returns page.
 *
 * ⚠️ BLOCKED ON BACKEND — RUNS ON TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * The live page is server-rendered HTML only; no JSON route lists returns (checked on staging
 * 2026-09-28). Requested as Route 3 of docs/backend-requests/006-returns-json.md. Until it ships,
 * fetchReturns returns the staging test customer's real rows as sample data and this screen shows
 * a visible "sample data" banner. When the route ships, only src/api/returns.ts changes.
 *
 * Same columns as the live table (Return #, Order, Pickup Date, Refunded, Status), reflowed into
 * one card per return for phone width, like My Orders / Invoices: the return number (a link to
 * the return, as on the live page) with the Status badges stacked at the end, then Order (a link
 * to the order, as on the live page), Pickup Date and Refunded. The whole card also opens the
 * return. The live page has no heading of its own — only its title, "My Returns".
 * Badge colors are the live stylesheet's (Colors.badgeSecondary / badgeSuccess).
 * "Refunded" is the live column name; it may not mean money actually moved (CLAUDE.md, "Known
 * Blockers").
 *
 * NOT BUILT: the empty state — the live page's "no returns" text wasn't seen (the test customer
 * has returns), so no wording is made up for it.
 * Linked from the Account tab's "My Returns" row (app-only; the live "My Account" page has no
 * Returns card).
 */

const COPY = {
  // Confirmed from the live /my/returns page (its title and table headers).
  title: 'My Returns',
  order: 'Order',
  pickupDate: 'Pickup Date',
  refunded: 'Refunded',
  // PLACEHOLDER COPY (not confirmed anywhere), same pattern as the other sample-data banners.
  sampleData: 'Sample data — the returns endpoint is not ready yet. These are not your real returns.',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; returns: ReturnSummary[]; isSampleData: boolean };

export default function MyReturnsScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchReturns();
    if (id !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', returns: result.returns, isSampleData: result.isSampleData }
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
      <Stack.Screen options={{ title: COPY.title }} />
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {state.status === 'ready' && state.isSampleData && (
            <SampleDataBanner message={COPY.sampleData} />
          )}
          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : (
            <View style={styles.list}>
              {state.returns.map((returnRequest) => (
                <ReturnCard key={returnRequest.id} returnRequest={returnRequest} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function openReturn(returnRequest: ReturnSummary) {
  router.push({ pathname: '/my/returns/[id]', params: { id: String(returnRequest.id) } });
}

function ReturnCard({ returnRequest }: { returnRequest: ReturnSummary }) {
  const { order } = returnRequest;
  return (
    <Pressable
      onPress={() => openReturn(returnRequest)}
      accessibilityRole="button"
      accessibilityLabel={[
        returnRequest.name,
        returnRequest.progress.label,
        returnRequest.decision?.label,
        `${COPY.order} ${order.name}`,
        `${COPY.pickupDate} ${returnRequest.pickupDateFormatted}`,
        `${COPY.refunded} ${returnRequest.refundedFormatted}`,
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        {/* Live: the return number is the link to the return. */}
        <Pressable
          onPress={() => openReturn(returnRequest)}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.returnLink}>
          <Text style={styles.returnName}>{returnRequest.name}</Text>
        </Pressable>
        {/* Live Status column: progress badge, then the seller's decision under it. */}
        <View style={styles.badges}>
          <Badge badge={returnRequest.progress} color={Colors.badgeSecondary} />
          {returnRequest.decision && (
            <Badge badge={returnRequest.decision} color={Colors.badgeSuccess} />
          )}
        </View>
      </View>

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.label}>{COPY.order}</Text>
          {/* Live: the order number is the link to the order. */}
          <Pressable
            onPress={() =>
              router.push({ pathname: '/my/orders/[id]', params: { id: String(order.id) } })
            }
            hitSlop={8}
            accessibilityRole="link">
            <Text style={styles.link}>{order.name}</Text>
          </Pressable>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{COPY.pickupDate}</Text>
          <Text style={styles.value}>{returnRequest.pickupDateFormatted}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{COPY.refunded}</Text>
          <Text style={styles.value}>{returnRequest.refundedFormatted}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Live Bootstrap badge: pill, white text, weight 600. */
function Badge({ badge, color }: { badge: ReturnBadge; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{badge.label}</Text>
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
  list: {
    gap: 14,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  returnLink: {
    flexShrink: 1,
  },
  returnName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 17,
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  badges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 12,
    color: Colors.white,
  },
  fields: {
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.helperText,
  },
  value: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.dark,
  },
  link: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 14,
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.85,
  },
});
