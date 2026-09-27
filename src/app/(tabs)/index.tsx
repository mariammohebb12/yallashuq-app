import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { addToCart } from '@/api/cart';
import { fetchCatalogPage, withSectionTag } from '@/api/catalog';
import { FormMessage } from '@/components/form-message';
import { ProductGrid, type ProductSummary } from '@/components/product-card';
import { setCartQuantity } from '@/state/cart-quantity';
import { Fonts } from '@/theme/fonts';
import { Colors, HomeGradients } from '@/theme/theme';

// Screen 1: Home. Sections, copy and styles mirror the live homepage
// (yallashuq.com/, `.sm-*` classes), at its mobile breakpoints. Products come from the backend
// (GET /home/catalog/more); the category list is still hardcoded from the live site (no JSON
// source for it found yet).
// Wired: product cards open the product route; "Add to Cart" adds to the real Odoo session cart
// and then opens Cart (as the live site does); "View All" / "See All" / "Explore" open Shop; hero
// chips and category cards open Shop filtered by category. Search and pagination still only log.

type Category = { id: number; name: string };

// Real categories and their Odoo ids (from the live homepage's /shop?category=<id> links).
const CATEGORIES: Category[] = [
  { id: 1, name: 'Desks' },
  { id: 10, name: 'Components' },
  { id: 11, name: 'Office Desks' },
  { id: 17, name: 'Chairs' },
  { id: 12, name: 'Gaming Desks' },
  { id: 18, name: 'Couches' },
  { id: 13, name: 'Glass Desks' },
  { id: 14, name: 'Standing Desks' },
];
// Live hero shows the first four categories as chips.
const HERO_CHIPS = CATEGORIES.slice(0, 4);

// Home's product sections: the first page of the real catalog (GET /home/catalog/more, see
// src/api/catalog.ts). On the live site all three sections show the same products and differ only
// in their badge, so one load feeds all three.
const CATALOG_PAGES = 1; // TODO(Catalog paging): pagination stays log-only for now.
const CATALOG_PAGE = 1;

type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; products: ProductSummary[]; hasNext: boolean };

type Service = {
  title: string;
  subtitle: string;
  icon: SymbolViewProps['name'];
  gradient: { colors: readonly [string, string, ...string[]]; locations: readonly [number, number, ...number[]] };
};

const SERVICES: Service[] = [
  {
    title: 'Free Shipping',
    subtitle: 'On selected products',
    icon: { ios: 'truck.box', android: 'local_shipping', web: 'local_shipping' },
    gradient: HomeGradients.freeShipping,
  },
  {
    title: 'VIP Warranty',
    subtitle: '100% Protection Guaranteed',
    icon: { ios: 'shield', android: 'shield', web: 'shield' },
    gradient: HomeGradients.warranty,
  },
  {
    title: 'Gift Cards',
    subtitle: 'Give the perfect gift',
    icon: { ios: 'gift', android: 'redeem', web: 'redeem' },
    gradient: HomeGradients.giftCards,
  },
];

// 135deg / 145deg CSS gradients ≈ top-start to bottom-end.
const DIAGONAL = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;

