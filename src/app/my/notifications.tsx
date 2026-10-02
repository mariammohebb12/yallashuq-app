import { router, Stack } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/api/notifications';
import { FormMessage } from '@/components/form-message';
import { SampleDataBanner } from '@/components/order-parts';
import { setUnreadNotifications } from '@/state/notifications-unread';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Notifications — the in-app inbox (opened from the header bell).
 *
 * APP-ONLY DESIGN: the live site has no notifications page. Data from /my/notifications/json
 * (src/api/notifications.ts) — NOT YET TESTED END-TO-END; staging falls back to labelled sample
 * data with a "sample data" banner.
 *
 * ⚠️ NOTHING ARRIVES BY ITSELF YET ⚠️ No push notifications (that needs a Firebase / APNs /
 * OneSignal / Expo push account decision — separate task), and no backend code creates
 * notifications yet (nothing calls _notify()). So the inbox will be empty for real customers until
 * the backend decides which events notify them.
 *
 * One card per notification, newest first: type icon + label, title, body, date; unread ones are
 * bold with an orange dot. Tapping one marks it read (/my/notifications/<id>/read) and, if it
 * links to a record the app has a screen for (an order or a return), opens it. "Mark all as read"
 * in the header (/my/notifications/read_all), shown only while something is unread. Paging and
 * pull-to-refresh work like My Orders: page 1 loads once, Load More adds pages, and a late page is
 * only appended to the list it was asked for.
 */

// Copy moved into src/i18n/locales/en.json under "notifications" (RTL/i18n work, 2026-10-01).

