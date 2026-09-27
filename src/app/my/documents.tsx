import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchMarketplaceDocuments, type MarketplaceDocument } from '@/api/documents';
import { FormMessage } from '@/components/form-message';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Marketplace Documents — the live /my/marketplace/documents page (opened from the
 * Account tab's documents card).
 *
 * ⚠️ BLOCKED ON BACKEND — THE LIST IS TEMPORARY MOCK DATA, NOT READY TO GO LIVE ⚠️
 * No JSON route for the list (see src/api/documents.ts, #007); fetchMarketplaceDocuments returns
 * sample data and this screen shows a visible "sample data" banner.
 *
 * Like the live page: one flat list, no pagination, filters, search or sorting, in the backend's
 * order. Each row: Order, Type, Date (MM/DD/YYYY, as the backend formats it) and "View / Download",
 * which opens the real PDF in the app (src/app/my/documents/[id].tsx), like the live site shows it
 * in the browser. Not shown (not asked for this step): the live Issuer and Number columns.
 */

const COPY = {
  // Confirmed from the live /my/marketplace/documents page.
  heading: 'My Marketplace Documents',
  viewDownload: 'View / Download',
  // PLACEHOLDER COPY (not confirmed anywhere).
  title: 'Marketplace Documents',
  sampleData: 'Sample data — the documents endpoint is not ready yet',
  empty: 'There are no documents for your account yet.',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; documents: MarketplaceDocument[]; isSampleData: boolean };

export default function MarketplaceDocumentsScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchMarketplaceDocuments();
    if (id !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', documents: result.documents, isSampleData: result.isSampleData }
        : { status: 'error', message: result.message }
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++;
      };
    }, [load])
  );

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: COPY.title }} />
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {state.status === 'ready' && state.isSampleData && (
            <SampleDataBanner message={COPY.sampleData} />
          )}
          <Text style={styles.heading}>{COPY.heading}</Text>

          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : state.documents.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{COPY.empty}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {state.documents.map((document) => (
                <DocumentCard key={document.id} document={document} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function DocumentCard({ document }: { document: MarketplaceDocument }) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.orderName}>{document.orderName}</Text>
        <Text style={styles.type}>{document.type.label}</Text>
        <Text style={styles.date}>{document.dateFormatted}</Text>
      </View>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/my/documents/[id]',
            params: { id: String(document.id), title: document.orderName },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`${COPY.viewDownload}, ${document.type.label}, ${document.orderName}`}
        style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}>
        <Text style={styles.viewButtonText}>{COPY.viewDownload}</Text>
      </Pressable>
    </View>
  );
}

// Same page, heading and card styles as My Orders.
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
    paddingBottom: 32,
  },
  heading: {
    fontFamily: Fonts.primary,
    fontSize: 26,
    fontWeight: '800',
    color: Colors.sectionHeading,
    marginBottom: 14,
  },
  emptyBox: {
    borderRadius: 16,
    backgroundColor: Colors.white,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.mutedText,
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  orderName: {
    fontFamily: Fonts.primary,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.dark,
  },
  type: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark,
  },
  date: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.helperText,
  },
  // Live: a small primary button (btn-sm btn-primary).
  viewButton: {
    borderRadius: 10,
    backgroundColor: Colors.primaryOrange,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  viewButtonText: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
