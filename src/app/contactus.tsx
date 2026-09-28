import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { sendContactMessage } from '@/api/contact';
import { FieldError, FieldLabel, REQUIRED_MESSAGE, TextField } from '@/components/form-fields';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Contact Us — the live /contactus page (opened from the Account tab).
 *
 * REAL: "Submit Message" posts to the live /contactus/submit route, like the website's form
 * (sendContactMessage in src/api/contact.ts — an HTML-form workaround, no JSON route exists).
 * Success is shown only when the backend answers with its success redirect; its own error
 * message ("Name, email, and message are required.") is shown as-is. The live page isn't
 * pre-filled, even when signed in (checked on staging 2026-09-27), so neither is this one.
 *
 * Same fields as the live form, in its order: Full Name (required), Email (required), Phone,
 * Subject, Message (required), then "Submit Message".
 * Not shown: the live page's "Support: +1 555-555-5556" / "Email: admin-yallashaq@yopmail.com"
 * lines — staging's demo values, not real contact details (same as the order support popup).
 */

const COPY = {
  // Confirmed from the live /contactus page.
  title: 'Contact Us',
  intro: 'Share your query and our team will get back to you quickly.',
  fullName: 'Full Name',
  email: 'Email',
  phone: 'Phone',
  subject: 'Subject',
  message: 'Message',
  submit: 'Submit Message',
  success: 'Thanks, your message has been submitted successfully.',
};

type Field = 'name' | 'email' | 'message';

export default function ContactUsScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) {
      return;
    }
    // Live: name, email and message are `required` inputs.
    const missing: Partial<Record<Field, string>> = {};
    if (!name.trim()) missing.name = REQUIRED_MESSAGE;
    if (!email.trim()) missing.email = REQUIRED_MESSAGE;
    if (!message.trim()) missing.message = REQUIRED_MESSAGE;
    setErrors(missing);
    setFormError(undefined);
    setSent(false);
    if (Object.keys(missing).length > 0) {
      return;
    }
    setSubmitting(true);
    const result = await sendContactMessage({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      subject: subject.trim(),
      message: message.trim(),
    });
    setSubmitting(false);
    if (result.ok) {
      // Live: the page reloads with an empty form and the success alert.
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
      setSent(true);
    } else {
      setFormError(result.message);
    }
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: COPY.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{COPY.title}</Text>
        <Text style={styles.intro}>{COPY.intro}</Text>
        <FormMessage type="success" message={sent ? COPY.success : undefined} />
        <FormMessage type="error" message={formError} />

        <View style={styles.card}>
          <TextField
            label={COPY.fullName}
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoComplete="name"
          />
          <TextField
            label={COPY.email}
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextField
            label={COPY.phone}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <TextField label={COPY.subject} value={subject} onChangeText={setSubject} />
          <View>
            <FieldLabel>{COPY.message}</FieldLabel>
            {/* Live: a textarea. Same box as the Withdraw screen's "Payment Details". */}
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
              accessibilityLabel={COPY.message}
              style={[styles.textarea, errors.message ? styles.textareaError : null]}
            />
            <FieldError message={errors.message} />
          </View>

          {/* Live: .ysq-contact-actions .btn (orange, min 170×42, radius 10, 13px bold). */}
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || submitting) && styles.submitPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}>
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitText}>{COPY.submit}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  heading: {
    fontFamily: Fonts.primaryBold,
    fontSize: 26,
    color: Colors.sectionHeading,
    marginBottom: 6,
  },
  intro: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.mutedText,
    marginBottom: 14,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  textarea: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
  textareaError: {
    borderColor: Colors.errorText,
  },
  submitButton: {
    alignSelf: 'flex-start',
    minWidth: 170,
    minHeight: 42,
    marginTop: 2,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryOrange,
  },
  submitPressed: {
    opacity: 0.85,
  },
  submitText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    color: Colors.white,
  },
});
