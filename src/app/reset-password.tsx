import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DisabledButton } from '@/components/coming-soon';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Forgot Password — the live /web/reset_password page (opened by "Forgot password?" on the
 * Login screen, which sits on the Password label row exactly as on the live login form).
 *
 * ⚠️ SENDING ISN'T AVAILABLE — THE FIELD AND BUTTON ARE DISABLED ⚠️
 * The live form is a plain HTML POST to /web/reset_password (field `login` + csrf_token) that
 * re-renders the page; a JSON call or a post without the token → 400 (checked on staging
 * 2026-09-27). No reset was triggered for any real account. Blocked on
 * docs/backend-requests/012-password-reset-json.md.
 *
 * Only step 1 exists on the page (email or phone → "Send Reset Link / OTP"). What follows — the
 * emailed link's "new password" page or a WhatsApp OTP step — couldn't be seen without triggering a
 * real reset, so it isn't built. Like the Login screen, this mirrors the live form panel; the live
 * page's left panel ("Forgot Password?", "Secure Recovery", "Email/WhatsApp Verification") isn't
 * shown, except its heading as the screen title.
 */

const COPY = {
  // Confirmed from the live /web/reset_password page.
  title: 'Forgot Password?',
  heading: 'Reset your password',
  subtext: 'Enter your account email or phone number',
  label: 'Email or Phone Number',
  placeholder: 'john@example.com or 9715xxxxxxx',
  submit: 'Send Reset Link / OTP',
  backToLogin: 'Back to Login',
  // PLACEHOLDER COPY (not confirmed anywhere).
  notAvailable: 'Resetting your password from the app isn’t available yet',
};

export default function ResetPasswordScreen() {
  function backToLogin() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: COPY.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SampleDataBanner message={COPY.notAvailable} />

        <Image
          source={require('@/assets/images/logo.jpg')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="YallaShuq"
        />

        <View style={styles.header}>
          <Text style={styles.heading}>{COPY.heading}</Text>
          <Text style={styles.subtext}>{COPY.subtext}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{COPY.label}</Text>
          <TextInput
            style={styles.input}
            placeholder={COPY.placeholder}
            placeholderTextColor={Colors.placeholderIcon}
            editable={false}
            accessibilityLabel={COPY.label}
          />
        </View>

        {/* Blocked on docs/backend-requests/012-password-reset-json.md. Not pressable. */}
        <DisabledButton label={COPY.submit} />

        <Pressable
          onPress={backToLogin}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.backLink}>
          <Text style={styles.backLinkText}>{COPY.backToLogin}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// Logo, heading, label and input match the Login screen; the disabled button matches the other
// "Coming soon" screens.
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  logo: {
    alignSelf: 'center',
    width: 200,
    aspectRatio: 1558 / 784,
    marginTop: 16,
    marginBottom: 24,
  },
  header: {
    marginBottom: 32,
  },
  heading: {
    fontFamily: Fonts.primaryBold,
    fontSize: 32,
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
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.dark,
    marginBottom: 8,
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
  backLink: {
    alignSelf: 'center',
    marginTop: 28,
  },
  backLinkText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.primaryOrange,
  },
});
