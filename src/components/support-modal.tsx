import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { fetchSession } from '@/api/session';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * The live order support popup (#mishmesh_order_support_modal on /my/orders) — layout, copy and
 * colors from the live markup. Opened by "SUPPORT" on the My Orders list.
 *
 * VISUAL + PRE-FILL ONLY FOR NOW: "Submit" just closes the popup; nothing is sent. The live form
 * posts HTML to /my/orders/<id>/mishmesh_support (not JSON) — a JSON route is needed first.
 *
 * Pre-fill (the live form pre-fills from the customer's account): Name and Email come from the
 * signed-in session (fetchSession; the login is used as the email only when it is one). Phone
 * stays empty: it isn't in any JSON the app can read yet (docs/backend-requests/004).
 *
 * MISSING: the "Direct Contact" email. The live page renders it server-side (staging shows a test
 * address), and no JSON route or confirmed value provides the real one, so it shows
 * "Not available yet" instead of a guess.
 */

const COPY = {
  // Confirmed from the live support popup.
  title: 'Need Support',
  order: 'Order',
  directContact: 'Direct Contact',
  subject: 'Subject',
  subjectPlaceholder: 'What do you need help with?',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  details: 'Details',
  detailsPlaceholder: 'Tell us what happened and what you need.',
  cancel: 'Cancel',
  submit: 'Submit',
  // PLACEHOLDER COPY (not confirmed anywhere).
  close: 'Close',
  missing: 'Not available yet',
};

type Props = {
  /** Order the request is about, e.g. "S00073"; null hides the popup. */
  orderName: string | null;
  onClose: () => void;
};

export function SupportModal({ orderName, onClose }: Props) {
  return (
    <Modal visible={orderName !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Mounted per opening, so every opening starts from a fresh pre-fill. */}
        {orderName !== null && (
          <SupportCard key={orderName} orderName={orderName} onClose={onClose} />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SupportCard({ orderName, onClose }: { orderName: string; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');

  // Pre-fill from the signed-in account. Fields the customer already typed in are kept.
  useEffect(() => {
    let active = true;
    fetchSession().then((result) => {
      if (!active || !result.ok || !result.session) {
        return;
      }
      const { session } = result;
      setName((current) => current || session.name);
      if (session.login.includes('@')) {
        setEmail((current) => current || session.login);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.card} accessibilityViewIsModal>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{COPY.title}</Text>
          <Text style={styles.orderLine}>
            {COPY.order} <Text style={styles.orderName}>{orderName}</Text>
          </Text>
        </View>
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

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        bounces={false}>
        {/* Live: light box with a 4px orange start border. */}
        <View style={styles.contactBox}>
          <Text style={styles.contactLabel}>{COPY.directContact}</Text>
          <View style={styles.contactRow}>
            <SymbolView
              name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
              size={14}
              tintColor={Colors.supportOrange}
            />
            {/* MISSING: the real support email (see the header comment). */}
            <View style={styles.missing}>
              <Text style={styles.missingText}>{COPY.missing}</Text>
            </View>
          </View>
        </View>

        <Field
          label={COPY.subject}
          value={subject}
          onChangeText={setSubject}
          placeholder={COPY.subjectPlaceholder}
        />
        <Field
          label={COPY.name}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
        />
        <Field
          label={COPY.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Field
          label={COPY.phone}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        <Field
          label={COPY.details}
          value={details}
          onChangeText={setDetails}
          placeholder={COPY.detailsPlaceholder}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={styles.textarea}
        />

        <View style={styles.buttons}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>{COPY.cancel}</Text>
          </Pressable>
          {/* VISUAL ONLY: closes without sending (see the header comment). */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.submitButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
              size={13}
              tintColor={Colors.white}
            />
            <Text style={styles.buttonText}>{COPY.submit}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, style, ...inputProps }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={Colors.placeholderIcon}
        {...inputProps}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // Live: 15px radius.
  card: {
    maxHeight: '90%',
    backgroundColor: Colors.white,
    borderRadius: 15,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: Fonts.primaryBold,
    fontSize: 20,
    color: Colors.dark,
  },
  orderLine: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.mutedText,
  },
  orderName: {
    fontFamily: Fonts.primaryBold,
    color: Colors.supportOrange,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  // PENDING CONFIRMATION: the live box is Bootstrap's bg-light + border, whose theme colors
  // aren't in the page source; the nearest confirmed app tokens are used.
  contactBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
    borderStartWidth: 4,
    borderStartColor: Colors.supportOrange,
    backgroundColor: Colors.phoneCountryBackground,
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  // Live: bold, small, uppercase, 50% opacity.
  contactLabel: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    textTransform: 'uppercase',
    color: Colors.dark,
    opacity: 0.5,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missing: {
    borderRadius: 999,
    backgroundColor: Colors.inputBorder,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  missingText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 11,
    color: Colors.mutedText,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontFamily: Fonts.primarySemiBold,
    fontSize: 13,
    color: Colors.dark,
    marginBottom: 6,
  },
  // Live: Bootstrap form-control with an 8px radius.
  input: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
  textarea: {
    minHeight: 84,
  },
  // Live: modal footer — buttons at the end, pill-shaped, min-width 120.
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 120,
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  // PENDING CONFIRMATION: live is Bootstrap's btn-secondary (theme color not in the source).
  cancelButton: {
    backgroundColor: Colors.helperText,
  },
  submitButton: {
    backgroundColor: Colors.supportOrange,
  },
  buttonText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
