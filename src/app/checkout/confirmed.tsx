import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * PLACEHOLDER SCREEN: "Order Confirmed" after "Pay now" on the Payment step.
 * Nothing was processed — no payment, no order was created (see payment.tsx). The real
 * confirmation (order number, payment status) comes with the real payment integration.
 * No back button / swipe back: the checkout steps behind it are finished.
 */

// COPY FROM THE USER (2026-09-26).
const COPY = {
  title: 'Order Confirmed',
  message: 'Thank you! Your order has been placed',
  // PLACEHOLDER COPY (not confirmed anywhere).
  backHome: 'Back to Home',
};

export default function OrderConfirmedScreen() {
  function goHome() {
    router.dismissAll();
    router.navigate('/');
  }

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{ title: COPY.title, headerBackVisible: false, gestureEnabled: false }}
      />
      <View style={styles.checkCircle}>
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          size={44}
          weight="bold"
          tintColor={Colors.white}
        />
      </View>
      <Text style={styles.message}>{COPY.message}</Text>
      <Pressable
        onPress={goHome}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{COPY.backHome}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 24,
    backgroundColor: Colors.white,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.verifiedText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontFamily: Fonts.primaryBold,
    fontSize: 22,
    textAlign: 'center',
    color: Colors.dark,
  },
  button: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 17,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
