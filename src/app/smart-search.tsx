import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { smartSearch, type SmartSearchResult } from '@/api/smart-search';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Smart Search — the live /inventory/search page ("Inventory Intelligence"), opened from
 * the Shop tab (the live site doesn't link to it anywhere).
 *
 * REAL: results come from /inventory/search/query (src/api/smart-search.ts). Same behaviour as
 * the live page: searches as you type (from 2 characters, 280 ms after the last keystroke), shows
 * "N items discovered", or "No Matches Found".
 *
 * Deliberately NOT called "AI" anywhere, and nothing implies natural-language understanding
 * (client decision 2026-09-28): the route is keyword matching. Differences from the live page:
 * "AI-POWERED SEARCH" badge → "SMART SEARCH"; intro, placeholder, the ready text and the end of
 * the no-match text reworded to keyword-search framing. The rest is the live page's wording.
 *
 * Result cards follow the live card: image, category, stock badge, name, seller, price,
 * "View Details" (opens the app's product screen). No add-to-cart here — the route gives no
 * variant id, and the live card has none either. The live card's affiliate variants
 * ("AliExpress Affiliate", "Buy on AliExpress") aren't built: no result has them on staging.
 */

const COPY = {
  // App wording (client 2026-09-28): honest keyword-search framing, never "AI".
  title: 'Smart Search',
  badge: 'SMART SEARCH',
  intro: 'The smarter way to find products. Search by category, name, or feature.',
  placeholder: 'e.g. black dining table',
  readyText: 'Start typing above to search.',
  noMatchText: (query: string) =>
    `We couldn't find any products matching "${query}". Try different keywords.`,
  // Confirmed from the live /inventory/search page and its script.
  heading: 'Inventory Intelligence',
  readyTitle: 'Ready to Scan',
  loading: 'Analyzing Catalogue...',
  count: (n: number) => `${n} items discovered`,
  noMatchTitle: 'No Matches Found',
  general: 'General',
  inStock: 'In Stock',
  outOfStock: 'Out of Stock',
  merchant: 'YallaShuq Merchant',
  uponRequest: 'Upon Request',
  viewDetails: 'View Details',
};

const MIN_CHARS = 2;
const DEBOUNCE_MS = 280;

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; query: string; results: SmartSearchResult[] };

export default function SmartSearchScreen() {
  const [text, setText] = useState('');
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const requestId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Leaving the screen: cancel the pending search and drop any answer still on its way.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      requestId.current++;
    },
    []
  );

  function onChangeText(value: string) {
    setText(value);
    clearTimeout(timer.current);
    const id = ++requestId.current; // Any older request's answer is ignored from now on.
    const query = value.trim();
    if (query.length < MIN_CHARS) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    timer.current = setTimeout(async () => {
      const result = await smartSearch(query);
      if (id !== requestId.current) {
        return;
      }
      setState(
        result.ok
          ? { status: 'ready', query, results: result.results }
          : { status: 'error', message: result.message }
      );
    }, DEBOUNCE_MS);
  }

  function openProduct(product: SmartSearchResult) {
    router.push({ pathname: '/product/[id]', params: { id: String(product.id) } });
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: COPY.title }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ---- Hero ---- */}
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{COPY.badge}</Text>
          </View>
          <Text style={styles.heading}>{COPY.heading}</Text>
          <Text style={styles.intro}>{COPY.intro}</Text>
        </View>

        {/* ---- Search box ---- */}
        <View style={styles.searchBox}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={16}
            tintColor={Colors.primaryOrange}
          />
          <TextInput
            style={styles.searchInput}
            value={text}
            onChangeText={onChangeText}
            placeholder={COPY.placeholder}
            placeholderTextColor={Colors.placeholderIcon}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel={COPY.title}
          />
        </View>

        {/* ---- Results ---- */}
        {state.status === 'idle' && (
          <View style={styles.centered}>
            <Text style={styles.stateTitle}>{COPY.readyTitle}</Text>
            <Text style={styles.stateText}>{COPY.readyText}</Text>
          </View>
        )}
        {state.status === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primaryOrange} size="large" />
            <Text style={styles.stateText}>{COPY.loading}</Text>
          </View>
        )}
        {state.status === 'error' && (
          <View style={styles.errorBox}>
            <FormMessage type="error" message={state.message} />
          </View>
        )}
        {state.status === 'ready' &&
          (state.results.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.stateTitle}>{COPY.noMatchTitle}</Text>
              <Text style={styles.stateText}>{COPY.noMatchText(state.query)}</Text>
            </View>
          ) : (
            <>
              <View style={styles.countRow}>
                <View style={styles.countPill}>
                  <Text style={styles.countText}>{COPY.count(state.results.length)}</Text>
                </View>
              </View>
              <View style={styles.results}>
                {state.results.map((product) => (
                  <ResultCard key={product.id} product={product} onOpen={openProduct} />
                ))}
              </View>
            </>
          ))}
      </ScrollView>
    </View>
  );
}

