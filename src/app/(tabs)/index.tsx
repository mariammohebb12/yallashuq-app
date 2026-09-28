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
  View,
} from 'react-native';

import { addToCart } from '@/api/cart';
import { fetchCatalogPage, withSectionTag } from '@/api/catalog';
import { FormMessage } from '@/components/form-message';
import {
  DealRows,
  ProductGrid,
  ProductRow,
  type ProductSummary,
} from '@/components/product-card';
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

type Category = { id: number; name: string; icon: SymbolViewProps['name'] };

// Real categories and their Odoo ids (from the live homepage's /shop?category=<id> links).
// Icons: app-chosen SF Symbols / Material icons matching each name (client request 2026-09-28) —
// the live categories have no images of their own (only Odoo's placeholder).
const CATEGORIES: Category[] = [
  { id: 1, name: 'Desks', icon: symbol('table.furniture', 'desk') },
  { id: 10, name: 'Components', icon: symbol('cpu', 'memory') },
  { id: 11, name: 'Office Desks', icon: symbol('desktopcomputer', 'desktop_windows') },
  { id: 17, name: 'Chairs', icon: symbol('chair', 'chair') },
  { id: 12, name: 'Gaming Desks', icon: symbol('gamecontroller', 'sports_esports') },
  { id: 18, name: 'Couches', icon: symbol('sofa', 'weekend') },
  { id: 13, name: 'Glass Desks', icon: symbol('cube.transparent', 'view_in_ar') },
  { id: 14, name: 'Standing Desks', icon: symbol('figure.stand', 'accessibility_new') },
];
function symbol(ios: string, android: string): SymbolViewProps['name'] {
  return { ios, android, web: android } as SymbolViewProps['name'];
}
// Shop by Category: exactly 2 rows, scrolled sideways (client request 2026-09-28; the live site
// shows a static 3-per-row grid on phones). Row-major: first half on row 1, the rest on row 2.
const CATEGORY_ROWS = [
  CATEGORIES.slice(0, Math.ceil(CATEGORIES.length / 2)),
  CATEGORIES.slice(Math.ceil(CATEGORIES.length / 2)),
];
// Live hero shows the first four categories as chips.
const HERO_CHIPS = CATEGORIES.slice(0, 4);

// Home's product sections: the first page of the real catalog (GET /home/catalog/more, see
// src/api/catalog.ts). On the live site all three sections show the same products and differ only
// in their badge, so one load feeds all three.
const CATALOG_PAGES = 1;
// TODO(Catalog paging): pagination stays log-only for now.
const CATALOG_PAGE = 1;

// Page rhythm (client request 2026-09-28, tighter than the live site): one side gutter and one gap
// between top-level blocks, used by every section.
const GUTTER = 16;
const SECTION_GAP = 20;

type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; products: ProductSummary[]; hasNext: boolean };

