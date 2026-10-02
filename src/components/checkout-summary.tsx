import { StyleSheet, Text, View } from 'react-native';

import type { CartSellerGroup, CartSummary } from '@/api/cart';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * The checkout "Order summary" card (the live /shop/checkout and /shop/payment sidebar), shared by
 * the Delivery and Payment steps: item count, Subtotal / Delivery / Taxes / Total, and
 * Seller-wise Delivery. All amounts are the cart's (backend-formatted) values.
 *
 * REMOVED 2026-10-02 (session 6, tracker #2): the discount-code input field. It never applied a
 * real code ("Apply" only logged) and, per Basem, was never the real mechanism to begin with —
 * discounts here work through an admin-set %-off-products campaign and gift cards, not a
 * customer-entered coupon. Removed rather than left as a dead/misleading control.
 */

const COPY = {
  // Confirmed from staging's /shop/checkout page.
  orderSummary: 'Order summary',
  itemCount: (count: number, total: string) => `${count} item(s) - ${total}`,
  delivery: 'Delivery',
  subtotal: 'Subtotal',
  taxes: 'Taxes',
  total: 'Total',
  sellerWiseDelivery: 'Seller-wise Delivery',
  freeDelivery: 'You got FREE delivery.',
  free: 'FREE',
  // Fixed 2026-10-02 (session 3, tracker #1): shown when a seller group's delivery charge isn't
  // calculated yet (e.g. no delivery method chosen yet — see cart.ts's header comment) rather
  // than leaving the row blank.
  notCalculated: 'Calculated at delivery',
};

export function CheckoutSummary({ cart }: { cart: CartSummary }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{COPY.orderSummary}</Text>
      <Text style={styles.muted}>{COPY.itemCount(cart.cartQuantity, cart.totals.totalFormatted)}</Text>

      <View style={styles.amounts}>
        <AmountRow label={COPY.subtotal} value={cart.totals.subtotalFormatted} />
        <AmountRow label={COPY.delivery} value={cart.totals.deliveryFormatted} />
        <AmountRow label={COPY.taxes} value={cart.totals.taxFormatted} />
        <View style={styles.divider} />
        <AmountRow label={COPY.total} value={cart.totals.totalFormatted} emphasized />
      </View>

      <View style={styles.sellerBox}>
        <Text style={styles.sellerBoxTitle}>{COPY.sellerWiseDelivery}</Text>
        {cart.sellerGroups.map((group) => (
          <SellerDelivery key={group.seller.id} group={group} />
        ))}
      </View>
    </View>
  );
}

function SellerDelivery({ group }: { group: CartSellerGroup }) {
  const { delivery } = group;
  const isFree = delivery.calculated && delivery.isFree;
  return (
    <View style={styles.sellerRow}>
      <View style={styles.sellerInfo}>
        <Text style={styles.sellerName}>{group.seller.name}</Text>
        {isFree && <Text style={styles.freeNote}>{COPY.freeDelivery}</Text>}
      </View>
      <Text style={[styles.sellerCharge, isFree && styles.freeCharge]}>
        {isFree ? COPY.free : delivery.calculated ? delivery.amountFormatted : COPY.notCalculated}
      </Text>
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
      <Text style={[styles.amountLabel, emphasized && styles.totalLabel]}>{label}</Text>
      <Text style={[styles.amountValue, emphasized && styles.totalValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  sectionTitle: {
    fontFamily: Fonts.primaryBold,
    fontSize: 17,
    color: Colors.sectionHeading,
  },
  muted: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.mutedText,
  },
  amounts: {
    gap: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  amountLabel: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.mutedText,
  },
  amountValue: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.inputBorder,
    marginVertical: 2,
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
  sellerBox: {
    borderRadius: 14,
    backgroundColor: Colors.phoneCountryBackground,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
    padding: 12,
    gap: 10,
  },
  sellerBoxTitle: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sellerInfo: {
    flex: 1,
    gap: 2,
  },
  sellerName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  freeNote: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    color: Colors.verifiedText,
  },
  sellerCharge: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  freeCharge: {
    color: Colors.verifiedText,
  },
});