function ResultCard({
  product,
  onOpen,
}: {
  product: SmartSearchResult;
  onOpen: (product: SmartSearchResult) => void;
}) {
  return (
    <Pressable
      onPress={() => onOpen(product)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${COPY.viewDetails}`}>
      <View style={styles.imageWrap}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} contentFit="contain" />
        ) : (
          <SymbolView
            name={{ ios: 'photo', android: 'image', web: 'image' }}
            size={32}
            tintColor={Colors.placeholderIcon}
          />
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.badgeRow}>
          <Text style={styles.category} numberOfLines={1}>
            {product.category ?? COPY.general}
          </Text>
          <Text style={[styles.stock, !product.inStock && styles.stockOut]}>
            {product.inStock ? COPY.inStock : COPY.outOfStock}
          </Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.sellerRow}>
          <SymbolView
            name={{ ios: 'storefront', android: 'store', web: 'store' }}
            size={11}
            tintColor={Colors.helperText}
          />
          <Text style={styles.seller} numberOfLines={1}>
            {product.seller ?? COPY.merchant}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.price} numberOfLines={1}>
            {product.priceLabel ?? COPY.uponRequest}
          </Text>
          <View style={styles.viewButton}>
            <Text style={styles.viewButtonText}>{COPY.viewDetails}</Text>
          </View>
        </View>
      </View>
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
    paddingTop: 16,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: Colors.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  badgeText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: Colors.dark,
  },
  heading: {
    fontFamily: Fonts.primaryBold,
    fontSize: 24,
    color: Colors.sectionHeading,
    textAlign: 'center',
  },
  intro: {
    marginTop: 8,
    fontFamily: Fonts.primary,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedText,
    textAlign: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
    textAlign: 'auto',
  },
  centered: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  stateTitle: {
    fontFamily: Fonts.primaryBold,
    fontSize: 18,
    color: Colors.sectionHeading,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedText,
    textAlign: 'center',
  },
  errorBox: {
    marginTop: 16,
  },
  countRow: {
    flexDirection: 'row',
    marginTop: 18,
    marginBottom: 10,
  },
  countPill: {
    borderRadius: 999,
    backgroundColor: Colors.dark,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  countText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.white,
  },
  results: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.inputBorder,
  },
  imageWrap: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  cardBody: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  category: {
    flexShrink: 1,
    fontFamily: Fonts.secondary,
    fontSize: 10,
    color: Colors.helperText,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
    paddingVertical: 1,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  stock: {
    fontFamily: Fonts.primaryBold,
    fontSize: 10,
    color: Colors.verifiedText,
  },
  stockOut: {
    color: Colors.errorText,
  },
  name: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    lineHeight: 19,
    color: Colors.sectionHeading,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seller: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 12,
    color: Colors.helperText,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.inputBorder,
  },
  price: {
    flexShrink: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.primaryOrange,
  },
  viewButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.dark,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  viewButtonText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.dark,
  },
  pressed: {
    opacity: 0.85,
  },
});
