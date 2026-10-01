import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchOrders, type OrderSummary } from '@/api/orders';
import { FormMessage } from '@/components/form-message';
import { ORDER_COPY, OrderActionButton, SampleDataBanner } from '@/components/order-parts';
import { PlaceholderModal } from '@/components/placeholder-modal';
import { ReviewModal } from '@/components/review-modal';
import { SupportModal } from '@/components/support-modal';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: My Orders — the live /my/orders page (opened from the Account tab).
 *
 * Real data from /my/orders/json (see src/api/orders.ts) — NOT yet tested end-to-end. Real orders
 * have no product thumbnail and no "Return" link yet (not in that route; see #005). Where the route
 * isn't deployed (staging, 2026-09-30) fetchOrders returns sample data and this screen shows a
 * visible "sample data" banner.
 *
 * Paging: the route returns one page at a time; "Load More" (same button, copy and behaviour as the
 * Shop tab's) fetches the next page until page_count is reached. No order total is shown.
 * Like the Shop tab, page 1 loads once when the screen opens and again only on pull-to-refresh,
 * so pages added with "Load More" are kept after opening an order and coming back (fixed
 * 2026-10-01; it used to reload from page 1 on every visit).
 * INTENTIONAL TRADEOFF: the list no longer refreshes by itself when coming back from Order Detail,
 * so a status change that happened meanwhile only shows after a pull-to-refresh.
 * A "Load More" reply is only appended to the list it was asked for: not after a refresh has
 * replaced the list, and not if that page is no longer the next one (e.g. a duplicate reply).
 *
 * Same fields as the live page's table (Sales Order #, Order Date, Total, Return, Feedback &
 * Support), reflowed into one stacked card per order for phone width: order number (title), date
 * (the time is hidden on phones, as on the live page) and total stacked on the start side, the
 * first product's thumbnail on the end side (not on the live list; requested in #005 — orders
 * with several products show only the first). "Return" (only where the backend says a return is
 * available) sits under the total, beside the image; "Edit Review" and "SUPPORT" run below.
 * The order number is styled as a link (orange, underlined) and opens the order detail, as does
 * the rest of the card. Status, seller, products etc. live on the order detail screen only.
 * No order count is shown: the backend's count (/my/counters) is wrong on staging (see #005).
 * "Edit Review" and "SUPPORT" open the live review / support popups' designs (visual only: nothing
 * is sent yet — see review-modal.tsx, support-modal.tsx). "Return" opens a placeholder popup: no
 * JSON route for it yet.
 */

const COPY = {
  // Confirmed from the live /my/orders page.
  heading: 'Sales Orders',
  // PLACEHOLDER COPY (standard Odoo portal wording, not confirmed on yallashuq.com).
  empty: 'There are currently no orders for your account.',
  // Same as the Shop tab (confirmed from the live homepage catalog's button).
  loadMore: 'Load More',
  loading: 'Loading...',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      orders: OrderSummary[];
      isSampleData: boolean;
      hasNext: boolean;
      nextPage: number;
    };

type Popup = { title: string; detail: string } | null;

