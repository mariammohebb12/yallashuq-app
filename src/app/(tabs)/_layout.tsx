import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View, type ColorValue } from 'react-native';

import { MishMeshAssistant } from '@/components/mishmesh-chat';
import { NotificationBell } from '@/components/notification-bell';
import { useCartQuantity } from '@/state/cart-quantity';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

// Tab labels are hardcoded English placeholders until translations are added.
// Tab icons: standard SF Symbols (iOS) / Material icons (Android) — outline when inactive, filled
// when active. App-chosen, not from the live site (which has no bottom tab bar).
function tabIcon(ios: string, iosActive: string, android: string) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    const name = {
      ios: focused ? iosActive : ios,
      android,
      web: android,
    } as SymbolViewProps['name'];
    return <SymbolView name={name} size={24} tintColor={color} />;
  };
}

export default function TabLayout() {
  const cartQuantity = useCartQuantity();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primaryOrange,
        tabBarInactiveTintColor: Colors.mutedText,
        // Playfair (the site's font for all text), at the same weights the defaults use.
        headerTitleStyle: { fontFamily: Fonts.primarySemiBold },
        tabBarLabelStyle: { fontFamily: Fonts.primaryMedium },
        // Notification inbox bell (app-only; signed-in customers only — see notification-bell.tsx).
        headerRight: () => <NotificationBell />,
      }}
      // The MishMesh launcher floats over every main screen (as on every page of the live site),
      // just above the tab bar.
      screenLayout={({ children }) => (
        <View style={{ flex: 1 }}>
          {children}
          <MishMeshAssistant />
        </View>
      )}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('house', 'house.fill', 'home') }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: 'Shop', tabBarIcon: tabIcon('bag', 'bag.fill', 'shopping_bag') }}
      />
      {/* Badge = the backend's cart_quantity (the live site's header cart count). */}
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: tabIcon('cart', 'cart.fill', 'shopping_cart'),
          tabBarBadge: cartQuantity > 0 ? cartQuantity : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.primaryOrange },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: tabIcon('person', 'person.fill', 'person') }}
      />
    </Tabs>
  );
}
