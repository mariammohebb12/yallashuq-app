import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Colors } from '@/theme/theme';

// Placeholder — not built yet (opened from the Account tab). Live page: /my/marketplace/documents (sign-in required).
export default function MarketplaceDocumentsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.pageBackground }}>
      <Stack.Screen options={{ title: 'Marketplace Documents' }} />
    </View>
  );
}
