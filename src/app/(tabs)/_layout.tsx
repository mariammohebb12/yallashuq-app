import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { MishMeshAssistant } from '@/components/mishmesh-chat';
import { useCartQuantity } from '@/state/cart-quantity';
import { Colors } from '@/theme/theme';

// Tab labels are hardcoded English placeholders until translations are added.
// Tab icons are intentionally omitted until confirmed.
export default function TabLayout() {
  const cartQuantity = useCartQuantity();
  return (
    <Tabs
      screenOptions={{ tabBarActiveTintColor: Colors.primaryOrange }}
      // The MishMesh launcher floats over every main screen (as on every page of the live site),
      // just above the tab bar.
      screenLayout={({ children }) => (
        <View style={{ flex: 1 }}>
          {children}
          <MishMeshAssistant />
        </View>
      )}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
      {/* Badge = the backend's cart_quantity (the live site's header cart count). */}
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarBadge: cartQuantity > 0 ? cartQuantity : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.primaryOrange },
        }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
