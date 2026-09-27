import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loginWithPassword } from '@/api/auth';
import { REQUIRED_MESSAGE } from '@/components/form-fields';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

// Screen 5: Login. Layout, copy and styles mirror yallashuq.com/web/login.
// Submits to the Odoo backend via loginWithPassword (see src/api/auth.ts — currently a TEMPORARY
// HTML-scraping workaround). Error/info messages shown here are the backend's own text.
type LoginScreenProps = {
  /**
   * Set when Login is shown inside the Account tab (signed out) instead of as its own screen:
   * called after a successful login instead of going to Home, and the tab header already covers
   * the top safe area.
   */
  onSignedIn?: () => void;
};

export default function LoginScreen({ onSignedIn }: LoginScreenProps = {}) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [missingLogin, setMissingLogin] = useState(false);
  const [missingPassword, setMissingPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<'login' | 'password' | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [infoMessage, setInfoMessage] = useState<string>();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function handleSubmit() {
    if (submitting) {
      return;
    }
    const loginEmpty = login.trim() === '';
    const passwordEmpty = password === '';
    setMissingLogin(loginEmpty);
    setMissingPassword(passwordEmpty);
    if (loginEmpty || passwordEmpty) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(undefined);
    setInfoMessage(undefined);
    // No local cart state is touched here: the backend merges the guest cart into the account
    // server-side, using the session cookie sent with this request.
    const result = await loginWithPassword(login, password);
    if (!mounted.current) {
      return;
    }
    setSubmitting(false);

    if (result.kind === 'success') {
      // Confirmed: land on the Home tab after login.
      if (onSignedIn) {
        onSignedIn();
      } else {
        router.replace('/');
      }
    } else if (result.kind === 'info') {
      setInfoMessage(result.message);
    } else {
      setErrorMessage(result.message);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={onSignedIn ? ['bottom', 'left', 'right'] : undefined}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image
            source={require('@/assets/images/logo.jpg')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="YallaShuq"
          />

          <View style={styles.header}>
            <Text style={styles.heading}>Sign in to your account</Text>
            <Text style={styles.subtext}>Enter your credentials to continue</Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, styles.labelSpacing]}>Email or Phone</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === 'login' && styles.inputFocused,
                missingLogin && styles.inputInvalid,
              ]}
              value={login}
              onChangeText={(text) => {
                setLogin(text);
                setMissingLogin(false);
              }}
              placeholder="john@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              editable={!submitting}
              onFocus={() => setFocusedField('login')}
              onBlur={() => setFocusedField(null)}
            />
            {missingLogin && <Text style={styles.fieldNote}>{REQUIRED_MESSAGE}</Text>}
          </View>

          <View style={styles.field}>
            <View style={[styles.passwordLabelRow, styles.labelSpacing]}>
              <Text style={styles.label}>Password</Text>
              <Pressable onPress={() => router.push('/reset-password')} hitSlop={8}>
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>
            </View>
            <View>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  focusedField === 'password' && styles.inputFocused,
                  missingPassword && styles.inputInvalid,
                ]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setMissingPassword(false);
                }}
                placeholder="Enter your password"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                maxLength={4096}
                editable={!submitting}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setPasswordVisible((visible) => !visible)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                <SymbolView
                  name={
                    passwordVisible
                      ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
                      : { ios: 'eye', android: 'visibility', web: 'visibility' }
                  }
                  size={20}
                  tintColor={Colors.placeholderIcon}
                />
              </Pressable>
            </View>
            {missingPassword && <Text style={styles.fieldNote}>{REQUIRED_MESSAGE}</Text>}
          </View>

          {/* Backend messages; each is hidden while empty. */}
          <FormMessage type="error" message={errorMessage} />
          <FormMessage type="success" message={infoMessage} />

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              submitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}>
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account?</Text>
            <View style={styles.signupRow}>
              <Pressable onPress={() => router.push('/signup-customer')} hitSlop={8}>
                <Text style={styles.footerLink}>Signup as Customer</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable onPress={() => router.push('/signup-seller')} hitSlop={8}>
                <Text style={styles.footerLink}>Signup as Seller</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  logo: {
    alignSelf: 'center',
    width: 200,
    aspectRatio: 1558 / 784,
    marginBottom: 24,
  },
  header: {
    marginBottom: 40,
  },
  heading: {
    fontFamily: Fonts.primary,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.64,
    color: Colors.dark,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    color: Colors.mutedText,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark,
  },
  labelSpacing: {
    marginBottom: 8,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotLink: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryOrange,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 16,
    fontFamily: Fonts.primary,
    fontSize: 16,
    color: Colors.dark,
  },
  inputFocused: {
    borderColor: Colors.primaryOrange,
    backgroundColor: Colors.white,
  },
  inputInvalid: {
    borderColor: Colors.errorText,
  },
  fieldNote: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.errorText,
    marginTop: 6,
  },
  passwordInput: {
    paddingEnd: 48,
  },
  eyeButton: {
    position: 'absolute',
    end: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  submitButton: {
    height: 54,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: Fonts.primary,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.mutedText,
    marginBottom: 8,
  },
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerLink: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primaryOrange,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.inputBorder,
  },
});
