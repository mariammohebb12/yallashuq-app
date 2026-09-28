import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/**
 * Product card, grid and horizontal row.
 *
 * Layout (client requests 2026-09-28, app-only design — the live `.sm-product` card is taller,
 * with a full-width "Add to Cart" button): a clean white card, structure inspired by noon but in
 * YallaShuq's own colors and fonts. Full-width image with the section badge (top-start) and a
 * small wishlist heart (top-end, visual only); below, packed tight: the name (2 lines max), the
 * rating row (only when the product has reviews), the price (with the struck-through original
 * price and a green "-N%" when discounted), a muted one-line "Sold by", and a footer with the
 * one-line free-shipping pill and the round "+" add-to-cart button (bottom-end, inside the card).
 *
 * Display only: prices, discount and rating are shown exactly as the backend gives them; nothing
 * is calculated here. Not shown on this card: the small chips (still in `ProductSummary`).
 */

export type ProductSummary = {
  /** product.template id — identifies the product (live URLs: /shop/<slug>-<id>). */
  id: number;
  /** product.product id — what the cart takes (the live form's hidden `product_id`). */
  variantId: number;
  name: string;
  sellerName: string;
  /** Price as the backend formats it, e.g. "₪2000.00". */
  priceLabel: string;
  /** Crossed-out price shown next to `priceLabel` when discounted. */
  originalPriceLabel?: string;
  /** Percent off, as the backend gives it (`discount_pct`), shown as "-N%" when discounted. */
  discountPct?: number;
  /** Average rating 0–5 and number of reviews (the rating row is hidden at 0 reviews). */
  rating: number;
  ratingCount: number;
  /** Badge on the image: the section's real tag, e.g. "Hot Sale" / "Top Deal". */
  tag?: string;
  imageUrl?: string;
  /** Small chips (live: "Free Shipping", "Warranty", warranty tags; not shown on this card). */
  chips?: string[];
  /** Seller free-shipping progress (orange), or green once unlocked. `shortText` = the card's
   *  one-line pill label, when there is one; otherwise `text`, cut to one line. */
  freeShippingHint?: { text: string; shortText?: string; unlocked: boolean };
};

type CardActions = {
  /** Tap on the product (image, name, price, …). */
  onOpen?: (product: ProductSummary) => void;
  /** The "+" button; it shows a spinner until the returned promise settles. */
  onAddToCart?: (product: ProductSummary) => Promise<void> | void;
};

const COPY = {
  // Confirmed from the live product card.
  soldBy: 'Sold by',
  // PLACEHOLDER COPY (not confirmed anywhere) — screen-reader labels only.
  addToCart: 'Add to Cart',
  wishlist: 'Wishlist, Coming soon',
};

/** Card width in a horizontal row: 2 cards plus the edge of the next one visible on a phone. */
const ROW_CARD_WIDTH = 168;
const HEART_SIZE = 26;
const ADD_SIZE = 28;

// Live grid: 4 columns, 2 at ≤991px, 1 at ≤640px.
function columnsFor(width: number): number {
  if (width <= 640) {
    return 1;
  }
  return width <= 991 ? 2 : 4;
}

/** Full listing (Shop, Home's Explore Products): `minColumns`+ cards per line. */
export function ProductGrid({
  products,
  minColumns = 1,
  ...actions
}: {
  products: ProductSummary[];
  /** Never fewer columns than this (2 per row on phones). */
  minColumns?: number;
} & CardActions) {
  const columns = Math.max(minColumns, columnsFor(useWindowDimensions().width));
  return (
    <View style={styles.grid}>
      {products.map((product) => (
        <View key={product.id} style={[styles.gridCell, { width: `${100 / columns}%` }]}>
          <ProductCard product={product} {...actions} />
        </View>
      ))}
    </View>
  );
}

/** One horizontally scrolling row (Home's Flash Deals / Trending Now); the next card peeks in. */
export function ProductRow({
  products,
  bleed = 16,
  ...actions
}: {
  products: ProductSummary[];
  /** The parent's side padding, cancelled so the row runs to the screen edges. */
  bleed?: number;
} & CardActions) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -bleed }}
      contentContainerStyle={[styles.row, { paddingHorizontal: bleed }]}>
      {products.map((product) => (
        <View key={product.id} style={styles.rowCell}>
          <ProductCard product={product} {...actions} />
        </View>
      ))}
    </ScrollView>
  );
}

