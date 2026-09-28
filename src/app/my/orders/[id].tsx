import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchOrder, type OrderDetail, type OrderLine, type OrderReturn } from '@/api/orders';
import { FormMessage } from '@/components/form-message';
import { ORDER_COPY, SampleDataBanner, StatusBadge } from '@/components/order-parts';
import { PlaceholderModal } from '@/components/placeholder-modal';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Order detail — the live /my/orders/<id> page (opened from My Orders).
 *
 * ⚠️ BLOCKED ON BACKEND — RUNS ON TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * There's no JSON route for an order's detail (the live page is HTML only). fetchOrder returns
 * sample data (src/api/mocks/orders.mock.ts) until docs/backend-requests/005-orders-json.md is
 * built; the "sample data" banner stays pinned at the top while scrolling. When the route ships,
 * only src/api/orders.ts changes.
 *
 * The live page's sections, in one column: header (order number + status), the "payment
 * successfully processed" banner, Sale Information, Invoicing and Shipping Address, Last Delivery
 * Orders (status badge, tracking when there is one, Return only when returnable), Products (one
 * block per line), totals, Terms & Conditions, Payment terms, Communication history, and
 * "Return / Reschedule Items".
 *
 * Payment banner: shown ONLY when the order's payment status says paid. On staging the page shows
 * it next to a "Waiting Payment" invoice (#005, bug 2), so it's never shown unconditionally.
 *
 * Terms & Conditions opens the live terms page in an in-app WebView (src/app/terms.tsx).
 * Not functional yet (no JSON route): Send only logs; Return opens a placeholder popup.
 * "Return / Reschedule Items" opens the return form (src/app/my/orders/[id]/return.tsx; its submit
 * is disabled until #006). When the order already has return requests, a "Previous Return
 * Requests for This Order" list replaces that button; a row opens the return detail screen
 * (src/app/my/returns/[id].tsx).
 */

const COPY = {
  // Confirmed from the live /my/orders/<id> page.
  title: (name: string) => `Sales Order - ${name}`,
  thankYou: 'Thank you!',
  paymentProcessed: 'Your payment has been successfully processed.',
  saleInformation: 'Sale Information',
  orderDate: 'Order Date:',
  address: 'Invoicing and Shipping Address',
  lastDeliveries: 'Last Delivery Orders',
  date: 'Date:',
  returnLink: 'RETURN',
  products: 'Products',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
  taxes: 'Taxes',
  amount: 'Amount',
  untaxed: 'Untaxed Amount',
  total: 'Total',
  terms: 'Terms & Conditions',
  paymentTerms: 'Payment terms:',
  communication: 'Communication history',
  returnReschedule: 'Return / Reschedule Items',
  // Confirmed from the live /my/orders/<id>/return page (its table heading and column).
  previousReturns: 'Previous Return Requests for This Order',
  pickupDate: 'Pickup Date:',
  itemsQty: 'Items Qty:',
  // COPY FROM THE USER (2026-09-26) — the live chatter loads by script, not seen yet.
  conversationEmpty: 'The conversation is empty.',
  messagePlaceholder: 'Write a message...',
  send: 'Send',
  // PLACEHOLDER COPY (not confirmed anywhere).
  sku: 'SKU:',
  trackingNumber: 'Tracking number:',
  notFound: 'This order could not be found.',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; order: OrderDetail | null; isSampleData: boolean };

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [popup, setPopup] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const result = await fetchOrder(Number(id));
    if (request !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', order: result.order, isSampleData: result.isSampleData }
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

  const order = state.status === 'ready' ? state.order : null;

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: order ? order.name : '' }} />
      {/* Pinned above the scrolling content, so it's visible the whole time. */}
      {state.status === 'ready' && state.isSampleData && (
        <View style={styles.bannerBar}>
          <SampleDataBanner message={ORDER_COPY.sampleDetailBanner} />
        </View>
      )}
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : order === null ? (
            <FormMessage type="error" message={COPY.notFound} />
          ) : (
            <OrderBody order={order} onReturn={() => setPopup(ORDER_COPY.returnTitle)} />
          )}
        </ScrollView>
      )}
      <PlaceholderModal title={popup} detail={order?.name} onClose={() => setPopup(null)} />
    </View>
  );
}