const TYPE_ICONS: Record<string, SymbolViewProps['name']> = {
  order: { ios: 'shippingbox', android: 'package_2', web: 'package_2' },
  warranty: { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' },
  return: { ios: 'arrow.uturn.backward', android: 'assignment_return', web: 'assignment_return' },
  promotional: { ios: 'tag', android: 'sell', web: 'sell' },
  support: { ios: 'lifepreserver', android: 'support', web: 'support' },
  general: { ios: 'bell', android: 'notifications', web: 'notifications' },
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      notifications: AppNotification[];
      unreadCount: number;
      isSampleData: boolean;
      hasNext: boolean;
      nextPage: number;
    };

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  // Fixed 2026-10-01, frontend sweep: these 3 call sites (loadMore, mark-as-read, mark-all-read)
  // showed a native Alert.alert popup for a failed action (placeholder UI). Same inline-banner
  // fix already applied to Home/Shop/Product Detail/My Orders/My Returns this session.
  const [actionError, setActionError] = useState<string | null>(null);
  // Bumped each time page 1 is (re)loaded: a reply for an older list is dropped.
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
    const result = await fetchNotifications();
    if (!mounted.current || id !== requestId.current) {
      return;
    }
    setLoadingMore(false);
    setActionError(null);
    setState(
      result.ok
        ? {
            status: 'ready',
            notifications: result.notifications,
            unreadCount: result.unreadCount,
            isSampleData: result.isSampleData,
            hasNext: result.hasNext,
            nextPage: result.nextPage,
          }
        : { status: 'error', message: result.message }
    );
    if (result.ok) {
      // Keep the bell in step (no count on sample data).
      setUnreadNotifications(result.isSampleData ? null : result.unreadCount);
    }
  }, []);

  // Like My Orders: load once; later reloads only on pull-to-refresh.
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

  async function loadMore() {
    if (state.status !== 'ready' || !state.hasNext || loadingMore) {
      return;
    }
    const id = requestId.current; // A refresh replaces the list: this page then no longer fits.
    const page = state.nextPage;
    setLoadingMore(true);
    setActionError(null);
    const result = await fetchNotifications(page);
    if (!mounted.current || id !== requestId.current) {
      return; // The refresh resets loadingMore when it lands.
    }
    setLoadingMore(false);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    setState((current) =>
      // Only append the page the list is waiting for.
      current.status === 'ready' && current.nextPage === page
        ? {
            ...current,
            notifications: [
              ...current.notifications,
              ...result.notifications.filter(
                (n) => !current.notifications.some((c) => c.id === n.id)
              ),
            ],
            unreadCount: result.unreadCount,
            hasNext: result.hasNext,
            nextPage: result.nextPage,
          }
        : current
    );
  }

  /** Marks read locally (and on the backend unless it's sample data), then follows its link. */
  async function open(notification: AppNotification) {
    if (state.status !== 'ready') {
      return;
    }
    if (!notification.isRead) {
      const isSampleData = state.isSampleData;
      const unreadCount = Math.max(0, state.unreadCount - 1);
      setState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              unreadCount,
              notifications: current.notifications.map((n) =>
                n.id === notification.id ? { ...n, isRead: true } : n
              ),
            }
          : current
      );
      if (!isSampleData) {
        setUnreadNotifications(unreadCount);
        const result = await markNotificationRead(notification.id);
        if (!result.ok && mounted.current) {
          // Not saved: reload so the list and the bell show the backend's real state.
          setActionError(result.message);
          load();
          return;
        }
      }
    }
    const link = notification.link;
    if (link?.screen === 'order') {
      router.push({ pathname: '/my/orders/[id]', params: { id: String(link.id) } });
    } else if (link?.screen === 'return') {
      router.push({ pathname: '/my/returns/[id]', params: { id: String(link.id) } });
    }
  }

  async function markAll() {
    if (state.status !== 'ready' || markingAll) {
      return;
    }
    if (!state.isSampleData) {
      setMarkingAll(true);
      setActionError(null);
      const result = await markAllNotificationsRead();
      if (!mounted.current) {
        return;
      }
      setMarkingAll(false);
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      setUnreadNotifications(0);
    }
    setState((current) =>
      current.status === 'ready'
        ? {
            ...current,
            unreadCount: 0,
            notifications: current.notifications.map((n) => ({ ...n, isRead: true })),
          }
        : current
    );
  }

  const showMarkAll = state.status === 'ready' && state.unreadCount > 0;

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{
          title: t('notifications.title'),
          // Added 2026-10-02 (tracker #25, session 7): a settings entry point to the new
          // per-category notification preferences screen, always shown next to (or instead of)
          // "Mark all as read".
          headerRight: () => (
            <View style={styles.headerRight}>
              {showMarkAll && (
                <Pressable
                  onPress={markAll}
                  disabled={markingAll}
                  hitSlop={8}
                  style={({ pressed }) => (pressed || markingAll) && styles.pressed}
                  accessibilityRole="button"
                  accessibilityState={{ busy: markingAll }}>
                  <Text style={styles.markAll}>{t('notifications.markAllRead')}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push('/my/notification-preferences')}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
                accessibilityRole="button"
                accessibilityLabel={t('notifications.preferences')}>
                <SymbolView
                  name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
                  size={22}
                  tintColor={Colors.dark}
                />
              </Pressable>
            </View>
          ),
        }}
      />
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
          {state.status === 'ready' && state.isSampleData && (
            <SampleDataBanner message={t('notifications.sampleData')} />
          )}
          {actionError !== null && (
            <View style={styles.actionErrorBox}>
              <FormMessage type="error" message={actionError} />
            </View>
          )}
          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : state.notifications.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {state.notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onPress={() => open(notification)}
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
              <Text style={styles.loadMoreText}>
                {loadingMore ? t('notifications.loading') : t('notifications.loadMore')}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function NotificationCard({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const unread = !notification.isRead;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={[
        notification.typeLabel,
        notification.title,
        notification.body,
        notification.createdFormatted,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityState={{ selected: unread }}>
      <View style={styles.iconBox}>
        <SymbolView
          name={TYPE_ICONS[notification.type] ?? TYPE_ICONS.general}
          size={18}
          tintColor={Colors.primaryOrange}
        />
      </View>
      <View style={styles.cardText}>
        <View style={styles.cardHead}>
          <Text style={styles.typeLabel}>{notification.typeLabel}</Text>
          <Text style={styles.date}>{notification.createdFormatted}</Text>
        </View>
        <Text style={[styles.title, unread && styles.titleUnread]}>{notification.title}</Text>
        {notification.body ? <Text style={styles.body}>{notification.body}</Text> : null}
      </View>
      {unread && <View style={styles.unreadDot} />}
      {notification.link && (
        // "forward" flips to point left in Arabic/Hebrew.
        <SymbolView
          name={{ ios: 'chevron.forward', android: 'chevron_right', web: 'chevron_right' }}
          size={12}
          tintColor={Colors.placeholderIcon}
        />
      )}
    </Pressable>
  );
}

// Card, empty-state and "Load More" styles follow My Orders (src/app/my/orders/index.tsx).
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
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  cardText: {
    flex: 1,
    gap: 3,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  typeLabel: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 11,
    color: Colors.helperText,
  },
  date: {
    fontFamily: Fonts.primary,
    fontSize: 11,
    color: Colors.subtleText,
  },
  title: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.sectionHeading,
  },
  titleUnread: {
    fontFamily: Fonts.primaryBold,
  },
  body: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.mutedText,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryOrange,
  },
  markAll: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 14,
    color: Colors.primaryOrange,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emptyBox: {
    borderRadius: 16,
    backgroundColor: Colors.white,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.mutedText,
    textAlign: 'center',
  },
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
  actionErrorBox: {
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
