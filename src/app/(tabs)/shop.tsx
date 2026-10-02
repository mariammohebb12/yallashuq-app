import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { addToCart } from '@/api/cart';
import { fetchSellers, fetchShopProducts, type ShopSeller, type ShopSort } from '@/api/catalog';
import { ComingSoonBadge } from '@/components/coming-soon';
import { FormMessage } from '@/components/form-message';
import { PickerModal } from '@/components/picker-modal';
import { ProductGrid, type ProductSummary } from '@/components/product-card';
import { setCartQuantity } from '@/state/cart-quantity';
import { chevronForwardIcon } from '@/theme/directional-icon';
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
 * "All Sellers" (fixed 2026-10-02, missing-features-punchlist.md Tier 2 remnant): real sellers
 * from /shop/sellers/json (fetchSellers, src/api/catalog.ts) — only sellers who currently have
 * at least one product, so every option is guaranteed to return results. Picking one reloads
 * page 1 with `seller` passed into fetchShopProducts, same as sort/the two checkboxes. Where the
 * route isn't deployed, the dropdown shows "Coming soon" exactly as before rather than an empty
 * list.
 * No price-range filter: the backend left it out on purpose (not real on the website either).
 *
 * Left out on purpose: the "Top Rated" sort (not a real option on the live page — it's the fixed
 * badge text on its cards, so the badge is left out too) and the page's search box (not in scope
 * for this step). Discounted products still get the live "SALE -N%" badge.
 */

// Copy moved into src/i18n/locales/en.json under "shop" (RTL/i18n work, 2026-10-01).

