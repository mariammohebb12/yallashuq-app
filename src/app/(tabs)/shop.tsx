import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { addToCart } from '@/api/cart';
import { fetchCatalogPage } from '@/api/catalog';
import { ComingSoonBadge } from '@/components/coming-soon';
import { FormMessage } from '@/components/form-message';
import { ProductGrid, type ProductSummary } from '@/components/product-card';
import { setCartQuantity } from '@/state/cart-quantity';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Shop (/shop). Sections follow the live yallashuq.com/shop page at its phone layout:
 * breadcrumb, "All Sellers" (a dropdown on phones), "Filters" card, "All Products" header with
 * count and sort, product grid. Styled with Home's design system (cards, colors, fonts).
 *
 * Products are REAL: GET /home/catalog/more (src/api/catalog.ts), paged with "Load More".
 *
 * NOT FUNCTIONAL YET — shown disabled with a "coming soon" note on purpose (approved 2026-09-25):
 * that route ignores every filter and has no seller ids, so the seller list, Free Shipping /
 * Warranty Eligible filters, sort, and the `category` param from Home can't work yet. They need
 * the backend route to accept the /shop filters (search, sort, seller, free_shipping,
 * warranty_eligible, category) and to return a sellers list — requested in
 * docs/backend-requests/002-catalog-filters-json.md. The /shop HTML page is the only place that
 * filters today.
 *
 * Left out on purpose: the "Top Rated" sort (not a real option on the live page — it's the fixed
 * badge text on its cards, so the badge is left out too) and the page's search box (not in scope
 * for this step). Discounted products still get the live "SALE -N%" badge.
 */

const COPY = {
  // Confirmed from the live /shop page.
  home: 'Home',
  allProducts: 'All Products',
  allSellers: 'All Sellers',
  filters: 'Filters',
  freeShipping: 'Free Shipping',
  warrantyEligible: 'Warranty Eligible',
  productCount: (count: number) => `${count} products`,
  // Confirmed from the live homepage catalog's button.
  loadMore: 'Load More',
  loading: 'Loading...',
  // PLACEHOLDER COPY (not confirmed anywhere).
  comingSoon: 'Coming soon',
  categoryNotice: 'Category filtering is coming soon — showing all products.',
};

// The live page's three real sort options (value → label). Only shown as the current value until
// the backend applies sort.
const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_low', label: 'Price Low to High' },
  { value: 'newest', label: 'Newest' },
] as const;
const CURRENT_SORT = SORT_OPTIONS[0]; // The live default (and the route's fixed order).

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; products: ProductSummary[]; hasNext: boolean; nextPage: number };