type Service = {
  title: string;
  subtitle: string;
  icon: SymbolViewProps['name'];
  gradient: {
    colors: readonly [string, string, ...string[]];
    locations: readonly [number, number, ...number[]];
  };
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

export default function HomeScreen() {
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
  // 'row': one sideways-scrolling row (Flash Deals, Trending Now); 'grid': 2 per row (the full
  // Explore Products listing). Minimal cards either way (client request 2026-09-28 — the live
  // site shows one tall card per row below 640px).
  function productSection(tag: string, layout: 'row' | 'grid' | 'deals') {
    if (catalog.status === 'loading') {
      return <ActivityIndicator style={styles.sectionLoading} color={Colors.primaryOrange} />;
    }
    if (catalog.status === 'error') {
      return <FormMessage type="error" message={catalog.message} />;
    }
    if (layout === 'deals') {
      // No section badge on the deal cards (client 2026-09-28).
      return (
        <DealRows
          products={catalog.products}
          bleed={GUTTER}
          onOpen={openProduct}
          onAddToCart={handleAddToCart}
        />
      );
    }
    const products = withSectionTag(catalog.products, tag);
    return layout === 'row' ? (
      <ProductRow
        products={products}
        bleed={GUTTER}
        onOpen={openProduct}
        onAddToCart={handleAddToCart}
      />
    ) : (
      <ProductGrid
        products={products}
        minColumns={2}
        onOpen={openProduct}
        onAddToCart={handleAddToCart}
      />
    );
  }

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroller}
          contentContainerStyle={styles.categoryScroll}>
          <View style={styles.categoryRows}>
            {CATEGORY_ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.categoryRow}>
                {row.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => openCategory(category)}
                    style={({ pressed }) => [styles.category, pressed && styles.categoryPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={category.name}>
                    {/* Client reference (2026-09-28, noon's "Shop by category"): a rounded tile
                        with an orange → pale vertical gradient and the picture on it; the name
                        underneath, outside the tile. Brand colors instead of noon's. */}
                    <LinearGradient
                      colors={[Colors.primaryOrange, Colors.lightOrange, Colors.photoPreviewBackground]}
                      locations={[0, 0.35, 0.85]}
                      style={styles.categoryTile}>
                      <SymbolView name={category.icon} size={44} tintColor={Colors.dark} />
                    </LinearGradient>
                    <Text style={styles.categoryName} numberOfLines={2}>
                      {category.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ---- Flash Deals ----
          Client reference (2026-09-28, noon's "Mega Deals"): a peach panel, the centered
          two-color title, and two rows of compact deal cards (name + "Sold by" added, no badge).
          No "See All" (the reference has none). */}
      <View style={[styles.section, styles.flashSection]}>
        <Text style={styles.flashHeading} accessibilityRole="header">
          Flash <Text style={styles.flashHeadingAccent}>Deals</Text>
        </Text>
        {productSection('', 'deals')}
      </View>

      {/* ---- Trending Now ---- */}
      <View style={styles.section}>
        <SectionHead title="Trending Now" link="Explore" onLinkPress={openShop} />
        <Text style={styles.sub}>Popular this week</Text>
        {productSection('Top Deal', 'row')}
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
        {productSection('Top Deal', 'grid')}
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
      <Text style={[styles.headTitle, titleStyle]} numberOfLines={1}>
        {title}
      </Text>
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
    paddingHorizontal: GUTTER,
    paddingTop: GUTTER,
    // Clears the floating MishMesh launcher (56px + 16px offset) at the end of the page.
    paddingBottom: 88,
  },

  hero: {
    borderRadius: 22,
    overflow: 'hidden',
    paddingVertical: 28,
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
    fontFamily: Fonts.primaryBold,
    fontSize: 10,
    color: Colors.aiBadgeText,
  },
  heroHeading: {
    fontFamily: Fonts.primaryBold,
    fontSize: 35, // 2.2rem at the live ≤991px breakpoint
    lineHeight: 40,
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
    fontFamily: Fonts.primarySemiBold,
    fontSize: 11,
    color: Colors.white,
  },

  services: {
    marginTop: SECTION_GAP,
    gap: 10,
  },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
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
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    color: Colors.white,
  },
  serviceSubtitle: {
    marginTop: 3,
    fontFamily: Fonts.primary,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  section: {
    marginTop: SECTION_GAP,
  },
  // Every section header: bold title (start) + the same link pill (end), one line.
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 28,
    marginBottom: 10,
  },
  headTitle: {
    flexShrink: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 20,
    lineHeight: 26,
    // Solid stand-in for the live text gradient (#1a1a1a → #444).
    color: Colors.sectionHeading,
  },
  headLink: {
    height: 28,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(242,131,22,0.25)',
    backgroundColor: 'rgba(242,131,22,0.06)',
    paddingHorizontal: 12,
  },
  headLinkText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.primaryOrange,
  },
  sub: {
    marginTop: -8,
    marginBottom: 10,
    fontFamily: Fonts.primaryMedium,
    fontSize: 11,
    color: Colors.subtleText,
  },

  // Full-bleed strip (cancels the page gutter), content padded back in.
  categoryScroller: {
    marginHorizontal: -GUTTER,
  },
  categoryScroll: {
    paddingHorizontal: GUTTER,
  },
  categoryRows: {
    gap: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 18,
  },
  // Fixed width: about 3⅓ tiles visible on a phone, so the cut-off 4th shows there's more.
  category: {
    width: 96,
    alignItems: 'center',
  },
  categoryPressed: {
    opacity: 0.85,
  },
  categoryTile: {
    width: 96,
    height: 96,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    marginTop: 8,
    fontFamily: Fonts.primary,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
    color: Colors.categoryName,
  },

  // Full-width tinted band (was an inset card): its heading and cards start at the same gutter
  // as every other section.
  // Full-bleed peach panel: Light Orange, tinted.
  flashSection: {
    marginHorizontal: -GUTTER,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: GUTTER,
    backgroundColor: 'rgba(255, 179, 107, 0.28)',
  },
  flashHeading: {
    marginBottom: 14,
    fontFamily: Fonts.primaryBold,
    fontSize: 18,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: Colors.dark,
  },
  flashHeadingAccent: {
    color: Colors.primaryOrange,
  },

  sectionLoading: {
    paddingVertical: 32,
  },
  catalogCount: {
    fontFamily: Fonts.primaryMedium,
    fontSize: 11,
    color: Colors.subtleText,
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
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
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.paginationText,
  },
  pageTextActive: {
    color: Colors.white,
  },
});
