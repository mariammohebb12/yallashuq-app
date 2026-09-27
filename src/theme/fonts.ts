import type { FontSource } from 'expo-font';

import { FontFamily } from './theme';

/**
 * Font files loaded at startup by `useFonts` in the root layout.
 *
 * PLACEHOLDER: the font files haven't been provided yet. When they arrive, put them in
 * `assets/fonts/` and register them here, e.g.
 *
 *   [FontFamily.primary]: require('@/assets/fonts/<playfair-file>.ttf'),
 *   [FontFamily.secondary]: require('@/assets/fonts/<archivo-file>.ttf'),
 *
 * (Weights/italics each need their own entry and family name once we know which files exist.)
 * While this map is empty, text falls back to the platform default font.
 */
export const FontSources: Partial<Record<(typeof FontFamily)[keyof typeof FontFamily], FontSource>> =
  {};

/**
 * Use these in styles instead of `FontFamily` directly. A family resolves to `undefined` (platform
 * default) until its file is registered above, which avoids "font not loaded" warnings.
 */
export const Fonts = {
  primary: FontSources[FontFamily.primary] ? FontFamily.primary : undefined,
  secondary: FontSources[FontFamily.secondary] ? FontFamily.secondary : undefined,
} as const;