export default function MyOrdersScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [popup, setPopup] = useState<Popup>(null);
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
  const [supportOrderName, setSupportOrderName] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Bumped each time page 1 is (re)loaded: identifies the current list, so a reply for an older
  // list is dropped.
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
    const result = await fetchOrders();
    if (!mounted.current || id !== requestId.current) {
      return;
    }
    setLoadingMore(false);
    setState(
      result.ok
        ? {
            status: 'ready',
            orders: result.orders,
            isSampleData: result.isSampleData,
            hasNext: result.hasNext,
            nextPage: result.nextPage,
          }
        : { status: 'error', message: result.message }
    );
  }, []);

  // Same as the Shop tab: load once; later reloads only on pull-to-refresh.
  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    if (mounted.current) {
      setRefreshing(false);
    }
  }

  // Same flow as the Shop tab's loadMore, plus a check that the reply still fits the list.
  async function loadMore() {
    if (state.status !== 'ready' || !state.hasNext || loadingMore) {
      return;
    }
    const id = requestId.current; // A refresh replaces the list: this page then no longer fits.
    const page = state.nextPage;
    setLoadingMore(true);
    const result = await fetchOrders(page);
    if (!mounted.current || id !== requestId.current) {
      return; // The refresh resets loadingMore when it lands.
    }
    setLoadingMore(false);
    if (!result.ok) {
      Alert.alert(result.message); // PLACEHOLDER UI, as on the Shop tab.
      return;
    }
    setState((current) =>
      // Only append the page the list is waiting for.
      current.status === 'ready' && current.nextPage === page
        ? {
            ...current,
            // Skip anything already listed, in case orders changed between pages.
            orders: [
              ...current.orders,
              ...result.orders.filter((o) => !current.orders.some((c) => c.id === o.id)),
            ],
            hasNext: result.hasNext,
            nextPage: result.nextPage,
          }
        : current
    );
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: 'My Orders' }} />
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={Colors.primaryOrange}
            />
          }>
          {state.status === 'ready' && state.isSampleData && <SampleDataBanner />}
          <Text style={styles.heading}>{COPY.heading}</Text>

          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : state.orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{COPY.empty}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {state.orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPopup={(title) => setPopup({ title, detail: order.name })}
                  onReview={() => setReviewOrderId(order.id)}
                  onSupport={() => setSupportOrderName(order.name)}
                />
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
      <PlaceholderModal
        title={popup?.title ?? null}
        detail={popup?.detail}
        onClose={() => setPopup(null)}
      />
      <ReviewModal orderId={reviewOrderId} onClose={() => setReviewOrderId(null)} />
      <SupportModal orderName={supportOrderName} onClose={() => setSupportOrderName(null)} />
    </View>
  );
}

function openOrder(order: OrderSummary) {
  router.push({ pathname: '/my/orders/[id]', params: { id: String(order.id) } });
}

function OrderCard({
  order,
  onPopup,
  onReview,
  onSupport,
}: {
  order: OrderSummary;
  onPopup: (title: string) => void;
  onReview: () => void;
  onSupport: () => void;
}) {
  return (
    <Pressable
      onPress={() => openOrder(order)}
      accessibilityRole="button"
      accessibilityLabel={`${order.name}, ${order.dateFormatted}, ${order.totalFormatted}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.info}>
          {/* Live: the order number is the link to the order. */}
          <Pressable
            onPress={() => openOrder(order)}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.orderLink}>
            <Text style={styles.orderName}>{order.name}</Text>
          </Pressable>
          <Text style={styles.date}>{order.dateFormatted}</Text>
          <Text style={styles.total}>{order.totalFormatted}</Text>
          {order.returnAvailable && (
            <View style={styles.returnRow}>
              <OrderActionButton kind="return" onPress={() => onPopup(ORDER_COPY.returnTitle)} />
            </View>
          )}
        </View>
        <View style={styles.thumbnail}>
          {order.firstProductImageUrl ? (
            <Image
              source={{ uri: order.firstProductImageUrl }}
              style={styles.thumbnailFill}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <SymbolView
              name={{ ios: 'photo', android: 'image', web: 'image' }}
              size={22}
              tintColor={Colors.placeholderIcon}
            />
          )}
        </View>
      </View>

      <View style={styles.feedbackRow}>
        <OrderActionButton
          kind="rate"
          label={ORDER_COPY.editReview}
          onPress={onReview}
        />
        <OrderActionButton kind="support" onPress={onSupport} />
      </View>
    </Pressable>
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
  heading: {
    fontFamily: Fonts.primaryBold,
    fontSize: 26,
    color: Colors.sectionHeading,
    marginBottom: 14,
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
  orderLink: {
    alignSelf: 'flex-start',
  },
  orderName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 17,
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  // Same thumbnail style as the Cart's line images, sized to the text + Return block beside it.
  thumbnail: {
    width: 104,
    height: 104,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailFill: {
    width: '100%',
    height: '100%',
  },
  date: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.helperText,
  },
  total: {
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.primaryOrange,
  },
  returnRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  feedbackRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
  },
  pressed: {
    opacity: 0.85,
  },
  // Same look as the Shop tab's "Load More".
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
