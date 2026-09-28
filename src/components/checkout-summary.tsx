import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CartSellerGroup, CartSummary } from '@/api/cart';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * The checkout "Order summary" card (the live /shop/checkout and /shop/payment sidebar), shared by
 * the Delivery and Payment steps: item count, Subtotal / Delivery / Taxes / Total, the discount
 * code field, and Seller-wise Delivery. All amounts are the cart's (backend-formatted) values.
 * The discount code isn't applied yet: "Apply" only logs.
 */

const COPY = {
  // Confirmed from staging's /shop/checkout page.
  orderSummary: 'Order summary',
  itemCount: (count: number, total: string) => `${count} item(s) - ${total}`,
  delivery: 'Delivery',
  subtotal: 'Subtotal',
  taxes: 'Taxes',
  total: 'Total',
  apply: 'Apply',
  sellerWiseDelivery: 'Seller-wise Delivery',
  freeDelivery: 'You got FREE delivery.',
  free: 'FREE',
  // COPY FROM THE USER (2026-09-26).
  discountPlaceholder: 'Gift card or discount code',
};

export function CheckoutSummary({ cart }: { cart: CartSummary }) {
  const [discountCode, setDiscountCode] = useState('');
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

      <View style={styles.discountRow}>
        <TextInput
          style={styles.discountInput}
          value={discountCode}
          onChangeText={setDiscountCode}
          placeholder={COPY.discountPlaceholder}
          placeholderTextColor={Colors.placeholderIcon}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {/* PLACEHOLDER: codes aren't applied yet — only logs. */}
        <Pressable
          onPress={() => console.log('Apply code pressed', discountCode)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}>
          <Text style={styles.applyText}>{COPY.apply}</Text>
        </Pressable>
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
        {isFree ? COPY.free : delivery.amountFormatted}
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
  discountRow: {
    flexDirection: 'row',
    gap: 8,
  },
  discountInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 12,
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.dark,
  },
  applyButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryOrange,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
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
  pressed: {
    opacity: 0.85,
  },
});
