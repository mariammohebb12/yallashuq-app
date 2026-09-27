import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

type Props = {
  type: 'error' | 'success';
  /** Nothing is rendered while this is empty. */
  message?: string;
};

export function FormMessage({ type, message }: Props) {
  if (!message) {
    return null;
  }
  const isError = type === 'error';
  return (
    <View
      accessibilityRole="alert"
      style={[styles.container, isError ? styles.errorContainer : styles.successContainer]}>
      <Text style={[styles.text, { color: isError ? Colors.errorText : Colors.successText }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: Colors.errorBackground,
    borderColor: Colors.errorBorder,
  },
  successContainer: {
    backgroundColor: Colors.successBackground,
    borderColor: Colors.successBorder,
  },
  text: {
    fontFamily: Fonts.primary,
    fontSize: 15,
  },
});
