import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { addToCart } from '@/api/cart';
import {
  fetchCombinationInfo,
  findCatalogProduct,
  type CatalogProduct,
  type CombinationInfo,
} from '@/api/catalog';
import { odooUrl } from '@/api/odoo-client';
import { ComingSoonBadge } from '@/components/coming-soon';
import { FormMessage } from '@/components/form-message';
import { setCartQuantity } from '@/state/cart-quantity';
import { Fonts } from '@/theme/fonts';
import { Colors, HomeGradients } from '@/theme/theme';

/*
 * Screen: Product detail (/product/<product.template id>), opened from Home and Shop cards.
 *
 * Real data only:
 * - name, image, seller, rating + count, free-shipping line, chips: the catalog card
 *   (GET /home/catalog/more, found by id — see findCatalogProduct);
 * - price and availability: POST /website_sale/get_combination_info (what the live page calls),
 *   reloaded whenever the screen is shown (cart_qty changes after adding).
 *
 * Availability follows the live page's own script (website_sale + website_sale_stock), in order:
 *   1. prevent_zero_price_sale → price, quantity and Add to Cart hidden; "Not Available For Sale"
 *      and a "Contact Us" button shown.
 *   2. is_combination_possible false → Add to Cart disabled; "This combination does not exist."
 *   3. stocked product that can't be ordered out of stock → max quantity = free_qty − cart_qty;
 *      at 0 the Add to Cart area is hidden and "Out of Stock" (or the seller's own message) shown.
 *
 * Fixed text: "Terms and Conditions", "30-day money-back guarantee", "Shipping: 2-3 Business Days"
 * and "Shipping: Standard delivery" are the same on every product on the live site (template
 * text, not product data), so they are fixed copy here too.
 *
 * GAPS (not built, on purpose): product description — no field for it in either data source;
 * reviewer names/dates/comments — HTML only, so only stars + count are shown (both requested in
 * docs/backend-requests/003-product-reviews-json.md); social share icons — out of scope. Variants/attributes aren't handled (no current product has any).
 */

const COPY = {
  // Confirmed from the live product page.
  reviewsCount: (count: number) => `(${count} Reviews)`,
  notForSale: 'Not Available For Sale',
  combinationImpossible: 'This combination does not exist.',
  addToCart: 'Add to cart',
  contactUs: 'Contact Us',
  terms: 'Terms and Conditions',
  guarantee: '30-day money-back guarantee',
  shippingTime: 'Shipping: 2-3 Business Days',
  shippingLabel: 'Shipping:',
  shippingValue: 'Standard delivery',
  customerReviews: 'Customer Reviews',
  basedOn: (count: number) => `Based on ${count} ratings`,
  seeAll: 'See all',
  viewAllReviews: (count: number) => `VIEW ALL REVIEWS (${count})`,
  // Confirmed from the live stock availability template.
  outOfStock: 'Out of Stock',
  // Confirmed from the live product cards.
  soldBy: 'Sold by: ',
  // PLACEHOLDER COPY (not confirmed anywhere).
  comingSoon: 'Coming soon',
  notFound: 'This product is no longer available.',
  allInCart: 'All available stock is already in your cart.',
  decrease: 'Decrease quantity',
  increase: 'Increase quantity',
};

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'notFound' }
  | { status: 'ready'; catalog: CatalogProduct; info: CombinationInfo };

type Availability =
  | { kind: 'notForSale' }
  | { kind: 'combinationImpossible' }
  | { kind: 'outOfStock'; message: string }
  | { kind: 'available'; maxQuantity: number | null };

