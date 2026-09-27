import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { invoicePdfRequest } from '@/api/invoices';
import { FormMessage } from '@/components/form-message';
import { Colors } from '@/theme/theme';

/*
 * Screen: an invoice's PDF — the live "Download" link (/my/invoices/<id>?report_type=pdf) shown
 * in the app, with the signed-in session cookie. Same approach as the marketplace document viewer
 * (src/app/my/documents/[id].tsx). NOTE: iOS's WebView renders PDFs; Android's doesn't (not
 * handled yet).
 */

const COPY = {
  // PLACEHOLDER COPY (not confirmed anywhere).
  loadError: "This invoice couldn't be loaded. Check your connection and try again.",
};

type Source = { uri: string; headers: Record<string, string> };

export default function InvoicePdfScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [source, setSource] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    invoicePdfRequest(Number(id)).then((request) => {
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
