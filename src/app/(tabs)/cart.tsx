import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  fetchCartSummary,
  setCartLineQuantity,
  type CartLine,
  type CartSellerGroup,
  type CartSummary,
} from '@/api/cart';
import { FormMessage } from '@/components/form-message';
import { setCartQuantity } from '@/state/cart-quantity';
import { Fonts } from '@/theme/fonts';
import { Colors, HomeGradients } from '@/theme/theme';

/*
 * Screen: Cart.
 *
 * ⚠️ BLOCKED ON BACKEND — RUNS ON A TEMPORARY MOCK CART, NOT READY TO GO LIVE ⚠️
 * TODO: replace with the real cart-contents route response once the backend endpoint exists
 * (docs/backend-requests/001-cart-summary-json.md). Until then fetchCartSummary /
 * setCartLineQuantity work on an in-memory mock cart (src/api/mocks/cart-summary.mock.ts) that
 * "Add to Cart" fills, and this screen shows a visible "sample data" banner. When the route
 * ships, only src/api/cart.ts changes; this screen already renders the requested shape.
 *
 * LAYOUT NOT CONFIRMED against the Screen List doc. Confirmed from the live /shop/cart page:
 * the "Order overview" heading and the "Your cart is empty!" message. Every other label is
 * placeholder copy (see COPY). Lines are grouped per seller with each seller's own delivery, as
 * the marketplace requires; all amounts are the backend's formatted strings (nothing calculated
 * here). "Checkout" opens src/app/checkout (Address & Delivery). Not built yet: line tap → product.
 */

const COPY = {
  // Confirmed from the live /shop/cart page.
  heading: 'Order overview',
  empty: 'Your cart is empty!',
  // Confirmed from the live product cards.
  soldBy: 'Sold by: ',
  // PLACEHOLDER COPY (standard Odoo cart wording, not confirmed on yallashuq.com).
  subtotal: 'Subtotal',
  delivery: 'Delivery',
  taxes: 'Taxes',
  discount: 'Discount',
  total: 'Total',
  checkout: 'Checkout',
  // PLACEHOLDER COPY (not confirmed anywhere).
  free: 'Free',
  deliveryNotCalculated: 'Calculated at checkout',
  remove: 'Remove',
  decrease: 'Decrease quantity',
  increase: 'Increase quantity',
  freeDeliveryHint: (remaining: string) => `Add ${remaining} more for free delivery`,
  sampleDataBanner:
    'Sample data — the cart endpoint is not ready yet. This is not your real cart (it resets when the app reloads).',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; cart: CartSummary; isSampleData: boolean };

export default function CartScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Line whose quantity is being changed (one change at a time).
  const [busyLineId, setBusyLineId] = useState<number | null>(null);
  // Error from a quantity change (the cart itself stays as it was).
  const [errorMessage, setErrorMessage] = useState<string>();
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchCartSummary();
    if (id !== requestId.current) {
      return; // A newer load started (or the tab was left); ignore this one.
    }
    if (!result.ok) {
      setState({ status: 'error', message: result.message });
      return;
    }
    // While the mock is in use this is the mock's count, so the badge matches this screen.
    setCartQuantity(result.cart.cartQuantity);
    setState({ status: 'ready', cart: result.cart, isSampleData: result.isSampleData });
  }, []);

  // Reload whenever the tab is shown (e.g. right after "Add to Cart" navigates here).
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++; // Leaving the tab cancels a pending load.
      };
    }, [load])
  );

  async function changeQuantity(line: CartLine, quantity: number) {
    if (busyLineId !== null) {
      return;
    }
    setBusyLineId(line.lineId);
    setErrorMessage(undefined);
    const result = await setCartLineQuantity(line, quantity);
    if (result.ok) {
      await load();
    } else {
      setErrorMessage(result.message);
    }
    setBusyLineId(null);
  }

  if (state.status === 'loading') {
    return (
      <View style={[styles.page, styles.centered]}>
        <ActivityIndicator color={Colors.primaryOrange} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {state.status === 'ready' && state.isSampleData && (
        <View style={styles.sampleBanner} accessibilityRole="alert">
          <Text style={styles.sampleBannerText}>{COPY.sampleDataBanner}</Text>
        </View>
      )}

      <Text style={styles.heading}>{COPY.heading}</Text>

      {state.status === 'error' ? (
        <FormMessage type="error" message={state.message} />
      ) : state.cart.sellerGroups.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{COPY.empty}</Text>
        </View>
      ) : (
        <>
          {state.cart.warnings.map((warning) => (
            <FormMessage key={warning} type="error" message={warning} />
          ))}
          <FormMessage type="error" message={errorMessage} />
          <View style={styles.groups}>
            {state.cart.sellerGroups.map((group) => (
              <SellerGroupCard
                key={group.seller.id}
                group={group}
                busyLineId={busyLineId}
                onChangeQuantity={changeQuantity}
              />
            ))}
          </View>
          <Summary cart={state.cart} />
        </>
      )}
    </ScrollView>
  );
}