/** The live page's rules (see header). */
function availabilityOf(info: CombinationInfo): Availability {
  if (info.preventZeroPriceSale) {
    return { kind: 'notForSale' };
  }
  if (!info.isCombinationPossible) {
    return { kind: 'combinationImpossible' };
  }
  if (info.isStorable && !info.allowOutOfStockOrder) {
    const remaining = Math.max(0, info.freeQty - info.cartQty);
    if (remaining < 1) {
      const message =
        info.freeQty <= 0 && info.cartQty === 0
          ? info.outOfStockMessage || COPY.outOfStock
          : COPY.allInCart;
      return { kind: 'outOfStock', message };
    }
    return { kind: 'available', maxQuantity: remaining };
  }
  return { kind: 'available', maxQuantity: null };
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = Number(id);

  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const scrollRef = useRef<ScrollView>(null);
  // Y position of the Customer Reviews card, for "See all".
  const reviewsY = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const lookup = await findCatalogProduct(templateId);
    if (request !== requestId.current) {
      return;
    }
    if (!lookup.ok) {
      setState({ status: 'error', message: lookup.message });
      return;
    }
    if (!lookup.found) {
      setState({ status: 'notFound' });
      return;
    }
    const combination = await fetchCombinationInfo(templateId, lookup.found.product.variantId);
    if (request !== requestId.current) {
      return;
    }
    setState(
      combination.ok
        ? { status: 'ready', catalog: lookup.found, info: combination.info }
        : { status: 'error', message: combination.message }
    );
  }, [templateId]);

  // Reload on every visit: stock left for this customer depends on what's in their cart.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++;
      };
    }, [load])
  );

  const availability = state.status === 'ready' ? availabilityOf(state.info) : undefined;
  const maxQuantity = availability?.kind === 'available' ? availability.maxQuantity : null;

  // Keep the chosen quantity within the stock limit (like the live quantity input).
  useEffect(() => {
    if (maxQuantity !== null && quantity > maxQuantity) {
      setQuantity(Math.max(1, maxQuantity));
    }
  }, [maxQuantity, quantity]);

  async function handleAddToCart() {
    if (state.status !== 'ready' || adding || availability?.kind !== 'available') {
      return;
    }
    const { product } = state.catalog;
    setAdding(true);
    const result = await addToCart(
      {
        variantId: product.variantId,
        templateId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        sellerName: product.sellerName,
        priceLabel: product.priceLabel,
      },
      quantity
    );
    if (!mounted.current) {
      return;
    }
    setAdding(false);
    if (result.ok) {
      setCartQuantity(result.cartQuantity);
      router.navigate('/cart'); // Same as Home/Shop (and the live site).
    } else {
      Alert.alert(result.message); // PLACEHOLDER UI (see Home).
    }
  }

  // Website pages (no app screens for these yet): open in the browser.
  // TODO(Support / Terms screens): route in-app once those screens exist.
  const openWebsitePage = (path: string) => Linking.openURL(odooUrl(path));

  return (
    <>
      {/* No title until confirmed (product name is shown in the page). */}
      <Stack.Screen options={{ title: '' }} />
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : state.status !== 'ready' ? (
        <View style={[styles.page, styles.content]}>
          <FormMessage
            type="error"
            message={state.status === 'error' ? state.message : COPY.notFound}
          />
        </View>
      ) : (
        <ScrollView ref={scrollRef} style={styles.page} contentContainerStyle={styles.content}>
          <ProductDetails
            onReviewsLayout={(y) => {
              reviewsY.current = y;
            }}
            // Live "See all": scrolls to the Customer Reviews section (the review list itself
            // isn't available yet — backend request 003).
            onSeeAllReviews={() => scrollRef.current?.scrollTo({ y: reviewsY.current, animated: true })}
            catalog={state.catalog}
            info={state.info}
            availability={availability!}
            quantity={quantity}
            maxQuantity={maxQuantity}
            onChangeQuantity={setQuantity}
            adding={adding}
            onAddToCart={handleAddToCart}
            onOpenWebsitePage={openWebsitePage}
          />
        </ScrollView>
      )}
    </>
  );
}

