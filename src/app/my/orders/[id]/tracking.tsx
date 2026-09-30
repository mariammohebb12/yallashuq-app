import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  fetchTracking,
  type OrderTracking,
  type TrackingLeg,
  type TrackingStatus,
} from '@/api/delivery-tracking';
import { FormMessage } from '@/components/form-message';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Order tracking (Developer Scope §6) — opened by "Track" in Order Detail's "Last Delivery
 * Orders" section (placement decided by the user 2026-09-30; the Screen List entry wasn't
 * available). There's no tracking page on the live site to copy.
 *
 * Real data from /api/delivery/track (see src/api/delivery-tracking.ts) — NOT yet tested
 * end-to-end: staging still runs the old fake stub, so this screen shows labelled sample data
 * there. Not visually verified with a real shipment.
 *
 * Layout (plain, not a confirmed design): a summary card (overall status, tracking number,
 * provider, last update), then one card per leg (0, 1 or several legs — e.g. cross-border).
 * Statuses are the backend's values made readable, one neutral badge style (no colour meaning).
 */

// PLACEHOLDER COPY: nothing here is confirmed (no live tracking page exists).
const COPY = {
  title: 'Track Order',
  status: 'Status',
  trackingNumber: 'Tracking number',
  provider: 'Carrier',
  lastUpdated: 'Last updated',
  completedAt: 'Completed',
  legs: 'Shipment legs',
  legFallback: (index: number) => `Leg ${index + 1}`,
  sampleData: 'Sample data — not your real shipment',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; tracking: OrderTracking; isSampleData: boolean };

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const result = await fetchTracking(Number(id));
    if (request !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', tracking: result.tracking, isSampleData: result.isSampleData }
        : { status: 'error', message: result.message }
    );
  }, [id]);

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
      ) : state.status === 'error' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <FormMessage type="error" message={state.message} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {state.isSampleData && <SampleDataBanner message={COPY.sampleData} />}
          <SummaryCard tracking={state.tracking} />
          {state.tracking.legs.length > 0 && (
            <>
              <Text style={styles.heading}>{COPY.legs}</Text>
              <View style={styles.list}>
                {state.tracking.legs.map((leg, index) => (
                  <LegCard key={leg.id} leg={leg} index={index} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function SummaryCard({ tracking }: { tracking: OrderTracking }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{COPY.status}</Text>
        <Badge status={tracking.status} />
      </View>
      <OptionalRow label={COPY.trackingNumber} value={tracking.trackingNumber} />
      <OptionalRow label={COPY.provider} value={tracking.provider} />
      <OptionalRow label={COPY.lastUpdated} value={tracking.lastUpdatedFormatted} />
    </View>
  );
}

function LegCard({ leg, index }: { leg: TrackingLeg; index: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.legName}>{leg.name ?? COPY.legFallback(index)}</Text>
        <Badge status={leg.status} />
      </View>
      <OptionalRow label={COPY.trackingNumber} value={leg.trackingNumber} />
      <OptionalRow label={COPY.provider} value={leg.provider} />
      <OptionalRow label={COPY.lastUpdated} value={leg.lastUpdatedFormatted} />
      <OptionalRow label={COPY.completedAt} value={leg.completedAtFormatted} />
    </View>
  );
}

/** Rows the backend left empty are left out. */
function OptionalRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function Badge({ status }: { status: TrackingStatus }) {
  if (!status.label) {
    return null;
  }
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{status.label}</Text>
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
  heading: {
    fontFamily: Fonts.primaryBold,
    fontSize: 22,
    color: Colors.sectionHeading,
    marginTop: 28,
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 10,
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
  legName: {
    flexShrink: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
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