type QuantityProps = {
  busyLineId: number | null;
  onChangeQuantity: (line: CartLine, quantity: number) => void;
};

function SellerGroupCard({ group, ...quantityProps }: { group: CartSellerGroup } & QuantityProps) {
  const { delivery } = group;
  const deliveryValue = !delivery.calculated
    ? COPY.deliveryNotCalculated
    : delivery.isFree
      ? COPY.free
      : delivery.amountFormatted;
  const showFreeHint =
    delivery.calculated && !delivery.isFree && delivery.remainingForFreeFormatted !== null;

  return (
    <View style={styles.card}>
      <View style={styles.sellerRow}>
        <SymbolView
          name={{ ios: 'basket', android: 'shopping_basket', web: 'shopping_basket' }}
          size={12}
          tintColor={Colors.helperText}
        />
        <Text style={styles.sellerLabel}>{COPY.soldBy}</Text>
        <Text style={styles.sellerName} numberOfLines={1}>
          {group.seller.name}
        </Text>
      </View>

      {group.lines.map((line) => (
        <LineRow key={line.lineId} line={line} {...quantityProps} />
      ))}

      <View style={styles.groupFooter}>
        <AmountRow label={COPY.subtotal} value={group.subtotalFormatted} />
        <AmountRow label={COPY.delivery} value={deliveryValue} />
        {showFreeHint && (
          <Text style={styles.freeHint}>
            {COPY.freeDeliveryHint(delivery.remainingForFreeFormatted!)}
          </Text>
        )}
      </View>
    </View>
  );
}

