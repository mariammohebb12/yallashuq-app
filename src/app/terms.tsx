import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { FormMessage } from '@/components/form-message';
import { Colors } from '@/theme/theme';

/*
 * Screen: Terms & Conditions — the live site's terms page shown as-is in a WebView (nothing is
 * fetched, parsed or rewritten by the app). Opened from Order Detail's "Terms & Conditions" link;
 * the header's back arrow returns there.
 *
 * Always the LIVE page (asked for explicitly), even while the app's backend points at staging.
 */

const TERMS_URL = 'https://yallashuq.com/terms';

const COPY = {
  // Confirmed from the live order page's link text.
  title: 'Terms & Conditions',
  // PLACEHOLDER COPY (not confirmed anywhere).
  loadError: "The terms page couldn't be loaded. Check your connection and try again.",
};

export default function TermsScreen() {
  const [failed, setFailed] = useState(false);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: COPY.title }} />
      {failed ? (
        <View style={styles.errorBox}>
          <FormMessage type="error" message={COPY.loadError} />
        </View>
      ) : (
        <WebView
          source={{ uri: TERMS_URL }}
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