export function ProductCard({
  product,
  onOpen,
  onAddToCart,
}: { product: ProductSummary } & CardActions) {
  const [adding, setAdding] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function handleAddToCart() {
    if (adding || !onAddToCart) {
      return; // One request at a time, so a double tap can't add the product twice.
    }
    setAdding(true);
    try {
      await onAddToCart(product);
    } finally {
      if (mounted.current) {
        setAdding(false);
      }
    }
  }

  const open = () => onOpen?.(product);
  const hint = product.freeShippingHint;

  return (
    <View style={styles.card}>
      {/* Image area: the photo opens the product; badge and heart sit over it. */}
      <View style={styles.imageWrap}>
        <Pressable
          onPress={open}
          style={({ pressed }) => [styles.imagePressable, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={product.name}>
          {/* Plain white behind the photo, "contain" so the whole product stays visible. */}
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.image} contentFit="contain" />
          ) : (
            <SymbolView
              name={{ ios: 'photo', android: 'image', web: 'image' }}
              size={32}
              tintColor={Colors.placeholderIcon}
            />
          )}
        </Pressable>

        {product.tag && (
          <View style={styles.tag} pointerEvents="none">
            <Text style={styles.tagText} numberOfLines={1}>
              {product.tag}
            </Text>
          </View>
        )}

        {/* Wishlist: visual only — not a feature yet (same as other "Coming soon" items). */}
        <View
          style={styles.heart}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={COPY.wishlist}>
          <SymbolView
            name={{ ios: 'heart', android: 'favorite_border', web: 'favorite_border' }}
            size={13}
            tintColor={Colors.helperText}
          />
        </View>
      </View>

      {/* Text area also opens the product; the image above already carries the screen-reader
          label, so this copy is skipped by screen readers. */}
      <Pressable
        onPress={open}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        accessible={false}
        importantForAccessibility="no-hide-descendants">
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Only with real reviews — no placeholder stars. */}
        {product.ratingCount > 0 && (
          <View style={styles.ratingRow}>
            <SymbolView
              name={{ ios: 'star.fill', android: 'star', web: 'star' }}
              size={10}
              tintColor={Colors.primaryOrange}
            />
            <Text style={styles.ratingValue}>{product.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({product.ratingCount})</Text>
          </View>
        )}

        <Text style={styles.price} numberOfLines={1}>
          {product.priceLabel}
        </Text>
        {product.originalPriceLabel && (
          <View style={styles.discountRow}>
            <Text style={styles.originalPrice} numberOfLines={1}>
              {product.originalPriceLabel}
            </Text>
            {product.discountPct !== undefined && product.discountPct > 0 && (
              <Text style={styles.discountPct}>-{product.discountPct}%</Text>
            )}
          </View>
        )}

        <Text style={styles.soldBy} numberOfLines={1}>
          {COPY.soldBy}: {product.sellerName}
        </Text>
      </Pressable>

      {/* Footer, pinned to the card bottom so cards in a row line up: compact free-shipping
          badge (start) and the "+" add-to-cart button (end). */}
      <View style={styles.footer}>
        <View style={styles.footerStart}>
          {hint && (
            <View style={[styles.shipBadge, hint.unlocked && styles.shipBadgeUnlocked]}>
              <SymbolView
                name={{ ios: 'shippingbox', android: 'local_shipping', web: 'local_shipping' }}
                size={9}
                tintColor={hint.unlocked ? Colors.verifiedText : Colors.primaryOrange}
              />
              <Text
                style={[styles.shipText, hint.unlocked && styles.shipTextUnlocked]}
                numberOfLines={1}>
                {hint.shortText ?? hint.text}
              </Text>
            </View>
          )}
        </View>

        {/* Add to cart (real): the same action the old full-width button had. */}
        <Pressable
          onPress={handleAddToCart}
          disabled={adding}
          hitSlop={6}
          style={({ pressed }) => [styles.add, (pressed || adding) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${COPY.addToCart}: ${product.name}`}
          accessibilityState={{ disabled: adding, busy: adding }}>
          {adding ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <SymbolView
              name={{ ios: 'plus', android: 'add', web: 'add' }}
              size={14}
              weight="bold"
              tintColor={Colors.white}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    rowGap: 10,
  },
  gridCell: {
    paddingHorizontal: 5,
  },
  row: {
    gap: 12,
  },
  rowCell: {
    width: ROW_CARD_WIDTH,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.inputBorder,
  },
  // Square, full card width, plain white, no inner padding.
  imageWrap: {
    width: '100%',
    aspectRatio: 1.1, // slightly wide
    backgroundColor: Colors.white,
  },
  imagePressable: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  tag: {
    position: 'absolute',
    top: 6,
    start: 6,
    maxWidth: '65%',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: Colors.primaryOrange,
  },
  tagText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 9,
    letterSpacing: 0.2,
    color: Colors.white,
  },
  heart: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: HEART_SIZE,
    height: HEART_SIZE,
    borderRadius: HEART_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  body: {
    paddingTop: 6,
    paddingHorizontal: 8,
  },
  name: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 13,
    lineHeight: 17,
    color: Colors.sectionHeading,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingValue: {
    fontFamily: Fonts.secondary,
    fontSize: 10,
    color: Colors.dark,
  },
  ratingCount: {
    fontFamily: Fonts.secondary,
    fontSize: 10,
    color: Colors.helperText,
  },
  price: {
    marginTop: 2,
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.primaryOrange,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  originalPrice: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 11,
    color: Colors.helperText,
    textDecorationLine: 'line-through',
  },
  discountPct: {
    fontFamily: Fonts.primaryBold,
    fontSize: 10,
    color: Colors.verifiedText,
  },
  soldBy: {
    marginTop: 1,
    fontFamily: Fonts.primary,
    fontSize: 10,
    lineHeight: 13,
    color: Colors.helperText,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  footerStart: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  shipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    gap: 3,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(242,131,22,0.1)', // Primary Orange, tinted
  },
  shipBadgeUnlocked: {
    backgroundColor: 'rgba(25,135,84,0.08)', // verifiedText, tinted
  },
  shipText: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 9,
    lineHeight: 11,
    color: Colors.primaryOrange,
  },
  shipTextUnlocked: {
    color: Colors.verifiedText,
  },
  add: {
    width: ADD_SIZE,
    height: ADD_SIZE,
    borderRadius: ADD_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryOrange,
  },
  pressed: {
    opacity: 0.85,
  },
});
