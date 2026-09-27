import { StyleSheet, Text, View } from 'react-native';

import type { InvoiceStatus } from '@/api/invoices';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * The invoice status pill (live: Bootstrap badges — "Waiting for Payment" text-bg-info,
 * "Paid" text-bg-success). PLACEHOLDER COLORS: the Bootstrap theme colors aren't in the page
 * source, so these reuse existing app tokens (same approach as the order status badge).
 */
const COLORS: Record<string, { background: string; text: string }> = {
  waiting_for_payment: { background: Colors.inputBorder, text: Colors.mutedText },
  processing_payment: { background: Colors.activeRowBackground, text: Colors.loadMoreText },
  paid: { background: Colors.successBackground, text: Colors.successText },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const colors = COLORS[status.code] ?? COLORS.waiting_for_payment;
  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.text }]}>{status.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  text: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
