import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Colors } from '@/theme/theme';

// Placeholder — no content until this screen is confirmed and built.
export default function ResetPasswordScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <Stack.Screen options={{ title: 'Reset Password' }} />
    </View>
  );
}
