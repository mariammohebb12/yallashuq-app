import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { Fonts, FontSources } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

// Keeps the tabs underneath any screen the app is opened straight into (a shared product link,
// a notification, …), so that screen still has a back button leading to Home.
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

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
      {/* Header titles in Playfair (the site's font for all text), SemiBold like the iOS default. */}
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerTitleStyle: { fontFamily: Fonts.primarySemiBold },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Standalone Login (opened from signup's "Sign in" link, reset password, …): a plain
            header so it has a back button, like the signup screens. The Login shown inside the
            Account tab uses that tab's header instead. */}
        <Stack.Screen name="login" options={{ title: '', headerShadowVisible: false }} />
      </Stack>
    </ThemeProvider>
  );
}
