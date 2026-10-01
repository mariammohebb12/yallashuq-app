import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchUnreadCount } from '@/api/notifications';
import { fetchSession } from '@/api/session';
import { setUnreadNotifications, useUnreadNotifications } from '@/state/notifications-unread';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Header bell → the notification inbox (/my/notifications).
 *
 * APP-ONLY: the live site has no bell (checked 2026-10-01; its only unread badge is on the MishMesh
 * support launcher). Placed at the end of the main tabs' header (where apps usually put it), next
 * to the screen title. Shown to signed-in customers only — the inbox needs an account. The badge
 * is the backend's unread_count, in the cart badge's orange; it's hidden at 0 and when there's no
 * real count (sample data on a server without the route, or an error).
 * Refreshed each time a tab is shown. Nothing arrives by itself yet (no push, nothing creates
 * notifications — see src/api/notifications.ts).
 */

export function NotificationBell() {
  const count = useUnreadNotifications();
  const [signedIn, setSignedIn] = useState(false);
  const requestId = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const request = ++requestId.current;
      (async () => {
        const session = await fetchSession();
        if (request !== requestId.current) return;
        const isSignedIn = session.ok && session.session !== null;
        setSignedIn(isSignedIn);
        if (!isSignedIn) {
          setUnreadNotifications(null);
          return;
        }
        const unread = await fetchUnreadCount();
        if (request !== requestId.current) return;
        setUnreadNotifications(unread);
      })();
      return () => {
        requestId.current++;
      };
    }, [])
  );

  if (!signedIn) {
    return null;
  }
  const badge = count && count > 0 ? (count > 99 ? '99+' : String(count)) : null;
  return (
    <Pressable
      onPress={() => router.push('/my/notifications')}
      hitSlop={8}
      style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={badge ? `Notifications, ${count} unread` : 'Notifications'}>
      <SymbolView
        name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
        size={22}
        tintColor={Colors.dark}
      />
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    marginEnd: 16,
    padding: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    end: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 10,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
});
