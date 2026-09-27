import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * PLACEHOLDER UI: stands in for a live-site popup/flow the app can't perform yet (e.g. My Orders'
 * "Rate Now" and "Support", whose live forms aren't JSON-based). Shows the live popup's title and
 * a "not available yet" note. Replace per feature once its backend route exists.
 */

// PLACEHOLDER COPY (not confirmed anywhere).
const COPY = {
  message: "This isn't available in the app yet.",
  close: 'Close',
};

type Props = {
  /** Title of the live popup this stands in for; null hides the modal. */
  title: string | null;
  /** Optional extra line, e.g. which order it's about. */
  detail?: string;
  onClose: () => void;
};

export function PlaceholderModal({ title, detail, onClose }: Props) {
  return (
    <Modal visible={title !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={COPY.close}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={16}
                tintColor={Colors.dark}
              />
            </Pressable>
          </View>
          {detail !== undefined && <Text style={styles.detail}>{detail}</Text>}
          <Text style={styles.message}>{COPY.message}</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            accessibilityRole="button">
            <Text style={styles.buttonText}>{COPY.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark,
  },
  detail: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.helperText,
  },
  message: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.mutedText,
  },
  button: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
  },
  buttonText: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark,
  },
  pressed: {
    opacity: 0.85,
  },
});