export default function ShopScreen() {
  // From Home's hero chips / category cards (live: /shop?category=<id>). Can't be applied yet.
  const { category } = useLocalSearchParams<{ category?: string }>();

  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadFirstPage = useCallback(async () => {
    const result = await fetchCatalogPage(1);
    if (!mounted.current) {
      return;
    }
    setList(
      result.ok
        ? {
            status: 'ready',
            products: result.products,
            hasNext: result.hasNext,
            nextPage: result.nextPage,
          }
        : { status: 'error', message: result.message }
    );
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  async function refresh() {
    setRefreshing(true);
    await loadFirstPage();
    if (mounted.current) {
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (list.status !== 'ready' || !list.hasNext || loadingMore) {
      return;
    }
    setLoadingMore(true);
    const result = await fetchCatalogPage(list.nextPage);
    if (!mounted.current) {
      return;
    }
    setLoadingMore(false);
    if (!result.ok) {
      Alert.alert(result.message); // PLACEHOLDER UI, as for Add to Cart errors on Home.
      return;
    }
    setList((current) =>
      current.status === 'ready'
        ? {
            status: 'ready',
            // Skip anything already listed, in case the catalog changed between pages.
            products: [
              ...current.products,
              ...result.products.filter((p) => !current.products.some((c) => c.id === p.id)),
            ],
            hasNext: result.hasNext,
            nextPage: result.nextPage,
          }
        : current
    );
  }

  function openProduct(product: ProductSummary) {
    router.push({ pathname: '/product/[id]', params: { id: String(product.id) } });
  }

  // Same flow as Home: real add to cart, then go to the cart as the live site does.
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
      router.navigate('/cart');
    } else {
      Alert.alert(result.message); // PLACEHOLDER UI (see Home).
    }
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primaryOrange} />
      }>
      {/* Breadcrumb: Home / All Products */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => router.navigate('/')} hitSlop={8} accessibilityRole="link">
          <Text style={styles.breadcrumbLink}>{COPY.home}</Text>
        </Pressable>
        <Text style={styles.breadcrumbText}> / </Text>
        <Text style={styles.breadcrumbText}>{COPY.allProducts}</Text>
      </View>

      {category !== undefined && (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>{COPY.categoryNotice}</Text>
        </View>
      )}

      {/* "All Sellers" — a dropdown toggle on the live phone layout. Disabled: no seller data yet. */}
      <View
        style={[styles.card, styles.sellersToggle, styles.disabled]}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel={`${COPY.allSellers}, ${COPY.comingSoon}`}>
        <Text style={styles.sellersText}>{COPY.allSellers}</Text>
        <View style={styles.sellersEnd}>
          <ComingSoonBadge />
          <SymbolView
            name={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }}
            size={14}
            tintColor={Colors.placeholderIcon}
          />
        </View>
      </View>

      {/* Filters — disabled until the backend applies them. */}
      <View style={[styles.card, styles.filters]}>
        <View style={styles.filtersHead}>
          <Text style={styles.filtersTitle}>{COPY.filters}</Text>
          <ComingSoonBadge />
        </View>
        <DisabledCheckbox label={COPY.freeShipping} />
        <DisabledCheckbox label={COPY.warrantyEligible} />
      </View>

      {/* Header: All Products · N products, and sort */}
      <View style={styles.head}>
        <View style={styles.headTitleRow}>
          <Text style={styles.headTitle}>{COPY.allProducts}</Text>
          {/* No total from the route; the count is exact only once every page is loaded. */}
          {list.status === 'ready' && !list.hasNext && (
            <Text style={styles.headCount}>{COPY.productCount(list.products.length)}</Text>
          )}
        </View>
        <View
          style={[styles.sort, styles.disabled]}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={`${CURRENT_SORT.label}, ${COPY.comingSoon}`}>
          <Text style={styles.sortText}>{CURRENT_SORT.label}</Text>
          <SymbolView
            name={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }}
            size={12}
            tintColor={Colors.placeholderIcon}
          />
        </View>
      </View>
      <View style={styles.sortNote}>
        <ComingSoonBadge />
      </View>

      {list.status === 'loading' ? (
        <ActivityIndicator style={styles.listLoading} color={Colors.primaryOrange} />
      ) : list.status === 'error' ? (
        <FormMessage type="error" message={list.message} />
      ) : (
        <>
          {/* 2 compact cards per row on phones (more on wider screens, per the shared grid). */}
          <ProductGrid
            products={list.products}
            minColumns={2}
            size="compact"
            onOpen={openProduct}
            onAddToCart={handleAddToCart}
          />
          {list.hasNext && (
            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              style={({ pressed }) => [styles.loadMore, (pressed || loadingMore) && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ busy: loadingMore }}>
              <Text style={styles.loadMoreText}>
                {loadingMore ? COPY.loading : COPY.loadMore}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
  );
}


/** Live filter checkbox look, permanently disabled for now. */
function DisabledCheckbox({ label }: { label: string }) {
  return (
    <View
      style={[styles.filterRow, styles.disabled]}
      accessible
      accessibilityRole="checkbox"
      accessibilityState={{ checked: false, disabled: true }}
      accessibilityLabel={label}>
      <View style={styles.checkbox} />
      <Text style={styles.filterLabel}>{label}</Text>
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
    paddingTop: 8,
    // Clears the floating MishMesh launcher (56px + 16px offset) at the end of the page.
    paddingBottom: 88,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  breadcrumbLink: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    color: Colors.primaryOrange,
  },
  breadcrumbText: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    color: Colors.subtleText,
  },
  notice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  noticeText: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
  },
  sellersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  sellersText: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark,
  },
  sellersEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filters: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  filtersHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  filtersTitle: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
    backgroundColor: Colors.white,
  },
  filterLabel: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.mutedText,
  },
  disabled: {
    opacity: 0.6,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },
  headTitleRow: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  headTitle: {
    fontFamily: Fonts.primary,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.sectionHeading,
  },
  headCount: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.subtleText,
  },
  sort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
  },
  sortText: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    color: Colors.mutedText,
  },
  sortNote: {
    alignItems: 'flex-end',
    marginTop: 6,
    marginBottom: 12,
  },
  listLoading: {
    paddingVertical: 40,
  },
  loadMore: {
    alignSelf: 'center',
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(242,178,119,0.5)',
    backgroundColor: 'rgb(255,244,230)',
    paddingHorizontal: 28,
    justifyContent: 'center',
    marginTop: 16,
  },
  loadMoreText: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.loadMoreText,
  },
  pressed: {
    opacity: 0.7,
  },
});
