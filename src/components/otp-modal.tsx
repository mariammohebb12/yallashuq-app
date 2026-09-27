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

// Copy mirrors the live signup page's OTP modals and script (web.assets_frontend_lazy).
// Timing: the live site uses a 10-minute countdown; the app uses 2 minutes (client decision,
// Sept 2026). This is a CLIENT-SIDE limit only — the backend validates codes with its own expiry
// window (not visible from the app), so it may still accept a code the app calls expired.
const CODE_LENGTH = 6;
const EXPIRY_SECONDS = 120;
/** "Resend Code" unlocks after this many seconds (halfway through the 2-minute window). */
const RESEND_UNLOCK_SECONDS = 60;

type Props = {
  visible: boolean;
  /** "email" → "Verify Email"; "whatsapp" → "Verify WhatsApp Number". */
  channel: 'email' | 'whatsapp';
  /** Where the code was sent, e.g. the email address or "+971501234567". */
  target: string;
  /** Resolves to an error message to show, or undefined when the code was accepted. */
  onVerify: (code: string) => Promise<string | undefined>;
  /** Resolves to an error message to show, or undefined when a new code was sent. */
  onResend: () => Promise<string | undefined>;
  onClose: () => void;
};

export function OtpModal({ visible, channel, target, onVerify, onResend, onClose }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  // Bumped on resend to restart the countdown (opening the modal restarts it too).
  const [timerRun, setTimerRun] = useState(0);

  useEffect(() => {
    if (visible) {
      setCode('');
      setError(undefined);
      setVerifying(false);
      setResending(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
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
  }, [visible, timerRun]);

  const canResend = secondsLeft <= EXPIRY_SECONDS - RESEND_UNLOCK_SECONDS;
  const expired = secondsLeft === 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  async function handleVerify() {
    if (verifying || expired) {
      return; // An expired code must be resent first.
    }
    if (code.length < CODE_LENGTH) {
      setError('Please enter 6-digit code.');
      return;
    }
    setVerifying(true);
    setError(await onVerify(code));
    setVerifying(false);
  }

  async function handleResend() {
    setResending(true);
    setError(undefined);
    const resendError = await onResend();
    setResending(false);
    if (resendError) {
      setError(resendError);
      return;
    }
    setCode('');
    setTimerRun((run) => run + 1);
  }

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
              {channel === 'email' ? 'Verify Email' : 'Verify WhatsApp Number'}
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
            {channel === 'email'
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

          <Text style={styles.timer}>
            {secondsLeft > 0 ? `Code expires in ${minutes}:${seconds}` : 'Code expired.'}
          </Text>

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
            <Text style={styles.verifyText}>{verifying ? 'Verifying...' : 'Verify Code'}</Text>
          </Pressable>

          <Pressable
            style={[styles.resend, (!canResend || resending) && styles.resendDisabled]}
            onPress={handleResend}
            disabled={!canResend || resending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canResend || resending }}>
            <Text style={styles.resendText}>{resending ? 'Sending...' : 'Resend Code'}</Text>
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
    fontFamily: Fonts.primary,
    fontSize: 20,
    fontWeight: '800',
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
    fontWeight: '700',
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
    fontFamily: Fonts.primary,
    fontSize: 24,
    fontWeight: '700',
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
  timer: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
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
    fontFamily: Fonts.primary,
    fontSize: 17,
    fontWeight: '700',
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
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryOrange,
  },
});