// Live category grid: 8 columns, 4 at ≤1100px, 3 at ≤640px.
function categoryColumns(width: number): number {
  if (width <= 640) {
    return 3;
  }
  return width <= 1100 ? 4 : 8;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    fetchCatalogPage(1).then((result) => {
      if (!active) {
        return;
      }
      setCatalog(
        result.ok
          ? { status: 'ready', products: result.products, hasNext: result.hasNext }
          : { status: 'error', message: result.message }
      );
    });
    return () => {
      active = false;
    };
  }, []);

  /** A product section's body: spinner, backend error, or the grid with the section's badge. */
  function productSection(tag: string) {
    if (catalog.status === 'loading') {
      return <ActivityIndicator style={styles.sectionLoading} color={Colors.primaryOrange} />;
    }
    if (catalog.status === 'error') {
      return <FormMessage type="error" message={catalog.message} />;
    }
    return (
      <ProductGrid
        products={withSectionTag(catalog.products, tag)}
        onOpen={openProduct}
        onAddToCart={handleAddToCart}
      />
    );
  }
  const categoryWidth = `${100 / categoryColumns(width)}%` as const;

  function openProduct(product: ProductSummary) {
    router.push({ pathname: '/product/[id]', params: { id: String(product.id) } });
  }

  async function handleAddToCart(product: ProductSummary) {
    const result = await addToCart({
      variantId: product.variantId,
      templateId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      sellerName: product.sellerName,
      priceLabel: product.priceLabel,
    });
    if (result.ok) {
      setCartQuantity(result.cartQuantity);
      // Same as the live site: after adding, go to the cart.
      router.navigate('/cart');
    } else {
      // PLACEHOLDER UI: the live site shows its own cart notification; a plain alert stands in
      // until the app's notification/toast pattern is confirmed. The message is the backend's.
      Alert.alert(result.message);
    }
  }

  // "View All" / "See All" / "Explore" all link to plain /shop on the live site.
  // TODO(Shop filters): no flash-deals/trending filter param is confirmed, so See All / Explore
  // open Shop unfiltered for now.
  const openShop = () => router.navigate('/shop');

  // Live hero chips and category cards link to /shop?category=<id>.
  function openCategory(category: Category) {
    router.navigate({ pathname: '/shop', params: { category: String(category.id) } });
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {/* ---- Hero ---- */}
      <LinearGradient
        colors={HomeGradients.hero.colors}
        locations={HomeGradients.hero.locations}
        // CSS 120deg.
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.hero}>
        {/* Live .sm-hero::before darkening overlay (its promo image is not included). */}
        <LinearGradient
          colors={['rgba(0,0,0,0.58)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0)']}
          locations={[0, 0.75, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={HomeGradients.aiBadge.colors}
          locations={HomeGradients.aiBadge.locations}
          style={styles.aiBadge}>
          <Image
            source={require('@/assets/images/home/ai-powered-assistant.svg')}
            style={styles.aiBadgeLogo}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.aiBadgeDot} />
          <Text style={styles.aiBadgeText}>AI Powered Shopping</Text>
        </LinearGradient>

        <Text style={styles.heroHeading}>
          <Text style={styles.heroHeadingWhite}>Shop Without</Text>
          {'\n'}
          <Text style={styles.heroHeadingOrange}>Borders</Text>
        </Text>
        <Text style={styles.heroText}>
          Discover thousands of products from trusted sellers. Cross-border delivery, smart
          recommendations, and unbeatable value.
        </Text>

        <View style={styles.heroSearch}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={14}
            tintColor="#aaaaaa"
          />
          <TextInput
            style={styles.heroSearchInput}
            placeholder="What are you looking for?"
            placeholderTextColor={Colors.placeholderIcon}
            returnKeyType="search"
            // TODO(Search): live form submits to /shop?search=<text>; not wired yet.
            onSubmitEditing={(event) => console.log('Search submitted', event.nativeEvent.text)}
          />
        </View>

        <View style={styles.chipRow}>
          {HERO_CHIPS.map((category) => (
            <Pressable
              key={category.id}
              style={styles.chip}
              onPress={() => openCategory(category)}
              accessibilityRole="button">
              <Text style={styles.chipText} numberOfLines={1}>
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* ---- Services ---- */}
      <View style={styles.services}>
        {SERVICES.map((service) => (
          <LinearGradient
            key={service.title}
            colors={service.gradient.colors}
            locations={service.gradient.locations}
            {...DIAGONAL}
            style={styles.service}>
            <View style={styles.serviceIcon}>
              <SymbolView name={service.icon} size={24} tintColor={Colors.white} />
            </View>
            <View style={styles.serviceTextBox}>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceSubtitle}>{service.subtitle}</Text>
            </View>
          </LinearGradient>
        ))}
      </View>

      {/* ---- Shop by Category ---- */}
      <View style={styles.section}>
        <SectionHead title="Shop by Category" link="View All" onLinkPress={openShop} />
        <Text style={styles.sub}>Browse all categories</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((category, index) => {
            const gradient = HomeGradients.categories[index % HomeGradients.categories.length];
            return (
              <View key={category.id} style={[styles.categoryCell, { width: categoryWidth }]}>
                <Pressable
                  onPress={() => openCategory(category)}
                  accessibilityRole="button"
                  accessibilityLabel={category.name}>
                  <LinearGradient
                    colors={gradient.colors}
                    locations={gradient.locations}
                    {...DIAGONAL}
                    style={styles.category}>
                    {/* Live categories all use Odoo's placeholder image for now. */}
                    <View style={styles.categoryImage}>
                      <SymbolView
                        name={{ ios: 'photo', android: 'image', web: 'image' }}
                        size={18}
                        tintColor={Colors.placeholderIcon}
                      />
                    </View>
                    <View style={styles.categoryNameBox}>
                      <Text style={styles.categoryName} numberOfLines={2}>
                        {category.name}
                      </Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      {/* ---- Flash Deals ---- */}
      <LinearGradient
        colors={HomeGradients.flashDeals.colors}
        locations={HomeGradients.flashDeals.locations}
        {...DIAGONAL}
        style={[styles.section, styles.flashSection]}>
        <SectionHead
          title="Flash Deals"
          link="See All"
          onLinkPress={openShop}
          titleStyle={styles.flashHeading}
        />
        {productSection('Hot Sale')}
      </LinearGradient>

      {/* ---- Trending Now ---- */}
      <View style={styles.section}>
        <SectionHead title="Trending Now" link="Explore" onLinkPress={openShop} />
        <Text style={styles.sub}>Popular this week</Text>
        {productSection('Top Deal')}
      </View>

      {/* ---- Explore Products (catalog) ---- */}
      <View style={styles.section}>
        <SectionHead
          title="Explore Products"
          aside={
            // The route gives no total; the live "Showing N of M" is only known once there's
            // no next page, so the count is hidden until then.
            catalog.status === 'ready' && !catalog.hasNext ? (
              <Text style={styles.catalogCount}>
                Showing {catalog.products.length} of {catalog.products.length} products
              </Text>
            ) : undefined
          }
        />
        <View style={styles.catalogGrid}>
          {productSection('Top Deal')}
        </View>
        <Pagination page={CATALOG_PAGE} pageCount={CATALOG_PAGES} />
      </View>
    </ScrollView>
  );
}

function SectionHead({
  title,
  link,
  onLinkPress,
  aside,
  titleStyle,
}: {
  title: string;
  link?: string;
  /** Without it the link only logs (destination not wired yet). */
  onLinkPress?: () => void;
  aside?: ReactNode;
  titleStyle?: object;
}) {
  return (
    <View style={styles.head}>
      <Text style={[styles.headTitle, titleStyle]}>{title}</Text>
      {link && (
        <Pressable
          style={styles.headLink}
          onPress={onLinkPress ?? (() => console.log(`${link} pressed`))}
          accessibilityRole="link">
          <Text style={styles.headLinkText}>{link}</Text>
        </Pressable>
      )}
      {aside}
    </View>
  );
}

/**
 * Page numbers only (live .sm-pagination); Prev/Next come with the backend step.
 * TODO(Catalog paging): the live catalog loads further pages from GET /home/catalog/more?hp_page=N
 * (returns {cards, has_next, next_page}) — a route not in CLAUDE.md's confirmed list yet.
 */
function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  return (
    <View style={styles.pagination}>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) =>
        number === page ? (
          <LinearGradient
            key={number}
            colors={HomeGradients.orangeButton.colors}
            locations={HomeGradients.orangeButton.locations}
            {...DIAGONAL}
            style={styles.pageButton}
            accessibilityRole="button"
            accessibilityState={{ selected: true }}>
            <Text style={[styles.pageText, styles.pageTextActive]}>{number}</Text>
          </LinearGradient>
        ) : (
          <Pressable
            key={number}
            style={[styles.pageButton, styles.pageButtonIdle]}
            onPress={() => console.log('Page pressed', number)}
            accessibilityRole="button">
            <Text style={styles.pageText}>{number}</Text>
          </Pressable>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    // Clears the floating MishMesh launcher (56px + 16px offset) at the end of the page.
    paddingBottom: 88,
  },

  hero: {
    borderRadius: 22,
    overflow: 'hidden',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  aiBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  aiBadgeLogo: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 3,
  },
  aiBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.aiBadgeDot,
  },
  aiBadgeText: {
    fontFamily: Fonts.primary,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.aiBadgeText,
  },
  heroHeading: {
    fontFamily: Fonts.primary,
    fontSize: 35, // 2.2rem at the live ≤991px breakpoint
    lineHeight: 40,
    fontWeight: '800',
  },
  heroHeadingWhite: {
    color: Colors.white,
  },
  // Live also has a soft orange text-shadow glow; left out because iOS draws it as a dark box.
  heroHeadingOrange: {
    color: Colors.lightOrange,
  },
  heroText: {
    marginTop: 14,
    marginBottom: 18,
    fontFamily: Fonts.primary,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.88)',
  },
  heroSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 16,
  },
  heroSearchInput: {
    flex: 1,
    minHeight: 48,
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: '#222222',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    maxWidth: 150,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: Fonts.primary,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.white,
  },

  services: {
    marginTop: 18,
    gap: 10,
  },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTextBox: {
    flex: 1,
  },
  serviceTitle: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  serviceSubtitle: {
    marginTop: 3,
    fontFamily: Fonts.primary,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  section: {
    marginTop: 22,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  headTitle: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 26,
    fontWeight: '800',
    // Solid stand-in for the live text gradient (#1a1a1a → #444).
    color: Colors.sectionHeading,
  },
  headLink: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(242,131,22,0.25)',
    backgroundColor: 'rgba(242,131,22,0.06)',
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  headLinkText: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryOrange,
  },
  sub: {
    marginTop: -4,
    marginBottom: 12,
    fontFamily: Fonts.primary,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.subtleText,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5, // .sm-cats gap: 10px
    rowGap: 10,
  },
  categoryCell: {
    paddingHorizontal: 5,
  },
  category: {
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  categoryImage: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(236,236,236,0.8)',
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryNameBox: {
    minHeight: 28,
    justifyContent: 'center',
  },
  categoryName: {
    fontFamily: Fonts.primary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'center',
    color: Colors.categoryName,
  },

  flashSection: {
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,180,210,0.3)',
  },
  flashHeading: {
    color: Colors.flashHeading,
  },

  sectionLoading: {
    paddingVertical: 32,
  },
  catalogCount: {
    fontFamily: Fonts.primary,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.subtleText,
  },
  catalogGrid: {
    marginTop: 6,
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  pageButton: {
    minWidth: 38,
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonIdle: {
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.8)',
    backgroundColor: Colors.white,
  },
  pageText: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.paginationText,
  },
  pageTextActive: {
    color: Colors.white,
  },
});