function ProductDetails({
  catalog,
  info,
  availability,
  quantity,
  maxQuantity,
  onChangeQuantity,
  adding,
  onAddToCart,
  onOpenWebsitePage,
  onReviewsLayout,
  onSeeAllReviews,
}: {
  catalog: CatalogProduct;
  info: CombinationInfo;
  availability: Availability;
  quantity: number;
  maxQuantity: number | null;
  onChangeQuantity: (quantity: number) => void;
  adding: boolean;
  onAddToCart: () => void;
  onOpenWebsitePage: (path: string) => void;
  onReviewsLayout: (y: number) => void;
  onSeeAllReviews: () => void;
}) {
  const { product } = catalog;
  const notForSale = availability.kind === 'notForSale';
  const canAdd = availability.kind === 'available' && !adding;

  return (
    <>
      <View style={[styles.card, styles.imageCard]}>
        {catalog.largeImageUrl ? (
          <Image
            source={{ uri: catalog.largeImageUrl }}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel={product.name}
          />
        ) : (
          <SymbolView
            name={{ ios: 'photo', android: 'image', web: 'image' }}
            size={48}
            tintColor={Colors.placeholderIcon}
          />
        )}
      </View>

      <View style={[styles.card, styles.infoCard]}>
        <Text style={styles.name}>{product.name}</Text>

        <View style={styles.ratingRow}>
          <Stars rating={product.rating} size={15} />
          <Text style={styles.ratingValue}>{product.rating.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>{COPY.reviewsCount(product.ratingCount)}</Text>
          <Pressable onPress={onSeeAllReviews} hitSlop={8} accessibilityRole="link">
            <Text style={styles.seeAll}>{COPY.seeAll}</Text>
          </Pressable>
        </View>

        <View style={styles.sellerRow}>
          <SymbolView
            name={{ ios: 'basket', android: 'shopping_basket', web: 'shopping_basket' }}
            size={12}
            tintColor={Colors.helperText}
          />
          <Text style={styles.sellerLabel}>{COPY.soldBy}</Text>
          <Text style={styles.sellerName}>{product.sellerName}</Text>
        </View>

        {!notForSale && (
          <View style={styles.priceRow}>
            <Text style={styles.price}>{catalog.formatPrice(info.price)}</Text>
            {info.hasDiscountedPrice && info.listPrice > info.price && (
              <Text style={styles.listPrice}>{catalog.formatPrice(info.listPrice)}</Text>
            )}
          </View>
        )}

        {product.freeShippingHint && (
          <Text
            style={[
              styles.freeShippingHint,
              product.freeShippingHint.unlocked && styles.freeShippingUnlocked,
            ]}>
            {product.freeShippingHint.text}
          </Text>
        )}
        {(product.chips ?? []).length > 0 && (
          <View style={styles.chipRow}>
            {product.chips!.map((chip) => (
              <Text key={chip} style={styles.chip}>
                {chip}
              </Text>
            ))}
          </View>
        )}

        {/* ---- Availability + purchase ---- */}
        {availability.kind === 'notForSale' && (
          <Text style={styles.unavailable}>{COPY.notForSale}</Text>
        )}
        {availability.kind === 'outOfStock' && (
          <View style={styles.outOfStockRow}>
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={13}
              tintColor={Colors.errorText}
            />
            <Text style={styles.outOfStock}>{availability.message}</Text>
          </View>
        )}
        {availability.kind === 'combinationImpossible' && (
          <View style={styles.combinationWarning}>
            <Text style={styles.combinationWarningText}>{COPY.combinationImpossible}</Text>
          </View>
        )}

        {(availability.kind === 'available' || availability.kind === 'combinationImpossible') && (
          <View style={styles.purchaseRow}>
            <QuantityStepper
              quantity={quantity}
              maxQuantity={maxQuantity}
              disabled={!canAdd}
              onChange={onChangeQuantity}
            />
            <Pressable
              onPress={onAddToCart}
              disabled={!canAdd}
              style={({ pressed }) => [
                styles.addPressable,
                (pressed || adding) && styles.pressed,
                !canAdd && !adding && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAdd, busy: adding }}>
              <LinearGradient
                colors={HomeGradients.orangeButton.colors}
                locations={HomeGradients.orangeButton.locations}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButton}>
                {adding ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.addText}>{COPY.addToCart}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {notForSale && (
          <Pressable
            onPress={() => onOpenWebsitePage('/contactus')}
            style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
            accessibilityRole="link">
            <Text style={styles.contactText}>{COPY.contactUs}</Text>
          </Pressable>
        )}

        {/* ---- Fixed text (identical on every live product page) ---- */}
        <View style={styles.fixedInfo}>
          <Pressable onPress={() => onOpenWebsitePage('/terms')} accessibilityRole="link">
            <Text style={[styles.fixedText, styles.termsLink]}>{COPY.terms}</Text>
          </Pressable>
          <Text style={styles.fixedText}>{COPY.guarantee}</Text>
          <Text style={styles.fixedText}>{COPY.shippingTime}</Text>
        </View>
        <Text style={styles.shippingLine}>
          <Text style={styles.shippingLabel}>{COPY.shippingLabel}</Text> {COPY.shippingValue}
        </Text>
      </View>

      {/* ---- Reviews: summary only (reviewer names/dates/comments aren't available as data) ---- */}
      <View
        style={[styles.card, styles.reviewsCard]}
        onLayout={(event) => onReviewsLayout(event.nativeEvent.layout.y)}>
        <Text style={styles.reviewsTitle}>{COPY.customerReviews}</Text>
        <View style={styles.reviewsSummary}>
          <Text style={styles.reviewsAverage}>{product.rating.toFixed(1)}</Text>
          <View style={styles.reviewsSummaryText}>
            <Stars rating={product.rating} size={16} />
            <Text style={styles.ratingCount}>{COPY.basedOn(product.ratingCount)}</Text>
          </View>
        </View>

        {/* Live: centered outline pill that reveals the review list. Disabled until the list
            exists (backend request 003), marked "Coming soon" like the Shop filters. */}
        {product.ratingCount > 0 && (
          <View style={styles.viewAllWrap}>
            <View
              style={[styles.viewAllButton, styles.disabled]}
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel={`${COPY.viewAllReviews(product.ratingCount)}, ${COPY.comingSoon}`}>
              <Text style={styles.viewAllText}>{COPY.viewAllReviews(product.ratingCount)}</Text>
            </View>
            <ComingSoonBadge />
          </View>
        )}
      </View>
    </>
  );
}

/** Live star rule: floor(avg) full stars, then a half star if there's a remainder. */
function Stars({ rating, size }: { rating: number; size: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 > 0;
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }, (_, index) => (
        <SymbolView
          key={index}
          name={
            index < full
              ? { ios: 'star.fill', android: 'star', web: 'star' }
              : index === full && half
                ? { ios: 'star.leadinghalf.filled', android: 'star_half', web: 'star_half' }
                : { ios: 'star', android: 'star_border', web: 'star_border' }
          }
          size={size}
          tintColor={Colors.ratingStar}
        />
      ))}
    </View>
  );
}

