import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import {
  fetchNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from '@/api/notifications';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Notification Preferences (added 2026-10-02, tracker #25, session 7).
 *
 * APP-ONLY SCREEN, no live-site equivalent (the live site has no notifications feature at all —
 * same situation as the Notifications inbox itself). Reachable from the Notifications screen's
 * header (a settings icon) and from Account.
 *
 * Four togglable categories, matching the backend's real notify_* fields on res.partner (added
 * this session) and yallashuq.notification's own type selection: order updates, warranty
 * updates, return/refund updates, promotional. 'General'/'Support' notifications are NOT shown
 * here — they aren't user-togglable (account-critical, same reasoning as not letting someone
 * silence a security message). Turning a category off stops BOTH the in-app row and the push for
 * it — confirmed in notification.py's _notify(), not just hidden from the inbox.
 *
 * Each switch saves immediately (no separate "Save" button) — matches the simplest honest
 * behavior for a settings toggle. NOT YET TESTED END-TO-END (new backend routes this session).
 */

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; preferences: NotificationPreferences };

const CATEGORIES: { key: NotificationPreferenceKey; labelKey: string }[] = [
  { key: 'order_updates', labelKey: 'notificationPreferences.orderUpdates' },
  { key: 'warranty_updates', labelKey: 'notificationPreferences.warrantyUpdates' },
  { key: 'return_updates', labelKey: 'notificationPreferences.returnUpdates' },
  { key: 'promotional', labelKey: 'notificationPreferences.promotional' },
];

export default function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [savingKey, setSavingKey] = useState<NotificationPreferenceKey | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setState({ status: 'loading' });
    const result = await fetchNotificationPreferences();
    if (id !== requestId.current) return;
    setState(
      result.ok
        ? { status: 'ready', preferences: result.preferences }
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

  async function toggle(key: NotificationPreferenceKey, value: boolean) {
    if (state.status !== 'ready') return;
    const previous = state.preferences;
    const next = { ...previous, [key]: value };
    setState({ status: 'ready', preferences: next });
    setSavingKey(key);
    setSaveError(null);
    const result = await saveNotificationPreferences(next);
    setSavingKey(null);
    if (!result.ok) {
      // Revert on failure rather than leaving the switch showing a value that didn't save.
      setState({ status: 'ready', preferences: previous });
      setSaveError(result.message);
    }
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: t('notificationPreferences.title') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('notificationPreferences.intro')}</Text>

        {state.status === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primaryOrange} />
          </View>
        )}

        {state.status === 'error' && <FormMessage type="error" message={state.message} />}

        {state.status === 'ready' && (
          <View style={styles.card}>
            {CATEGORIES.map(({ key, labelKey }, index) => (
              <View key={key} style={[styles.row, index > 0 && styles.rowDivider]}>
                <Text style={styles.rowLabel}>{t(labelKey)}</Text>
                {savingKey === key ? (
                  <ActivityIndicator color={Colors.primaryOrange} />
                ) : (
                  <Switch
                    value={state.preferences[key]}
                    onValueChange={(value) => toggle(key, value)}
                    trackColor={{ true: Colors.primaryOrange, false: Colors.iconButtonBorder }}
                    accessibilityLabel={t(labelKey)}
                  />
                )}
              </View>
            ))}
          </View>
        )}

        {saveError && <FormMessage type="error" message={saveError} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  intro: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.mutedText,
  },
  loading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
  },
  rowLabel: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
});
