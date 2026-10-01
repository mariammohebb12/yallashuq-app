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
import { fetchShopProducts, type ShopSort } from '@/api/catalog';
import { ComingSoonBadge } from '@/components/coming-soon';
import { FormMessage } from '@/components/form-message';
import { PickerModal } from '@/components/picker-modal';
import { ProductGrid, type ProductSummary } from '@/components/product-card';
import { setCartQuantity } from '@/state/cart-quantity';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Shop (/shop). Sections follow the live yallashuq.com/shop page at its phone layout:
 * breadcrumb, "All Sellers" (a dropdown on phones), "Filters" card, "All Products" header with
 * count and sort, product grid. Styled with Home's design system (cards, colors, fonts).
 *
 * Products are REAL: POST /shop/products/json (fetchShopProducts, src/api/catalog.ts), paged with
 * "Load More". Free Shipping, Warranty Eligible, sort (the live page's three options only) and
 * the `category` param from Home are applied by the backend; changing one reloads from page 1.
 * The count is the backend's total_count for the current filters. An empty result shows
 * "0 products" and no grid, as the live page does (it has no "no products" text).
 * Where the route isn't deployed (staging, 2026-10-01) the unfiltered /home/catalog/more is shown
 * instead, with the controls disabled + "Coming soon" as before (approved 2026-09-25).
 *
 * STILL "Coming soon": "All Sellers" — no route returns a seller list and the cards carry no
 * seller id, so there's nothing to fill it with (docs/backend-requests/002-catalog-filters-json.md).
 * No price-range filter: the backend left it out on purpose (not real on the website either).
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
  // App wording (client 2026-09-28): opens the live /inventory/search page's search — never "AI".
  smartSearch: 'Smart Search',
  // Confirmed from the live /my/invoices page ("Sort By:"); the live /shop select has no label.
  sortBy: 'Sort By',
  // PLACEHOLDER COPY (not confirmed anywhere).
  comingSoon: 'Coming soon',
  categoryNotice: 'Category filtering is coming soon — showing all products.',
};

// The live page's three sort options (value → label) — the only values the backend accepts.
const SORT_OPTIONS: { value: ShopSort; label: string }[] = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_low', label: 'Price Low to High' },
  { value: 'newest', label: 'Newest' },
];

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      products: ProductSummary[];
      hasNext: boolean;
      nextPage: number;
      /** false = unfiltered fallback (route not deployed): controls shown as "Coming soon". */
      filtersAvailable: boolean;
      totalCount: number | null;
    };

