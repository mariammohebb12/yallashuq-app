import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Fonts } from '@/theme/fonts';
import { Colors, HomeGradients } from '@/theme/theme';

/**
 * Product card and grid, styled like the live homepage's `.sm-product` / `.sm-products`.
 * Display only: prices and ratings are shown exactly as given (the backend formats and computes
 * them); nothing is calculated here.
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
  /** Average rating 0–5 and number of reviews (the rating row is hidden at 0 reviews). */
  rating: number;
  ratingCount: number;
  /** Badge on the image, e.g. "Hot Sale" / "Top Deal" / "SALE -20%". */
  tag?: string;
  /** 'sale' = the live site's red discount badge. */
  tagTone?: 'default' | 'sale';
  imageUrl?: string;
  /** Small chips (live: "Free Shipping", "Warranty", warranty tags). */
  chips?: string[];
  /** Seller free-shipping progress line (orange), or green once unlocked. */
  freeShippingHint?: { text: string; unlocked: boolean };
};

type CardActions = {
  /** Tap on the product (image, name, price, …). */
  onOpen?: (product: ProductSummary) => void;
  /** "Add to Cart"; the button shows a spinner until the returned promise settles. */
  onAddToCart?: (product: ProductSummary) => Promise<void> | void;
};

/** 'compact' = smaller card for a 2-per-row phone grid (Shop). */
type CardSize = 'regular' | 'compact';

const STAR_COUNT = 5;

// Live grid: 4 columns, 2 at ≤991px, 1 at ≤640px.
function columnsFor(width: number): number {
  if (width <= 640) {
    return 1;
  }
  return width <= 991 ? 2 : 4;
}

