import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

// Two variants, each copying its own live modal (web.assets_frontend_lazy):
//
// 'signup' (default) — the live signup page's OTP modals and script.
// Timing: the live site uses a 10-minute countdown; the app uses 2 minutes (client decision,
// Sept 2026). This is a CLIENT-SIDE limit only — the backend validates codes with its own expiry
// window (not visible from the app), so it may still accept a code the app calls expired.
//
// 'login' — the live login page's modal (yallashuq_seller/static/src/js/login_otp.js, checked
// 2026-09-30). Always titled "Verify Your Email", even when the login is a phone number (that's
// the live site's current behaviour, kept as-is). No expiry countdown; "Resend Code" works right
// away, and after a successful resend it's locked for 30 seconds ("Resend in 29s...").
const CODE_LENGTH = 6;
const EXPIRY_SECONDS = 120;
/** "Resend Code" unlocks after this many seconds (halfway through the 2-minute window). */
const RESEND_UNLOCK_SECONDS = 60;
const LOGIN_RESEND_COOLDOWN_SECONDS = 30;

/** The live login modal's own strings. */
const LOGIN_COPY = {
  title: 'Verify Your Email',
  body: 'Please enter the 6-digit code sent to',
  verify: 'Verify & Login',
  exactDigits: 'Please enter exactly 6 digits.',
  resent: 'New code sent!',
  resendIn: (seconds: number) => `Resend in ${seconds}s...`,
};

type Props = {
  visible: boolean;
  /** 'signup' (default) or 'login' — see the top of this file. */
  variant?: 'signup' | 'login';
  /** Signup only: "email" → "Verify Email"; "whatsapp" → "Verify WhatsApp Number". */
  channel?: 'email' | 'whatsapp';
  /** Where the code was sent, e.g. the email address or "+971501234567". */
  target: string;
  /** Resolves to an error message to show, or undefined when the code was accepted. */
  onVerify: (code: string) => Promise<string | undefined>;
  /** Resolves to an error message to show, or undefined when a new code was sent. */
  onResend: () => Promise<string | undefined>;
  onClose: () => void;
};

export function OtpModal({
  visible,
  variant = 'signup',
  channel = 'email',
  target,
  onVerify,
  onResend,
  onClose,
}: Props) {
  const isLogin = variant === 'login';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  // Login only: the green "New code sent!" (shown in the same place as the error, as live).
  const [notice, setNotice] = useState<string>();
  // Login only: seconds left on the resend lock; bumping cooldownRun starts a new one.
  const [cooldown, setCooldown] = useState(0);
  const [cooldownRun, setCooldownRun] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  // Bumped on resend to restart the countdown (opening the modal restarts it too).
  const [timerRun, setTimerRun] = useState(0);

  useEffect(() => {
    if (visible) {
      setCode('');
      setError(undefined);
      setNotice(undefined);
      setVerifying(false);
      setResending(false);
      setCooldown(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || isLogin) {
      return;
    }
    setSecondsLeft(EXPIRY_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          clearInterval(interval);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, timerRun, isLogin]);

  useEffect(() => {
    if (!visible || cooldownRun === 0) {
      return;
    }
    const interval = setInterval(() => {
      setCooldown((seconds) => {
        if (seconds <= 1) {
          clearInterval(interval);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, cooldownRun]);

  const canResend = isLogin
    ? cooldown === 0
    : secondsLeft <= EXPIRY_SECONDS - RESEND_UNLOCK_SECONDS;
  const expired = !isLogin && secondsLeft === 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  async function handleVerify() {
    if (verifying || expired) {
      return; // An expired code must be resent first.
    }
    if (code.length < CODE_LENGTH) {
      setError(isLogin ? LOGIN_COPY.exactDigits : 'Please enter 6-digit code.');
      return;
    }
    setNotice(undefined);
    setVerifying(true);
    setError(await onVerify(code));
    setVerifying(false);
  }

  async function handleResend() {
    setResending(true);
    setError(undefined);
    setNotice(undefined);
    const resendError = await onResend();
    setResending(false);
    if (resendError) {
      setError(resendError);
      return;
    }
    if (isLogin) {
      // Live: the typed code stays; the green notice shows and the resend lock starts.
      setNotice(LOGIN_COPY.resent);
      setCooldown(LOGIN_RESEND_COOLDOWN_SECONDS);
      setCooldownRun((run) => run + 1);
      return;
    }
    setCode('');
    setTimerRun((run) => run + 1);
  }

  // Live login: the link keeps "Sending..." for the lock's first second, then "Resend in 29s...".
  const resendLabel =
    resending || (isLogin && cooldown === LOGIN_RESEND_COOLDOWN_SECONDS)
      ? 'Sending...'
      : isLogin && cooldown > 0
        ? LOGIN_COPY.resendIn(cooldown)
        : 'Resend Code';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isLogin
                ? LOGIN_COPY.title
                : channel === 'email'
                  ? 'Verify Email'
                  : 'Verify WhatsApp Number'}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={16}
                tintColor={Colors.dark}
              />
            </Pressable>
          </View>

          <Text style={styles.body}>
            {isLogin
              ? `${LOGIN_COPY.body}\n`
              : channel === 'email'
                ? 'Enter the 6-digit code sent to your email '
                : 'Enter the 6-digit code sent to WhatsApp '}
            <Text style={styles.target}>{target}</Text>
          </Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(text) => {
              setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH));
              setError(undefined);
              setNotice(undefined);
            }}
            placeholder="000000"
            placeholderTextColor={Colors.placeholderIcon}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            onSubmitEditing={handleVerify}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          {!isLogin && (
            <Text style={styles.timer}>
              {secondsLeft > 0 ? `Code expires in ${minutes}:${seconds}` : 'Code expired.'}
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.verifyButton,
              (pressed || verifying) && styles.pressed,
              expired && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerify}
            disabled={verifying || expired}
            accessibilityRole="button"
            accessibilityState={{ disabled: verifying || expired, busy: verifying }}>
            {/* "Verifying..." is the live site's own label while the check runs. */}
            <Text style={styles.verifyText}>
              {verifying ? 'Verifying...' : isLogin ? LOGIN_COPY.verify : 'Verify Code'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.resend, (!canResend || resending) && styles.resendDisabled]}
            onPress={handleResend}
            disabled={!canResend || resending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canResend || resending }}>
            <Text style={styles.resendText}>{resendLabel}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.primaryBold,
    fontSize: 20,
    color: Colors.dark,
  },
  body: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.mutedText,
    textAlign: 'center',
    marginBottom: 24,
  },
  target: {
    fontFamily: Fonts.primaryBold,
    color: Colors.dark,
  },
  codeInput: {
    alignSelf: 'center',
    width: 180,
    height: 60,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    textAlign: 'center',
    fontFamily: Fonts.primaryBold,
    fontSize: 24,
    letterSpacing: 4,
    color: Colors.dark,
    marginBottom: 24,
  },
  error: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.errorText,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 16,
  },
  notice: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.verifiedText,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 16,
  },
  timer: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.mutedText,
    textAlign: 'center',
    marginBottom: 16,
  },
  verifyButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 17,
    color: Colors.white,
  },
  resend: {
    alignSelf: 'center',
    marginTop: 20,
  },
  resendDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.primaryOrange,
  },
});
