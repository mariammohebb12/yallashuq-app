import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/**
 * Shared form building blocks, styled like the live site's auth forms
 * (52px, 12px radius, #e5e5e5 border, #fafafa background, orange border + white background on focus).
 */

// PLACEHOLDER COPY: not confirmed from the live site (it relies on the browser's native
// "required" message). Replace once real copy/translations exist.
export const REQUIRED_MESSAGE = 'This field is required.';

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** Red note under an invalid field. */
export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <Text style={styles.errorText}>{message}</Text>;
}

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Turns the border red and shows the message under the input. */
  error?: string;
  /** Rendered under the input (e.g. a "Verify" link). */
  footer?: ReactNode;
};

export function TextField({ label, error, footer, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const readOnly = inputProps.editable === false;
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        placeholderTextColor={Colors.placeholderIcon}
        {...inputProps}
        style={[
          styles.box,
          styles.input,
          focused && !readOnly && styles.boxFocused,
          error !== undefined && styles.boxInvalid,
          readOnly && styles.readOnly,
        ]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      <FieldError message={error} />
      {footer}
    </View>
  );
}

type PressableFieldProps = {
  label: string;
  /** Shown in muted text while `value` is empty. */
  placeholder?: string;
  value?: string;
  icon: 'chevron' | 'calendar' | 'file';
  error?: string;
  disabled?: boolean;
  onPress: () => void;
};

/** A field that opens a picker (dropdown, date, file) instead of the keyboard. */
export function PressableField({
  label,
  placeholder,
  value,
  icon,
  error,
  disabled,
  onPress,
}: PressableFieldProps) {
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        style={[
          styles.box,
          styles.pressableBox,
          error !== undefined && styles.boxInvalid,
          disabled && styles.readOnly,
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}>
        <Text style={[styles.inputText, !value && styles.placeholderText]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <SymbolView
          name={
            icon === 'chevron'
              ? { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }
              : icon === 'calendar'
                ? { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }
                : { ios: 'paperclip', android: 'attach_file', web: 'attach_file' }
          }
          size={16}
          tintColor={Colors.placeholderIcon}
        />
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

/** Orange text link shown under a field, e.g. "Verify". */
export function FieldLink({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.fieldLink}>
      <Text style={styles.fieldLinkText}>{children}</Text>
    </Pressable>
  );
}

/** Green "Verified" badge that replaces a "Verify" link (live site: .ysq-verified-badge). */
export function VerifiedBadge() {
  return (
    <View style={styles.verifiedBadge} accessibilityLabel="Verified">
      <SymbolView
        name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
        size={14}
        tintColor={Colors.verifiedText}
      />
      <Text style={styles.verifiedText}>Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
    marginBottom: 8,
  },
  box: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
  },
  boxFocused: {
    borderColor: Colors.primaryOrange,
    backgroundColor: Colors.white,
  },
  boxInvalid: {
    borderColor: Colors.errorText,
  },
  // Read-only / disabled fields are dimmed, like the live site's verified phone field.
  readOnly: {
    opacity: 0.7,
  },
  input: {
    paddingHorizontal: 16,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
  pressableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  inputText: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
  placeholderText: {
    color: Colors.placeholderIcon,
  },
  errorText: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.errorText,
    marginTop: 6,
  },
  fieldLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  fieldLinkText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    color: Colors.primaryOrange,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  verifiedText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.verifiedText,
  },
});
