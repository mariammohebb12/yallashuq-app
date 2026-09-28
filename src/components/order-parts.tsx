import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrderStatus } from '@/api/orders';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

// Pieces shared by the My Orders list and order detail screens.

export const ORDER_COPY = {
  // Confirmed from the live /my/orders and /my/orders/<id> pages.
  return: 'Return',
  rateNow: 'RATE NOW',
  support: 'SUPPORT',
  // COPY FROM THE USER (2026-09-26) for the My Orders list; staging's list shows "RATE NOW".
  editReview: 'Edit Review',
  rateTitle: 'Rate Your Experience',
  supportTitle: 'Need Support',
  returnTitle: 'Return / Reschedule Items',
  // Confirmed from the live product cards.
  soldBy: 'Sold by: ',
  // PLACEHOLDER COPY (not confirmed anywhere).
  sampleDataBanner:
    'Sample data — the orders endpoint is not ready yet. These are not your real orders.',
  // COPY FROM THE USER (2026-09-26).
  sampleDetailBanner: 'Sample data — order details are not your real order',
};

/*
 * PLACEHOLDER COLORS: the live detail page uses Bootstrap badges (info / secondary / success)
 * whose theme colors aren't in the page source, and the list shows no status at all. These use
 * existing app tokens until the badge colors are confirmed.
 */
const STATUS_COLORS: Record<string, { background: string; text: string }> = {
  packing: { background: Colors.inputBorder, text: Colors.mutedText },
  shipped: { background: Colors.activeRowBackground, text: Colors.loadMoreText },
  delivered: { background: Colors.successBackground, text: Colors.successText },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const colors = STATUS_COLORS[status.code] ?? STATUS_COLORS.packing;
  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{status.label}</Text>
    </View>
  );
}

export function SampleDataBanner({ message = ORDER_COPY.sampleDataBanner }: { message?: string }) {
  return (
    <View style={styles.sampleBanner} accessibilityRole="alert">
      <Text style={styles.sampleBannerText}>{message}</Text>
    </View>
  );
}

type ActionKind = 'return' | 'rate' | 'support';

const ACTIONS: Record<ActionKind, { label: string; icon: SymbolViewProps['name'] }> = {
  return: {
    label: ORDER_COPY.return,
    icon: { ios: 'arrowshape.turn.up.left', android: 'reply', web: 'reply' },
  },
  rate: { label: ORDER_COPY.rateNow, icon: { ios: 'star', android: 'star_outline', web: 'star_outline' } },
  support: {
    label: ORDER_COPY.support,
    icon: { ios: 'lifepreserver', android: 'support', web: 'support' },
  },
};

/** Live pill buttons: yellow "Return", teal-outlined "RATE NOW", grey-outlined "SUPPORT". */
export function OrderActionButton({
  kind,
  label: labelOverride,
  onPress,
}: {
  kind: ActionKind;
  label?: string;
  onPress: () => void;
}) {
  const { icon } = ACTIONS[kind];
  const label = labelOverride ?? ACTIONS[kind].label;
  const textColor =
    kind === 'return'
      ? Colors.returnButtonText
      : kind === 'rate'
        ? Colors.reviewLink
        : Colors.helperText;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, styles[kind], pressed && styles.pressed]}>
      <SymbolView name={icon} size={11} tintColor={textColor} />
      <Text style={[styles.actionText, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
  },
  sampleBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  sampleBannerText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.dark,
  },
  // Live: border-radius 20px, font-size 11px, weight 700.
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  actionText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 11,
  },
  return: {
    backgroundColor: Colors.returnButtonBackground,
    borderColor: Colors.returnButtonBorder,
  },
  rate: {
    borderColor: Colors.reviewLink,
  },
  // PENDING CONFIRMATION: live is Bootstrap's btn-outline-secondary (theme color not in source).
  support: {
    borderColor: Colors.iconButtonBorder,
  },
  pressed: {
    opacity: 0.85,
  },
});
