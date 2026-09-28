import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * The ONE shared look for features the app can't perform yet: a disabled action button and a
 * small "Coming soon" badge. Use these everywhere instead of per-screen styles.
 *
 * APP-ONLY DESIGN: the live site has no disabled / "Coming soon" states to copy. Look chosen by
 * the client (2026-09-27, "Soft orange"), built only from the brand palette:
 * - button: Light Orange at 30% on white, no border, label in Dark at 55%
 * - badge: white pill, Light Orange border, Primary Orange text
 */

// PLACEHOLDER COPY (not confirmed anywhere).
const COMING_SOON = 'Coming soon';

/** Light Orange #ffb36b at 30% over white. */
const DISABLED_FILL = '#ffe8d2';
/** Dark #1b1208 at 55%. */
const DISABLED_LABEL = 'rgba(27, 18, 8, 0.55)';

/** Small pill tag. `label` defaults to "Coming soon" (the Account tab uses "Not available yet"). */
export function ComingSoonBadge({
  label = COMING_SOON,
  style,
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

/** A full-width action that isn't available yet: disabled, with a "Coming soon" badge. Not pressable. */
export function DisabledButton({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[styles.button, style]}
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={`${label}, ${COMING_SOON}`}>
      <Text style={styles.buttonText}>{label}</Text>
      <ComingSoonBadge />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.lightOrange,
    backgroundColor: Colors.white,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 10,
    color: Colors.primaryOrange,
  },
  button: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: DISABLED_FILL,
  },
  buttonText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: DISABLED_LABEL,
  },
});
