import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { fetchShopProducts } from '@/api/catalog';
import { fetchStore, type Store } from '@/api/store';
import { FormMessage } from '@/components/form-message';
import { ProductGrid, type ProductSummary } from '@/components/product-card';
import { setCartQuantity } from '@/state/cart-quantity';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Seller storefront (/store/<seller_id>).
 *
 * APP-ONLY DESIGN: the live site has no store page (GET /store/73 is a 404, 2026-10-01). Scope
 * confirmed by the client: the seller's name and logo (+ product count) — exactly what
 * /store/<id>/json returns (src/api/store.ts). No other seller fields (bio, rating, join date…)
 * exist, so none are shown. Layout reuses Shop's pieces: a white card with the logo, name and
 * count, then the same product grid and "Load More".
 *
 * Products: /shop/products/json with `seller` (fetchShopProducts — the same path as Shop), default
 * sort, no filters. The count is the store route's `product_count`, as the backend gives it.
 *
 * Where the routes aren't deployed (staging, 2026-10-01) the screen says the store isn't
 * available — no sample seller and no unfiltered product list passed off as this seller's.
 * A seller the backend doesn't know shows its own message ("Seller not found").
 *
 * NOT LINKED FROM ANYWHERE YET (2026-10-01): no real data in the app carries a seller id — product
 * cards, Product detail's "Sold by" and Smart Search only have the seller's name; the cart's
 * seller groups and Order Detail's seller exist only in sample data.
 */

const COPY = {
  // Same as Shop (confirmed from the live /shop page).
  productCount: (count: number) => `${count} products`,
  loadMore: 'Load More',
  loading: 'Loading...',
  // PLACEHOLDER COPY (not confirmed anywhere).
  notDeployed: 'This store is not available yet.',
};

type HeaderState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; store: Store };

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; products: ProductSummary[]; hasNext: boolean; nextPage: number };

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sellerId = Number(id) > 0 ? Number(id) : 0;

  const [header, setHeader] = useState<HeaderState>({ status: 'loading' });
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    // Both requests run at the same time.
    const storeRequest = fetchStore(sellerId);
    const productsResult = await fetchShopProducts({ seller: sellerId, page: 1 });
    const storeResult = await storeRequest;
    if (!mounted.current || request !== requestId.current) {
      return;
    }
    setLoadingMore(false);
    if (!storeResult.ok) {
      setHeader({
        status: 'error',
        message: storeResult.notDeployed ? COPY.notDeployed : storeResult.message,
      });
      setList({ status: 'error', message: '' });
      return;
    }
    setHeader({ status: 'ready', store: storeResult.store });
    if (!productsResult.ok) {
      setList({ status: 'error', message: productsResult.message });
    } else if (!productsResult.filtersAvailable) {
      // Unfiltered fallback catalog: these wouldn't be this seller's products.
      setList({ status: 'error', message: COPY.notDeployed });
    } else {
      setList({
        status: 'ready',
        products: productsResult.products,
        hasNext: productsResult.hasNext,
        nextPage: productsResult.nextPage,
      });
    }
  }, [sellerId]);

  // Reloads on every visit, like My Orders / My Returns.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++;
      };
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    if (mounted.current) {
      setRefreshing(false);
    }
  }

  // Same flow as Shop's loadMore.
  async function loadMore() {
    if (list.status !== 'ready' || !list.hasNext || loadingMore) {
      return;
    }
    const request = requestId.current; // A refresh supersedes this page.
    setLoadingMore(true);
    const result = await fetchShopProducts({ seller: sellerId, page: list.nextPage });
    if (!mounted.current || request !== requestId.current) {
      return;
    }
    setLoadingMore(false);
    if (!result.ok) {
      Alert.alert(result.message); // PLACEHOLDER UI, as on Shop.
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

  // Same flow as Shop: real add to cart, then go to the cart as the live site does.
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
      <Stack.Screen options={{ title: header.status === 'ready' ? header.store.name : '' }} />
      {header.status === 'loading' ? (
        <ActivityIndicator style={styles.listLoading} color={Colors.primaryOrange} />
      ) : header.status === 'error' ? (
        <FormMessage type="error" message={header.message} />
      ) : (
        <>
          <View style={[styles.card, styles.storeHeader]}>
            <View style={styles.logo}>
              {header.store.imageUrl ? (
                <Image
                  source={{ uri: header.store.imageUrl }}
                  style={styles.logoImage}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <SymbolView
                  name={{ ios: 'storefront', android: 'storefront', web: 'storefront' }}
                  size={28}
                  tintColor={Colors.primaryOrange}
                />
              )}
            </View>
            <View style={styles.storeText}>
              <Text style={styles.storeName}>{header.store.name}</Text>
              <Text style={styles.storeCount}>{COPY.productCount(header.store.productCount)}</Text>
            </View>
          </View>

          {list.status === 'loading' ? (
            <ActivityIndicator style={styles.listLoading} color={Colors.primaryOrange} />
          ) : list.status === 'error' ? (
            <View style={styles.listMessage}>
              <FormMessage type="error" message={list.message} />
            </View>
          ) : (
            <View style={styles.grid}>
              {/* 2 cards per row on phones, as on Shop. */}
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
                  style={({ pressed }) => [
                    styles.loadMore,
                    (pressed || loadingMore) && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ busy: loadingMore }}>
                  <Text style={styles.loadMoreText}>
                    {loadingMore ? COPY.loading : COPY.loadMore}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// Card, count and "Load More" styles are Shop's (src/app/(tabs)/shop.tsx).
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    // Clears the floating MishMesh launcher (56px + 16px offset) at the end of the page.
    paddingBottom: 88,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  // Same round logo frame as the Account tab's avatar.
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  storeText: {
    flex: 1,
    gap: 4,
  },
  storeName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 20,
    color: Colors.sectionHeading,
  },
  storeCount: {
    fontFamily: Fonts.primaryMedium,
    fontSize: 12,
    color: Colors.subtleText,
  },
  grid: {
    marginTop: 18,
  },
  listMessage: {
    marginTop: 18,
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