// The live page's three sort options — the only values the backend accepts. Labels come from
// shop.sortOptions.<value> in en.json.
const SORT_OPTIONS: { value: ShopSort }[] = [
  { value: 'popular' },
  { value: 'price_low' },
  { value: 'newest' },
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
  const { t } = useTranslation();
  // From Home's hero chips / category cards (live: /shop?category=<id>).
  const { category } = useLocalSearchParams<{ category?: string }>();
  const categoryId = Number(category) > 0 ? Number(category) : 0;

  const [sort, setSort] = useState<ShopSort>('popular');
  const [freeShipping, setFreeShipping] = useState(false);
  const [warrantyEligible, setWarrantyEligible] = useState(false);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);
  const [sellerId, setSellerId] = useState(0);
  const [sellers, setSellers] = useState<ShopSeller[]>([]);
  const [sellersAvailable, setSellersAvailable] = useState(true); // optimistic until the first reply
  const [sellerPickerOpen, setSellerPickerOpen] = useState(false);
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Fixed 2026-10-01, frontend audit #13 (same fix as Home's plain-alert cart errors): Add to
  // Cart and Load More errors used a native Alert.alert — a placeholder, inconsistent with the
  // app's own inline FormMessage pattern. Shown as a banner above the grid instead.
  const [cartError, setCartError] = useState<string | null>(null);
  const mounted = useRef(true);
  // Only the latest request may update the list (filters can change while one is in flight).
  const requestId = useRef(0);
  const filters = { category: categoryId, seller: sellerId, sort, freeShipping, warrantyEligible };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Loaded once; not re-fetched on filter changes (the seller list itself doesn't depend on them).
  useEffect(() => {
    fetchSellers().then((result) => {
      if (!mounted.current) {
        return;
      }
      if (result.ok) {
        setSellers(result.sellers);
        setSellersAvailable(result.available);
      } else {
        setSellersAvailable(false);
      }
    });
  }, []);

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchShopProducts({
      page: 1,
      category: categoryId,
      seller: sellerId,
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
  }, [categoryId, sellerId, sort, freeShipping, warrantyEligible]);

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
      setCartError(result.message);
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
  const currentSortLabel = t(`shop.sortOptions.${currentSort.value}`);

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
      setCartError(null);
      setCartQuantity(result.cartQuantity);
      router.navigate('/cart');
    } else {
      setCartError(result.message);
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
          <Text style={styles.breadcrumbLink}>{t('shop.home')}</Text>
        </Pressable>
        <Text style={styles.breadcrumbText}> / </Text>
        <Text style={styles.breadcrumbText}>{t('shop.allProducts')}</Text>
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
        <Text style={styles.smartSearchText}>{t('shop.smartSearch')}</Text>
        {/* iOS auto-flips "forward"; android/web name is swapped by hand for RTL. */}
        <SymbolView name={chevronForwardIcon()} size={12} tintColor={Colors.placeholderIcon} />
      </Pressable>

      {categoryId > 0 && !filtersAvailable && (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>{t('shop.categoryNotice')}</Text>
        </View>
      )}

      {/* "All Sellers" — a dropdown toggle on the live phone layout. */}
      <Pressable
        onPress={() => sellersAvailable && setSellerPickerOpen(true)}
        disabled={!sellersAvailable}
        style={[styles.card, styles.sellersToggle, !sellersAvailable && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !sellersAvailable }}
        accessibilityLabel={
          sellersAvailable
            ? `${t('shop.allSellers')}: ${sellerId === 0 ? t('shop.allSellers') : sellers.find((s) => s.id === sellerId)?.name ?? ''}`
            : `${t('shop.allSellers')}, ${t('shop.comingSoon')}`
        }>
        <Text style={styles.sellersText}>
          {sellerId === 0 ? t('shop.allSellers') : sellers.find((s) => s.id === sellerId)?.name ?? t('shop.allSellers')}
        </Text>
        <View style={styles.sellersEnd}>
          {!sellersAvailable && <ComingSoonBadge />}
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
      </Pressable>

      {/* Filters — applied by the backend; disabled on the unfiltered fallback. */}
      <View style={[styles.card, styles.filters]}>
        <View style={styles.filtersHead}>
          <Text style={styles.filtersTitle}>{t('shop.filters')}</Text>
          {!filtersAvailable && <ComingSoonBadge />}
        </View>
        <FilterCheckbox
          label={t('shop.freeShipping')}
          checked={freeShipping}
          disabled={!filtersAvailable}
          onToggle={() => changeFilters(() => setFreeShipping((value) => !value))}
        />
        <FilterCheckbox
          label={t('shop.warrantyEligible')}
          checked={warrantyEligible}
          disabled={!filtersAvailable}
          onToggle={() => changeFilters(() => setWarrantyEligible((value) => !value))}
        />
      </View>

      {/* Header: All Products · N products, and sort */}
      <View style={styles.head}>
        <View style={styles.headTitleRow}>
          <Text style={styles.headTitle}>{t('shop.allProducts')}</Text>
          {/* The backend's total for these filters; on the fallback route (no total) the count
              is shown only once every page is loaded. */}
          {list.status === 'ready' &&
            (list.totalCount !== null ? (
              <Text style={styles.headCount}>
                {t('shop.productCount', { count: list.totalCount })}
              </Text>
            ) : (
              !list.hasNext && (
                <Text style={styles.headCount}>
                  {t('shop.productCount', { count: list.products.length })}
                </Text>
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
              ? `${t('shop.sortBy')}: ${currentSortLabel}`
              : `${currentSortLabel}, ${t('shop.comingSoon')}`
          }>
          <Text style={styles.sortText}>{currentSortLabel}</Text>
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

      {cartError !== null && (
        <View style={styles.cartErrorBox}>
          <FormMessage type="error" message={cartError} />
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
              <Text style={styles.loadMoreText}>
                {loadingMore ? t('shop.loading') : t('shop.loadMore')}
              </Text>
            </Pressable>
          )}
        </>
      )}
      <PickerModal
        visible={sortPickerOpen}
        title={t('shop.sortBy')}
        items={SORT_OPTIONS.map((option) => ({
          key: option.value,
          label: t(`shop.sortOptions.${option.value}`),
        }))}
        selectedKey={sort}
        onSelect={(key) => {
          setSortPickerOpen(false);
          if (key !== sort) {
            changeFilters(() => setSort(key as ShopSort));
          }
        }}
        onClose={() => setSortPickerOpen(false)}
      />
      <PickerModal
        visible={sellerPickerOpen}
        title={t('shop.allSellers')}
        items={[
          { key: '0', label: t('shop.allSellers') },
          ...sellers.map((seller) => ({ key: String(seller.id), label: seller.name })),
        ]}
        selectedKey={String(sellerId)}
        onSelect={(key) => {
          setSellerPickerOpen(false);
          const nextId = Number(key);
          if (nextId !== sellerId) {
            changeFilters(() => setSellerId(nextId));
          }
        }}
        onClose={() => setSellerPickerOpen(false)}
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
  cartErrorBox: {
    marginBottom: 12,
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
