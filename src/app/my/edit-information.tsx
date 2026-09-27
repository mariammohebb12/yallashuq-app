import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Colors } from '@/theme/theme';

// Placeholder — not built yet (opened from the Account tab). Live page: /my/account (sign-in required).
export default function EditInformationScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.pageBackground }}>
      <Stack.Screen options={{ title: 'Edit information' }} />
    </View>
  );
}