function QuantityStepper({
  quantity,
  maxQuantity,
  disabled,
  onChange,
}: {
  quantity: number;
  maxQuantity: number | null;
  disabled: boolean;
  onChange: (quantity: number) => void;
}) {
  const canDecrease = !disabled && quantity > 1;
  const canIncrease = !disabled && (maxQuantity === null || quantity < maxQuantity);
  return (
    <View style={[styles.stepper, disabled && styles.disabled]}>
      <Pressable
        onPress={() => onChange(quantity - 1)}
        disabled={!canDecrease}
        hitSlop={6}
        style={[styles.stepperButton, !canDecrease && styles.stepperButtonOff]}
        accessibilityRole="button"
        accessibilityLabel={COPY.decrease}
        accessibilityState={{ disabled: !canDecrease }}>
        <SymbolView
          name={{ ios: 'minus', android: 'remove', web: 'remove' }}
          size={14}
          tintColor={Colors.dark}
        />
      </Pressable>
      <Text style={styles.stepperValue}>{quantity}</Text>
      <Pressable
        onPress={() => onChange(quantity + 1)}
        disabled={!canIncrease}
        hitSlop={6}
        style={[styles.stepperButton, !canIncrease && styles.stepperButtonOff]}
        accessibilityRole="button"
        accessibilityLabel={COPY.increase}
        accessibilityState={{ disabled: !canIncrease }}>
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' }}
          size={14}
          tintColor={Colors.dark}
        />
      </Pressable>
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
    paddingBottom: 40,
    gap: 14,
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
  imageCard: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoCard: {
    padding: 16,
  },
  name: {
    fontFamily: Fonts.primary,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    color: Colors.sectionHeading,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  ratingValue: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ratingValue,
  },
  ratingCount: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.helperText,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  sellerLabel: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.helperText,
  },
  sellerName: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 14,
  },
  price: {
    fontFamily: Fonts.primary,
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primaryOrange,
  },
  listPrice: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.helperText,
    textDecorationLine: 'line-through',
  },
  freeShippingHint: {
    marginTop: 8,
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryOrange,
  },
  freeShippingUnlocked: {
    color: Colors.verifiedText,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(242,170,100,0.3)',
    backgroundColor: 'rgb(255,240,221)',
    paddingVertical: 3,
    paddingHorizontal: 9,
    overflow: 'hidden',
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.chipText,
  },
  unavailable: {
    marginTop: 14,
    fontFamily: Fonts.primary,
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '600',
    color: Colors.dark,
  },
  outOfStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  outOfStock: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.errorText,
  },
  combinationWarning: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    padding: 10,
  },
  combinationWarningText: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.dark,
  },
  purchaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
  },
  stepperButton: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonOff: {
    opacity: 0.35,
  },
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark,
  },
  addPressable: {
    flex: 1,
  },
  addButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  contactButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  fixedInfo: {
    marginTop: 18,
    gap: 2,
  },
  fixedText: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.mutedText,
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
  shippingLine: {
    marginTop: 10,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.policyText,
  },
  shippingLabel: {
    fontWeight: '700',
    color: Colors.dark,
  },
  seeAll: {
    marginStart: 4,
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.reviewLink,
    textDecorationLine: 'underline',
  },
  viewAllWrap: {
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  viewAllButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.dark,
    paddingVertical: 8,
    paddingHorizontal: 40,
  },
  viewAllText: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark,
  },
  reviewsCard: {
    padding: 16,
  },
  reviewsTitle: {
    fontFamily: Fonts.primary,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.sectionHeading,
  },
  reviewsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  reviewsAverage: {
    fontFamily: Fonts.primary,
    fontSize: 36,
    fontWeight: '800',
    color: Colors.dark,
  },
  reviewsSummaryText: {
    gap: 4,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
