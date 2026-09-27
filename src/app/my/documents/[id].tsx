import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { marketplaceDocumentRequest } from '@/api/documents';
import { FormMessage } from '@/components/form-message';
import { Colors } from '@/theme/theme';

/*
 * Screen: one marketplace document — the real /my/marketplace/document/<id> PDF, shown in the app
 * the way the website's "View / Download" shows it in the browser (inline, not saved as a file).
 * Opened from the Marketplace Documents list; the header's back arrow returns there.
 *
 * The route needs sign-in, so the WebView's request carries the app's session cookie. A signed-out
 * app, or a document that isn't this customer's, gets the website's login page / 404 instead.
 * NOTE: iOS's WebView renders PDFs; Android's doesn't (not handled yet).
 */

const COPY = {
  // PLACEHOLDER COPY (not confirmed anywhere).
  loadError: "This document couldn't be loaded. Check your connection and try again.",
};

type Source = { uri: string; headers: Record<string, string> };

export default function MarketplaceDocumentScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [source, setSource] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    marketplaceDocumentRequest(Number(id)).then((request) => {
      if (active) {
        setSource(request);
      }
    });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: title ?? '' }} />
      {failed ? (
        <View style={styles.errorBox}>
          <FormMessage type="error" message={COPY.loadError} />
        </View>
      ) : source === null ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <WebView
          source={source}
          style={styles.page}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.centered]}>
              <ActivityIndicator color={Colors.primaryOrange} />
            </View>
          )}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

// Same as the Terms screen's WebView.
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  errorBox: {
    padding: 16,
  },
});
