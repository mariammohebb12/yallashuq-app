import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchReturn, type ReturnDetail, type ReturnLine } from '@/api/returns';
import { FormMessage } from '@/components/form-message';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Return detail — the live /my/returns/<id> page (opened from a row of Order Detail's
 * "Previous Return Requests for This Order" list).
 *
 * ⚠️ BLOCKED ON BACKEND — RUNS ON TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * No JSON route for a return (see src/api/returns.ts); fetchReturn returns sample data copied
 * from staging and this screen shows a visible "sample data" banner. When a route ships, only
 * src/api/returns.ts changes.
 *
 * The live page's sections, in its order, in one column:
 * - Returned Items: grey progress badge + green decision badge, one block per line (Product, Qty,
 *   Price, Refunded), then "Total Expected Refund:";
 * - Pickup History: Date + Slot per pickup;
 * - Request Info: Order (opens Order Detail), Refund Method, Reason, Return Reason, Customer Image.
 * Left out (not in this step's field list): the live "Return Type", "Latest Pickup" and "Status"
 * lines of Request Info.
 * "Refunded" is the live column name; it may not mean money actually moved (see CLAUDE.md,
 * "Known Blockers": gateway refunds aren't automatic yet).
 */

const COPY = {
  // Confirmed from the live /my/returns/<id> page.
  returnedItems: 'Returned Items',
  product: 'Product',
  qty: 'Qty',
  price: 'Price',
  refunded: 'Refunded',
  totalExpectedRefund: 'Total Expected Refund:',
  pickupHistory: 'Pickup History',
  date: 'Date',
  slot: 'Slot',
  requestInfo: 'Request Info',
  order: 'Order:',
  refundMethod: 'Refund Method:',
  reason: 'Reason:',
  returnReason: 'Return Reason:',
  customerImage: 'Customer Image:',
  // PLACEHOLDER COPY (not confirmed anywhere).
  sampleData: 'Sample data — return details are not your real return',
  notFound: 'This return could not be found.',
  noImage: 'No image',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; returnRequest: ReturnDetail | null; isSampleData: boolean };

export default function ReturnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const result = await fetchReturn(Number(id));
    if (request !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', returnRequest: result.returnRequest, isSampleData: result.isSampleData }
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

  const returnRequest = state.status === 'ready' ? state.returnRequest : null;

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: returnRequest ? returnRequest.name : '' }} />
      {state.status === 'ready' && state.isSampleData && (
        <View style={styles.bannerBar}>
          <SampleDataBanner message={COPY.sampleData} />
        </View>
      )}
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : returnRequest === null ? (
            <FormMessage type="error" message={COPY.notFound} />
          ) : (
            <ReturnBody returnRequest={returnRequest} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ReturnBody({ returnRequest }: { returnRequest: ReturnDetail }) {
  const { order } = returnRequest;
  return (
    <View style={styles.sections}>
      {/* ---- Returned Items (with the status badges, as on the live card header) ---- */}
      <Section title={COPY.returnedItems}>
        <View style={styles.badges}>
          <View style={[styles.badge, styles.progressBadge]}>
            <Text style={[styles.badgeText, styles.progressBadgeText]}>
              {returnRequest.progress.label}
            </Text>
          </View>
          {returnRequest.decision && (
            <View style={[styles.badge, styles.decisionBadge]}>
              <Text style={[styles.badgeText, styles.decisionBadgeText]}>
                {returnRequest.decision.label}
              </Text>
            </View>
          )}
        </View>
        {returnRequest.lines.map((line) => (
          <ReturnLineBlock key={line.id} line={line} />
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{COPY.totalExpectedRefund}</Text>
          <Text style={styles.totalValue}>{returnRequest.totalExpectedRefundFormatted}</Text>
        </View>
      </Section>

      {/* ---- Pickup History ---- */}
      <Section title={COPY.pickupHistory}>
        {returnRequest.pickups.map((pickup, index) => (
          <View key={`${pickup.dateFormatted}-${index}`} style={index > 0 && styles.pickupDivider}>
            <LabelValue label={`${COPY.date}:`} value={pickup.dateFormatted} />
            <LabelValue label={`${COPY.slot}:`} value={pickup.slotLabel} />
          </View>
        ))}
      </Section>

      {/* ---- Request Info ---- */}
      <Section title={COPY.requestInfo}>
        <View style={styles.inlineRow}>
          <Text style={styles.label}>{COPY.order} </Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/my/orders/[id]', params: { id: String(order.id) } })
            }
            hitSlop={8}
            accessibilityRole="link">
            <Text style={styles.link}>{order.name}</Text>
          </Pressable>
        </View>
        <LabelValue label={COPY.refundMethod} value={returnRequest.refundMethodLabel} />
        <LabelValue label={COPY.reason} value={returnRequest.reasonLabel} />
        <LabelValue label={COPY.returnReason} value={returnRequest.returnReasonLabel} />
        <Text style={[styles.label, styles.imageLabel]}>{COPY.customerImage}</Text>
        <View style={styles.imageBox}>
          {returnRequest.imageUrl ? (
            <Image
              source={{ uri: returnRequest.imageUrl }}
              style={styles.imageFill}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.imagePlaceholder} accessibilityLabel={COPY.noImage}>
              <SymbolView
                name={{ ios: 'photo', android: 'image', web: 'image' }}
                size={32}
                tintColor={Colors.placeholderIcon}
              />
            </View>
          )}
        </View>
      </Section>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** One row of the live table (Product, Qty, Price, Refunded), stacked for phone width. */
function ReturnLineBlock({ line }: { line: ReturnLine }) {
  return (
    <View style={styles.line}>
      <Text style={styles.strong}>{line.productName}</Text>
      <LabelValue label={`${COPY.qty}:`} value={line.quantityFormatted} />
      <LabelValue label={`${COPY.price}:`} value={line.priceFormatted} />
      <LabelValue label={`${COPY.refunded}:`} value={line.refundedFormatted} />
    </View>
  );
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inlineRow}>
      <Text style={styles.label}>{label} </Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

// Same card / text styles as Order Detail (src/app/my/orders/[id].tsx).
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 32,
  },
  sections: {
    gap: 14,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionTitle: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.sectionHeading,
    marginBottom: 4,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  // PLACEHOLDER COLORS: live uses Bootstrap bg-secondary (grey) / bg-success (green), whose theme
  // colors aren't in the page source; these reuse the app's existing grey / success tokens.
  progressBadge: {
    backgroundColor: Colors.inputBorder,
  },
  progressBadgeText: {
    color: Colors.mutedText,
  },
  decisionBadge: {
    backgroundColor: Colors.successBackground,
  },
  decisionBadgeText: {
    color: Colors.successText,
  },
  line: {
    gap: 3,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inputBorder,
  },
  strong: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.sectionHeading,
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  label: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.helperText,
  },
  value: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.dark,
  },
  link: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  totalLabel: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.dark,
  },
  totalValue: {
    fontFamily: Fonts.primary,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primaryOrange,
  },
  pickupDivider: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
  },
  imageLabel: {
    marginTop: 6,
  },
  imageBox: {
    width: 140,
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBackground,
  },
});