export function ProductGrid({
  products,
  minColumns = 1,
  size = 'regular',
  ...actions
}: {
  products: ProductSummary[];
  /** Never fewer columns than this (Shop: 2 per row on phones). */
  minColumns?: number;
  size?: CardSize;
} & CardActions) {
  const columns = Math.max(minColumns, columnsFor(useWindowDimensions().width));
  const compact = size === 'compact';
  return (
    <View style={[styles.grid, compact && styles.gridCompact]}>
      {products.map((product) => (
        <View key={product.id} style={{ width: `${100 / columns}%` }}>
          <View style={[styles.gridCell, compact && styles.gridCellCompact]}>
            <ProductCard product={product} size={size} {...actions} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProductCard({
  product,
  size = 'regular',
  onOpen,
  onAddToCart,
}: { product: ProductSummary; size?: CardSize } & CardActions) {
  const compact = size === 'compact';
  // Live card script: floor(avg) full stars, then a half star if there's a remainder.
  const fullStars = Math.floor(product.rating);
  const hasHalfStar = product.rating % 1 > 0;
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

  return (
    <View style={styles.card}>
      {/* The product area and "Add to Cart" are sibling pressables (not nested), so tapping the
          button never also opens the product, and screen readers can reach both. */}
      <Pressable
        onPress={() => onOpen?.(product)}
        // Compact: the content fills the card, so "Add to Cart" always sits at the bottom.
        style={({ pressed }) => [compact && styles.fill, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={product.name}>
        {/* White (not the live beige gradient) so the photo's own backdrop blends into the box
            instead of reading as a separate colored rectangle. */}
        <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
          {product.imageUrl ? (
            // "contain": the whole product photo stays visible (no crop/zoom).
            <Image source={{ uri: product.imageUrl }} style={styles.image} contentFit="contain" />
          ) : (
            <SymbolView
              name={{ ios: 'photo', android: 'image', web: 'image' }}
              size={40}
              tintColor={Colors.placeholderIcon}
            />
          )}
          {product.tag && (
            <LinearGradient
              colors={
                product.tagTone === 'sale'
                  ? HomeGradients.saleTag.colors
                  : HomeGradients.productTag.colors
              }
              locations={
                product.tagTone === 'sale'
                  ? HomeGradients.saleTag.locations
                  : HomeGradients.productTag.locations
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.tag, compact && styles.tagCompact]}>
              <Text style={[styles.tagText, compact && styles.tagTextCompact]}>{product.tag}</Text>
            </LinearGradient>
          )}
        </View>

        <View style={[styles.body, compact && styles.bodyCompact]}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={styles.sellerRow}>
            <SymbolView
              name={{
                ios: 'basket',
                android: 'shopping_basket',
                web: 'shopping_basket',
              }}
              size={10}
              tintColor={Colors.helperText}
            />
            <Text style={styles.sellerLabel}>Sold by: </Text>
            <Text style={styles.sellerName} numberOfLines={1}>
              {product.sellerName}
            </Text>
          </View>
          {/* Compact: fixed 2-line box, kept even when there's no hint, so the price below
              lines up across the row. */}
          <View style={compact && styles.hintBoxCompact}>
            {product.freeShippingHint && (
              <Text
                style={[
                  styles.freeShippingHint,
                  product.freeShippingHint.unlocked && styles.freeShippingUnlocked,
                ]}
                numberOfLines={compact ? 2 : undefined}>
                {product.freeShippingHint.text}
              </Text>
            )}
          </View>
          {/* Compact: everything above flows (a 1- or 2-line name takes only its own space);
              this spacer pushes price, rating and "Add to Cart" to the bottom, so they line up
              across the row. */}
          {compact && <View style={styles.fill} />}
          <View style={styles.priceRow}>
            <Text style={[styles.price, compact && styles.priceCompact]} numberOfLines={1}>
              {product.priceLabel}
            </Text>
            {product.originalPriceLabel && (
              <Text style={styles.originalPrice} numberOfLines={1}>
                {product.originalPriceLabel}
              </Text>
            )}
          </View>
          {/* Compact: the rating row's height is kept even at 0 reviews (row hidden), so every
              card in a row has the same height. */}
          <View style={compact && styles.ratingBoxCompact}>
            {product.ratingCount > 0 && (
              <View
                style={[styles.ratingRow, compact && styles.ratingRowCompact]}
                accessible
                accessibilityLabel={`${product.rating.toFixed(1)} (${product.ratingCount})`}>
                <View style={styles.stars}>
                  {Array.from({ length: STAR_COUNT }, (_, index) => (
                    <SymbolView
                      key={index}
                      name={
                        index < fullStars
                          ? { ios: 'star.fill', android: 'star', web: 'star' }
                          : index === fullStars && hasHalfStar
                            ? {
                                ios: 'star.leadinghalf.filled',
                                android: 'star_half',
                                web: 'star_half',
                              }
                            : {
                                ios: 'star',
                                android: 'star_border',
                                web: 'star_border',
                              }
                      }
                      size={compact ? 11 : 14}
                      tintColor={Colors.ratingStar}
                    />
                  ))}
                </View>
                <Text style={[styles.ratingValue, compact && styles.ratingTextCompact]}>
                  {product.rating.toFixed(1)}
                </Text>
                <Text style={[styles.ratingCount, compact && styles.ratingTextCompact]}>
                  ({product.ratingCount})
                </Text>
              </View>
            )}
          </View>
          {/* Live .sm-chip-row: always takes one row of height, even when empty. Compact cards
              only show it when there are chips. */}
          {(!compact || (product.chips ?? []).length > 0) && (
          <View style={styles.chipRow}>
            {(product.chips ?? []).map((chip) => (
              <Text
                key={chip}
                style={[styles.chip, compact && styles.chipCompact]}
                numberOfLines={1}>
                {chip}
              </Text>
            ))}
          </View>
          )}
        </View>
      </Pressable>

      <View style={[styles.footer, compact && styles.footerCompact]}>
        <Pressable
          onPress={handleAddToCart}
          disabled={adding}
          accessibilityRole="button"
          accessibilityState={{ disabled: adding, busy: adding }}
          style={({ pressed }) => (pressed || adding) && styles.pressed}>
          <LinearGradient
            colors={HomeGradients.orangeButton.colors}
            locations={HomeGradients.orangeButton.locations}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addButton}>
            {adding ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.addText}>Add to Cart</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -7, // .sm-products gap: 14px
    rowGap: 14,
  },
  gridCell: {
    paddingHorizontal: 7,
    flex: 1,
  },
  // Compact grid: 10px gap (live Shop .sp-grid).
  gridCompact: {
    marginHorizontal: -5,
    rowGap: 10,
  },
  gridCellCompact: {
    paddingHorizontal: 5,
  },
  // ---- Compact card (2 per row): same content, scaled down. ----
  imageWrapCompact: {
    height: 150,
  },
  tagCompact: {
    top: 8,
    start: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tagTextCompact: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  bodyCompact: {
    flex: 1, // lets the spacer push price/rating down to the button
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  // Compact card: every text block has a fixed height, so cards in a row line up exactly.
  fill: {
    flex: 1,
  },
  nameCompact: {
    fontSize: 14,
    lineHeight: 19,
    minHeight: undefined, // 1 or 2 lines (numberOfLines 2), no reserved blank line
  },
  hintBoxCompact: {
    height: 34, // marginTop 4 + 2 lines of 15
  },
  ratingBoxCompact: {
    height: 24,
    justifyContent: 'center',
  },
  ratingRowCompact: {
    marginTop: 0,
    marginBottom: 0,
  },
  priceCompact: {
    fontSize: 15,
  },
  ratingTextCompact: {
    fontSize: 11,
  },
  chipCompact: {
    maxWidth: 90,
    paddingHorizontal: 7,
    fontSize: 10,
  },
  footerCompact: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  imageWrap: {
    height: 220,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  tag: {
    position: 'absolute',
    top: 10,
    start: 10,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  tagText: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.26,
    color: Colors.white,
  },
  body: {
    paddingTop: 12,
    paddingHorizontal: 14,
  },
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  name: {
    fontFamily: Fonts.primary,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    minHeight: 40,
    color: Colors.sectionHeading,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  sellerLabel: {
    fontFamily: Fonts.primary,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.helperText,
  },
  sellerName: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark,
  },
  freeShippingHint: {
    marginTop: 4,
    fontFamily: Fonts.primary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    color: Colors.primaryOrange,
  },
  freeShippingUnlocked: {
    color: Colors.verifiedText,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  originalPrice: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.helperText,
    textDecorationLine: 'line-through',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    minHeight: 24,
    maxHeight: 24,
    overflow: 'hidden',
    marginBottom: 10,
  },
  chip: {
    maxWidth: 120,
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
  price: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '800',
    // Solid stand-in for the live text gradient (#f28316 → #e06a00).
    color: Colors.primaryOrange,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 8,
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
  addButton: {
    minHeight: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.36,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
