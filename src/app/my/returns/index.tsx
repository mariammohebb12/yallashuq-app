import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchReturns, type ReturnBadge, type ReturnSummary } from '@/api/returns';
import { FormMessage } from '@/components/form-message';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen 27: My Returns (List) — the live /my/returns page.
 *
 * DATA: the real /my/returns/json route (production only, NOT YET TESTED END-TO-END — see
 * src/api/returns.ts). Where it isn't deployed (staging, 2026-10-01) fetchReturns returns the
 * staging test customer's rows as sample data and this screen shows a visible "sample data"
 * banner. Status badges with real data are the backend's codes made readable (no labels sent).
 *
 * Paging: like My Orders — "Load More" (same button, copy and behaviour) fetches the next page
 * until page_count is reached; the list reloads from page 1 each time the screen is shown.
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
 * has returns), so no wording is made up for it. With real data, a customer with no returns sees
 * an empty page.
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
  // Same as My Orders / the Shop tab (confirmed from the live homepage catalog's button).
  loadMore: 'Load More',
  loading: 'Loading...',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      returns: ReturnSummary[];
      isSampleData: boolean;
      hasNext: boolean;
      nextPage: number;
    };

export default function MyReturnsScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchReturns();
    if (id !== requestId.current) {
      return;
    }
    setLoadingMore(false);
    setState(
      result.ok
        ? {
            status: 'ready',
            returns: result.returns,
            isSampleData: result.isSampleData,
            hasNext: result.hasNext,
            nextPage: result.nextPage,
          }
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

  // Same flow as My Orders' loadMore.
  async function loadMore() {
    if (state.status !== 'ready' || !state.hasNext || loadingMore) {
      return;
    }
    const id = requestId.current; // A refresh on focus supersedes this page.
    setLoadingMore(true);
    const result = await fetchReturns(state.nextPage);
    if (!mounted.current || id !== requestId.current) {
      return;
    }
    setLoadingMore(false);
    if (!result.ok) {
      Alert.alert(result.message); // PLACEHOLDER UI, as on My Orders.
      return;
    }
    setState((current) =>
      current.status === 'ready'
        ? {
            ...current,
            // Skip anything already listed, in case returns changed between pages.
            returns: [
              ...current.returns,
              ...result.returns.filter((r) => !current.returns.some((c) => c.id === r.id)),
            ],
            hasNext: result.hasNext,
            nextPage: result.nextPage,
          }
        : current
    );
  }

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
          {state.status === 'ready' && state.hasNext && (
            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              style={({ pressed }) => [styles.loadMore, (pressed || loadingMore) && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ busy: loadingMore }}>
              <Text style={styles.loadMoreText}>{loadingMore ? COPY.loading : COPY.loadMore}</Text>
            </Pressable>
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
  // Same look as My Orders' / the Shop tab's "Load More".
  loadMore: {
    alignSelf: 'center',
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(242,178,119,0.5)',
    backgroundColor: 'rgb(255,244,230)',
    paddingHorizontal: 28,
    justifyContent: 'center',
    marginTop: 16,
  },
  loadMoreText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.loadMoreText,
  },
});
