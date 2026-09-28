import type { FontSource } from 'expo-font';

import { FontFamily } from './theme';

/**
 * Font files loaded at startup by `useFonts` in the root layout (the splash screen stays up until
 * they're ready, so text never flashes in the system font).
 *
 * The four Playfair Display files are the live site's own; Archivo Regular is from Google Fonts
 * (see `FontFamily` in ./theme.ts).
 */
export const FontSources: Partial<Record<(typeof FontFamily)[keyof typeof FontFamily], FontSource>> =
  {
    [FontFamily.primary]: require('@/assets/fonts/PlayfairDisplay-Regular.ttf'),
    [FontFamily.primaryMedium]: require('@/assets/fonts/PlayfairDisplay-Medium.ttf'),
    [FontFamily.primarySemiBold]: require('@/assets/fonts/PlayfairDisplay-SemiBold.ttf'),
    [FontFamily.primaryBold]: require('@/assets/fonts/PlayfairDisplay-Bold.ttf'),
    [FontFamily.primaryItalic]: require('@/assets/fonts/PlayfairDisplay-Italic.ttf'),
    [FontFamily.secondary]: require('@/assets/fonts/Archivo-Regular.ttf'),
    [FontFamily.secondaryBold]: require('@/assets/fonts/Archivo-Bold.ttf'),
  };

function registered(family: (typeof FontFamily)[keyof typeof FontFamily]) {
  return FontSources[family] ? family : undefined;
}

/**
 * Use these in styles instead of `FontFamily` directly. A family resolves to `undefined` (platform
 * default) when its file isn't registered above, which avoids "font not loaded" warnings.
 *
 * Pick the family for the weight instead of setting `fontWeight` (which would fake-bold on top):
 * 400 → primary, 500 → primaryMedium, 600 → primarySemiBold, 700/800 → primaryBold.
 */
export const Fonts = {
  primary: registered(FontFamily.primary),
  primaryMedium: registered(FontFamily.primaryMedium),
  primarySemiBold: registered(FontFamily.primarySemiBold),
  primaryBold: registered(FontFamily.primaryBold),
  primaryItalic: registered(FontFamily.primaryItalic),
  secondary: registered(FontFamily.secondary),
  secondaryBold: registered(FontFamily.secondaryBold),
} as const;
