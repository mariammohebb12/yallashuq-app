import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { FontSources } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

// Default text color for navigation UI (headers, tab labels) is the brand dark.
const NavigationTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, text: Colors.dark },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FontSources);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={NavigationTheme}>
      {/* Back buttons show only the arrow, so no unconfirmed screen titles appear in them. */}
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