export default function ShopScreen() {
  // From Home's hero chips / category cards (live: /shop?category=<id>).
  const { category } = useLocalSearchParams<{ category?: string }>();
  const categoryId = Number(category) > 0 ? Number(category) : 0;

  const [sort, setSort] = useState<ShopSort>('popular');
  const [freeShipping, setFreeShipping] = useState(false);
  const [warrantyEligible, setWarrantyEligible] = useState(false);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const mounted = useRef(true);
  // Only the latest request may update the list (filters can change while one is in flight).
  const requestId = useRef(0);
  const filters = { category: categoryId, sort, freeShipping, warrantyEligible };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchShopProducts({
      page: 1,
      category: categoryId,
      sort,
      freeShipping,
      warrantyEligible,
    });
    if (!mounted.current || id !== requestId.current) {
      return;
    }
    setLoadingMore(false); // Any "Load More" in flight was for the previous filters.
    setList(
      result.ok
        ? {
            status: 'ready',
            products: result.products,
            hasNext: result.hasNext,
            nextPage: result.nextPage,
            filtersAvailable: result.filtersAvailable,
            totalCount: result.totalCount,
          }
        : { status: 'error', message: result.message }
    );
  }, [categoryId, sort, freeShipping, warrantyEligible]);

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
    const id = requestId.current; // A filter change supersedes this page.
    setLoadingMore(true);
    const result = await fetchShopProducts({ ...filters, page: list.nextPage });
    if (!mounted.current || id !== requestId.current) {
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
            ...current,
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

  // A new filter/sort shows the spinner while page 1 reloads (loadFirstPage runs via its effect).
  function changeFilters(apply: () => void) {
    setList({ status: 'loading' });
    apply();
  }

  // Before the first reply, assume the route is there (controls enabled); the fallback disables them.
  const filtersAvailable = list.status !== 'ready' || list.filtersAvailable;
  const currentSort = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

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
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={Colors.primaryOrange}
        />
      }>
      {/* Breadcrumb: Home / All Products */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => router.navigate('/')} hitSlop={8} accessibilityRole="link">
          <Text style={styles.breadcrumbLink}>{COPY.home}</Text>
        </Pressable>
        <Text style={styles.breadcrumbText}> / </Text>
        <Text style={styles.breadcrumbText}>{COPY.allProducts}</Text>
      </View>

      {/* Smart Search (real, /inventory/search/query) — its own screen. */}
      <Pressable
        onPress={() => router.push('/smart-search')}
        style={({ pressed }) => [styles.card, styles.smartSearch, pressed && styles.pressed]}
        accessibilityRole="button">
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={14}
          tintColor={Colors.primaryOrange}
        />
        <Text style={styles.smartSearchText}>{COPY.smartSearch}</Text>
        <SymbolView
          name={{ ios: 'chevron.forward', android: 'chevron_right', web: 'chevron_right' }}
          size={12}
          tintColor={Colors.placeholderIcon}
        />
      </Pressable>

      {categoryId > 0 && !filtersAvailable && (
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
            name={{
              ios: 'chevron.down',
              android: 'keyboard_arrow_down',
              web: 'keyboard_arrow_down',
            }}
            size={14}
            tintColor={Colors.placeholderIcon}
          />
        </View>
      </View>

      {/* Filters — applied by the backend; disabled on the unfiltered fallback. */}
      <View style={[styles.card, styles.filters]}>
        <View style={styles.filtersHead}>
          <Text style={styles.filtersTitle}>{COPY.filters}</Text>
          {!filtersAvailable && <ComingSoonBadge />}
        </View>
        <FilterCheckbox
          label={COPY.freeShipping}
          checked={freeShipping}
          disabled={!filtersAvailable}
          onToggle={() => changeFilters(() => setFreeShipping((value) => !value))}
        />
        <FilterCheckbox
          label={COPY.warrantyEligible}
          checked={warrantyEligible}
          disabled={!filtersAvailable}
          onToggle={() => changeFilters(() => setWarrantyEligible((value) => !value))}
        />
      </View>

      {/* Header: All Products · N products, and sort */}
      <View style={styles.head}>
        <View style={styles.headTitleRow}>
          <Text style={styles.headTitle}>{COPY.allProducts}</Text>
          {/* The backend's total for these filters; on the fallback route (no total) the count
              is shown only once every page is loaded. */}
          {list.status === 'ready' &&
            (list.totalCount !== null ? (
              <Text style={styles.headCount}>{COPY.productCount(list.totalCount)}</Text>
            ) : (
              !list.hasNext && (
                <Text style={styles.headCount}>{COPY.productCount(list.products.length)}</Text>
              )
            ))}
        </View>
        <Pressable
          onPress={() => setSortPickerOpen(true)}
          disabled={!filtersAvailable}
          style={({ pressed }) => [
            styles.sort,
            !filtersAvailable && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !filtersAvailable }}
          accessibilityLabel={
            filtersAvailable
              ? `${COPY.sortBy}: ${currentSort.label}`
              : `${currentSort.label}, ${COPY.comingSoon}`
          }>
          <Text style={styles.sortText}>{currentSort.label}</Text>
          <SymbolView
            name={{
              ios: 'chevron.down',
              android: 'keyboard_arrow_down',
              web: 'keyboard_arrow_down',
            }}
            size={12}
            tintColor={Colors.placeholderIcon}
          />
        </Pressable>
      </View>
      {!filtersAvailable && (
        <View style={styles.sortNote}>
          <ComingSoonBadge />
        </View>
      )}

      {list.status === 'loading' ? (
        <ActivityIndicator style={styles.listLoading} color={Colors.primaryOrange} />
      ) : list.status === 'error' ? (
        <FormMessage type="error" message={list.message} />
      ) : (
        <>
          {/* 2 cards per row on phones (more on wider screens, per the shared grid). */}
          <ProductGrid
            products={list.products}
            minColumns={2}
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
              <Text style={styles.loadMoreText}>{loadingMore ? COPY.loading : COPY.loadMore}</Text>
            </Pressable>
          )}
        </>
      )}
      <PickerModal
        visible={sortPickerOpen}
        title={COPY.sortBy}
        items={SORT_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
        selectedKey={sort}
        onSelect={(key) => {
          setSortPickerOpen(false);
          if (key !== sort) {
            changeFilters(() => setSort(key as ShopSort));
          }
        }}
        onClose={() => setSortPickerOpen(false)}
      />
    </ScrollView>
  );
}

/** Live filter checkbox look (orange tick when checked); disabled on the unfiltered fallback. */
function FilterCheckbox({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      hitSlop={6}
      style={[styles.filterRow, disabled && styles.disabled]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && (
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            size={11}
            weight="bold"
            tintColor={Colors.white}
          />
        )}
      </View>
      <Text style={styles.filterLabel}>{label}</Text>
    </Pressable>
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
    fontFamily: Fonts.primarySemiBold,
    fontSize: 13,
    color: Colors.dark,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
  },
  smartSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  smartSearchText: {
    flex: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  sellersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  sellersText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
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
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  // App-only look (the live page uses the browser's default checkbox): brand orange when ticked.
  checkboxChecked: {
    borderColor: Colors.primaryOrange,
    backgroundColor: Colors.primaryOrange,
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
    fontFamily: Fonts.primaryBold,
    fontSize: 22,
    color: Colors.sectionHeading,
  },
  headCount: {
    fontFamily: Fonts.primaryMedium,
    fontSize: 12,
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
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.loadMoreText,
  },
  pressed: {
    opacity: 0.7,
  },
});
