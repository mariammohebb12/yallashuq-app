import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchTicketCount } from '@/api/tickets';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Tickets — the live /my/tickets page (opened from the Account tab).
 *
 * REAL DATA, COUNT ONLY — NO SAMPLE ROWS. The ticket count comes from the real /my/counters
 * route (see src/api/tickets.ts). With 0 tickets the screen shows the live empty-state text, exactly
 * as staging does. With more than 0 it says how many there are but lists none: no route returns
 * the tickets yet (docs/backend-requests/010-helpdesk-tickets-list-json.md), and the app never
 * invents rows.
 * Not shown: the live page's Sort By / Filter By / Group By / search controls — nothing to sort or
 * filter until the list route exists.
 */

const COPY = {
  // Confirmed from the live /my/tickets page (breadcrumb, empty state).
  heading: 'Tickets',
  empty: 'There are currently no Ticket for your account.',
  // PLACEHOLDER COPY (not confirmed anywhere).
  listUnavailable: (count: number) =>
    `You have ${count} ${count === 1 ? 'ticket' : 'tickets'}. The ticket list isn’t available in the app yet.`,
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; count: number };

export default function TicketsScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchTicketCount();
    if (id !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', count: result.count }
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
      <Stack.Screen options={{ title: COPY.heading }} />
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>{COPY.heading}</Text>
          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {state.count === 0 ? COPY.empty : COPY.listUnavailable(state.count)}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// Same page, heading and empty box as My Orders.
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
    fontFamily: Fonts.primary,
    fontSize: 26,
    fontWeight: '800',
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
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.mutedText,
    textAlign: 'center',
  },
});