function OrderBody({ order, onReturn }: { order: OrderDetail; onReturn: () => void }) {
  const [message, setMessage] = useState('');

  return (
    <View style={styles.sections}>
      {/* ---- Header ---- */}
      <View style={[styles.card, styles.headerRow]}>
        <Text style={styles.title}>{COPY.title(order.name)}</Text>
        <StatusBadge status={order.status} />
      </View>

      {/* ---- Payment banner: only when the backend says paid ---- */}
      {order.paymentStatus.code === 'paid' && (
        <View style={styles.paidBanner} accessibilityRole="alert">
          <SymbolView
            name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
            size={20}
            tintColor={Colors.successText}
          />
          <View style={styles.paidText}>
            <Text style={styles.paidTitle}>{COPY.thankYou}</Text>
            <Text style={styles.paidBody}>{COPY.paymentProcessed}</Text>
          </View>
        </View>
      )}

      {/* ---- Sale Information ---- */}
      <Section title={COPY.saleInformation}>
        <LabelValue label={COPY.orderDate} value={order.dateFormatted} />
      </Section>

      {/* ---- Invoicing and Shipping Address ---- */}
      <Section title={COPY.address}>
        <Text style={styles.strong}>{order.contact.name}</Text>
        {order.contact.addressLines.map((line) => (
          <Text key={line} style={styles.value}>
            {line}
          </Text>
        ))}
        {order.contact.phone !== '' && <ContactRow icon="phone" value={order.contact.phone} />}
        {order.contact.email !== '' && <ContactRow icon="email" value={order.contact.email} />}
      </Section>

      {/* ---- Last Delivery Orders (none until the order ships) ---- */}
      {order.deliveries.length > 0 && (
        <Section title={COPY.lastDeliveries}>
          {order.deliveries.map((delivery) => (
            <View key={delivery.id} style={styles.delivery}>
              <View style={styles.deliveryTop}>
                <Text style={styles.strong}>{delivery.name}</Text>
                <StatusBadge status={delivery.status} />
              </View>
              <LabelValue label={COPY.date} value={delivery.dateFormatted} />
              {delivery.tracking !== null && (
                <LabelValue
                  label={COPY.trackingNumber}
                  value={`${delivery.tracking.number} (${delivery.tracking.carrier})`}
                />
              )}
              {order.returnAvailable && (
                <Pressable
                  onPress={onReturn}
                  hitSlop={8}
                  accessibilityRole="link"
                  style={styles.inlineLink}>
                  <Text style={styles.link}>{COPY.returnLink}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </Section>
      )}

      {/* ---- Products + totals ---- */}
      <Section title={COPY.products}>
        {order.lines.map((line) => (
          <ProductLine key={line.id} line={line} />
        ))}
        <View style={styles.totals}>
          <AmountRow label={COPY.untaxed} value={order.totals.untaxedFormatted} />
          {order.totals.taxGroups.map((group) => (
            <AmountRow key={group.label} label={group.label} value={group.amountFormatted} />
          ))}
          <View style={styles.divider} />
          <AmountRow label={COPY.total} value={order.totals.totalFormatted} emphasized />
        </View>
      </Section>

      {/* ---- Terms & Conditions + Payment terms ---- */}
      <View style={styles.card}>
        {order.termsUrl !== null && (
          // Opens the live terms page in-app (src/app/terms.tsx).
          <Pressable
            onPress={() => router.push('/terms')}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.inlineLink}>
            <Text style={styles.link}>{COPY.terms}</Text>
          </Pressable>
        )}
        {order.paymentTermsLabel !== null && (
          <LabelValue label={COPY.paymentTerms} value={order.paymentTermsLabel} />
        )}
      </View>

      {/* ---- Communication history ---- */}
      <Section title={COPY.communication}>
        <Text style={styles.emptyConversation}>{COPY.conversationEmpty}</Text>
        <View style={styles.composer}>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder={COPY.messagePlaceholder}
            placeholderTextColor={Colors.placeholderIcon}
            multiline
          />
          {/* PLACEHOLDER: no JSON route for portal messages yet — only logs. */}
          <Pressable
            onPress={() => console.log('Send pressed', { order: order.name, message })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
            <Text style={styles.sendText}>{COPY.send}</Text>
          </Pressable>
        </View>
      </Section>

      {order.returns.length > 0 ? (
        /* ---- Existing return requests (replaces the button when the order has any) ---- */
        <Section title={COPY.previousReturns}>
          {order.returns.map((orderReturn) => (
            <ReturnRow key={orderReturn.id} orderReturn={orderReturn} />
          ))}
        </Section>
      ) : (
        /* ---- Return / Reschedule Items → return form (live: btn-primary, reply icon) ---- */
        <Pressable
          onPress={() =>
            router.push({ pathname: '/my/orders/[id]/return', params: { id: String(order.id) } })
          }
          accessibilityRole="button"
          style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'arrowshape.turn.up.left', android: 'reply', web: 'reply' }}
            size={16}
            tintColor={Colors.white}
          />
          <Text style={styles.returnButtonText}>{COPY.returnReschedule}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * One return request: Return #, Pickup Date, Items Qty and the decision badge (green). Like the
 * live table, the progress badge (grey, e.g. "Received & Verified") isn't shown here.
 */
function ReturnRow({ orderReturn }: { orderReturn: OrderReturn }) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/my/returns/[id]', params: { id: String(orderReturn.id) } })
      }
      accessibilityRole="button"
      accessibilityLabel={[
        orderReturn.name,
        `${COPY.pickupDate} ${orderReturn.pickupDateFormatted}`,
        `${COPY.itemsQty} ${orderReturn.itemsQtyFormatted}`,
        orderReturn.decision?.label,
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [styles.returnRow, pressed && styles.pressed]}>
      <View style={styles.returnInfo}>
        <Text style={styles.returnName}>{orderReturn.name}</Text>
        <LabelValue label={COPY.pickupDate} value={orderReturn.pickupDateFormatted} />
        <LabelValue label={COPY.itemsQty} value={orderReturn.itemsQtyFormatted} />
      </View>
      <View style={styles.returnBadges}>
        {orderReturn.decision && (
          <View style={[styles.returnBadge, styles.decisionBadge]}>
            <Text style={[styles.returnBadgeText, styles.decisionBadgeText]}>
              {orderReturn.decision.label}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
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

function ProductLine({ line }: { line: OrderLine }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.strong, line.isDelivery && styles.deliveryName]}>{line.name}</Text>
      {line.sku !== null && <LabelValue label={COPY.sku} value={line.sku} />}
      <LabelValue label={COPY.quantity} value={line.quantityFormatted} />
      <LabelValue label={COPY.unitPrice} value={line.priceUnitFormatted} />
      <LabelValue label={COPY.taxes} value={line.taxesLabel} />
      <AmountRow label={COPY.amount} value={line.amountFormatted} />
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

function ContactRow({ icon, value }: { icon: 'phone' | 'email'; value: string }) {
  return (
    <View style={styles.contactRow}>
      <SymbolView
        name={
          icon === 'phone'
            ? { ios: 'phone', android: 'call', web: 'call' }
            : { ios: 'envelope', android: 'mail', web: 'mail' }
        }
        size={14}
        tintColor={Colors.helperText}
      />
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function AmountRow({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.amountRow}>
      <Text style={[styles.label, emphasized && styles.totalLabel]}>{label}</Text>
      <Text style={[styles.amountValue, emphasized && styles.totalValue]}>{value}</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 20,
    color: Colors.sectionHeading,
  },
  // PENDING CONFIRMATION: uses the app's success colors (see theme.ts).
  paidBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    backgroundColor: Colors.successBackground,
    padding: 14,
  },
  paidText: {
    flex: 1,
    gap: 2,
  },
  paidTitle: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.successText,
  },
  paidBody: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.successText,
  },
  sectionTitle: {
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.sectionHeading,
    marginBottom: 4,
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
  strong: {
    flexShrink: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.sectionHeading,
  },
  deliveryName: {
    color: Colors.mutedText,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  delivery: {
    gap: 4,
  },
  deliveryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inlineLink: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  link: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  line: {
    gap: 3,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inputBorder,
  },
  totals: {
    paddingTop: 10,
    gap: 6,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  amountValue: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.inputBorder,
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 17,
    fontFamily: Fonts.primaryBold,
    color: Colors.dark,
  },
  totalValue: {
    fontSize: 18,
    fontFamily: Fonts.primaryBold,
    color: Colors.primaryOrange,
  },
  emptyConversation: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.mutedText,
    marginBottom: 6,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.dark,
  },
  sendButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryOrange,
  },
  sendText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.white,
  },
  // Same disabled + "Coming soon" treatment as Shop's unfinished filters.
  returnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
  },
  returnInfo: {
    flex: 1,
    gap: 2,
  },
  // Same link style as the order number on My Orders.
  returnName: {
    alignSelf: 'flex-start',
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  returnBadges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  returnBadge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  returnBadgeText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
  },
  // PLACEHOLDER COLORS: live uses Bootstrap bg-success (green), whose theme color isn't in the
  // page source; this reuses the app's existing success tokens.
  decisionBadge: {
    backgroundColor: Colors.successBackground,
  },
  decisionBadgeText: {
    color: Colors.successText,
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
  },
  returnButtonText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