function LineRow({ line, busyLineId, onChangeQuantity }: { line: CartLine } & QuantityProps) {
  const busy = busyLineId === line.lineId;
  const locked = busyLineId !== null; // One change at a time across the whole cart.
  const atMax = line.maxQuantity !== null && line.quantity >= line.maxQuantity;
  return (
    <View style={styles.line}>
      <View style={styles.lineImage}>
        {line.imageUrl ? (
          <Image source={{ uri: line.imageUrl }} style={styles.lineImageFill} contentFit="contain" />
        ) : (
          <SymbolView
            name={{ ios: 'photo', android: 'image', web: 'image' }}
            size={22}
            tintColor={Colors.placeholderIcon}
          />
        )}
      </View>
      <View style={styles.lineInfo}>
        <Text style={styles.lineName} numberOfLines={2}>
          {line.name}
        </Text>
        {line.variantDescription !== '' && (
          <Text style={styles.lineMuted} numberOfLines={1}>
            {line.variantDescription}
          </Text>
        )}
        <Text style={styles.lineMuted}>{line.priceUnitFormatted}</Text>
        {line.warning !== '' && <Text style={styles.lineWarning}>{line.warning}</Text>}

        <View style={styles.quantityRow}>
          <View style={styles.stepper}>
            {/* At 1, "−" is disabled; removing is the trash button's job. */}
            <StepperButton
              icon="minus"
              label={COPY.decrease}
              disabled={locked || line.quantity <= 1}
              onPress={() => onChangeQuantity(line, line.quantity - 1)}
            />
            <View style={styles.stepperValue}>
              {busy ? (
                <ActivityIndicator size="small" color={Colors.primaryOrange} />
              ) : (
                <Text style={styles.stepperText}>{line.quantity}</Text>
              )}
            </View>
            <StepperButton
              icon="plus"
              label={COPY.increase}
              disabled={locked || atMax}
              onPress={() => onChangeQuantity(line, line.quantity + 1)}
            />
          </View>
          <Pressable
            onPress={() => onChangeQuantity(line, 0)}
            disabled={locked}
            hitSlop={8}
            style={[styles.removeButton, locked && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={COPY.remove}
            accessibilityState={{ disabled: locked }}>
            <SymbolView
              name={{ ios: 'trash', android: 'delete', web: 'delete' }}
              size={16}
              tintColor={Colors.helperText}
            />
          </Pressable>
        </View>
      </View>
      <Text style={styles.lineTotal}>{line.priceTotalFormatted}</Text>
    </View>
  );
}

function StepperButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[styles.stepperButton, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}>
      <SymbolView
        name={
          icon === 'minus'
            ? { ios: 'minus', android: 'remove', web: 'remove' }
            : { ios: 'plus', android: 'add', web: 'add' }
        }
        size={14}
        tintColor={Colors.dark}
      />
    </Pressable>
  );
}

function Summary({ cart }: { cart: CartSummary }) {
  const { totals } = cart;
  return (
    <View style={[styles.card, styles.summary]}>
      <AmountRow label={COPY.subtotal} value={totals.subtotalFormatted} />
      <AmountRow label={COPY.delivery} value={totals.deliveryFormatted} />
      <AmountRow label={COPY.taxes} value={totals.taxFormatted} />
      {totals.discountFormatted !== null && (
        <AmountRow label={COPY.discount} value={totals.discountFormatted} />
      )}
      <View style={styles.divider} />
      <AmountRow label={COPY.total} value={totals.totalFormatted} emphasized />

      {/* Checkout step 1 (Address & Delivery); Payment comes next. One checkout and one payment
          for the whole cart, even with several sellers. */}
      <Pressable
        onPress={() => router.push('/checkout')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.checkoutPressable, pressed && styles.pressed]}>
        <LinearGradient
          colors={HomeGradients.orangeButton.colors}
          locations={HomeGradients.orangeButton.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.checkoutButton}>
          <Text style={styles.checkoutText}>{COPY.checkout}</Text>
        </LinearGradient>
      </Pressable>
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
    // Clears the floating MishMesh launcher (56px + 16px offset) at the end of the page.
    paddingBottom: 88,
  },
  sampleBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  sampleBannerText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.dark,
  },
  heading: {
    fontFamily: Fonts.primaryBold,
    fontSize: 26,
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
    fontFamily: Fonts.primarySemiBold,
    fontSize: 15,
    color: Colors.mutedText,
  },
  groups: {
    gap: 14,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inputBorder,
  },
  sellerLabel: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 12,
    color: Colors.helperText,
  },
  sellerName: {
    flexShrink: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.dark,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inputBorder,
  },
  lineImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineImageFill: {
    width: '100%',
    height: '100%',
  },
  lineInfo: {
    flex: 1,
    gap: 3,
  },
  lineName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.sectionHeading,
  },
  lineMuted: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    color: Colors.helperText,
  },
  lineWarning: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    color: Colors.errorText,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
  },
  stepperButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 32,
    alignItems: 'center',
  },
  stepperText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  lineTotal: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.primaryOrange,
  },
  groupFooter: {
    paddingTop: 10,
    gap: 6,
  },
  freeHint: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 12,
    color: Colors.primaryOrange,
  },
  summary: {
    marginTop: 14,
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
  checkoutPressable: {
    marginTop: 10,
  },
  checkoutButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
