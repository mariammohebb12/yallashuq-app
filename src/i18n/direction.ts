import * as Updates from 'expo-updates';
import { I18nManager, Platform } from 'react-native';

/** The four supported app languages (CLAUDE.md, "Languages"). Translations are not implemented yet. */
export const SUPPORTED_LANGUAGES = ['en', 'ar', 'he', 'ru'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const RTL_LANGUAGES: readonly Language[] = ['ar', 'he'];

export function isRTLLanguage(language: Language): boolean {
  return RTL_LANGUAGES.includes(language);
}

/**
 * Switches the native layout direction to match `language`.
 *
 * React Native only applies a direction change after a full reload, so this reloads the app
 * when the direction actually changes. The native setting persists across launches.
 * Note: Expo Go resets RTL preferences — test direction switching in a development build.
 */
export async function applyLayoutDirection(language: Language): Promise<void> {
  const shouldBeRTL = isRTLLanguage(language);
  if (Platform.OS === 'web' || shouldBeRTL === I18nManager.isRTL) {
    return;
  }
  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.forceRTL(shouldBeRTL);
  await Updates.reloadAsync();
}
