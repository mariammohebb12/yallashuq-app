import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Colors } from '@/theme/theme';

// Placeholder — not built yet (opened from the Account tab). Live page: /my/gift-cards (sign-in required).
export default function GiftCardsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.pageBackground }}>
      <Stack.Screen options={{ title: 'Gift & Vouchers' }} />
    </View>
  );
}
