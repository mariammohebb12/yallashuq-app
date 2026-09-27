import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FieldLabel, TextField } from '@/components/form-fields';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Contact Us — the live /contactus page (opened from the Account tab).
 *
 * ⚠️ SENDING ISN'T AVAILABLE — FIELDS AND SUBMIT ARE DISABLED ⚠️
 * The live form is a plain HTML POST to /contactus/submit with a csrf_token (full page reload);
 * a JSON call to it is rejected (400) and the site's JS doesn't submit it (checked on staging
 * 2026-09-27). Sending from the app hasn't been tested, so nothing can be typed or sent here — no
 * fake success.
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
  // PLACEHOLDER COPY (not confirmed anywhere).
  notAvailable: 'Sending messages from the app isn’t available yet',
  comingSoon: 'Coming soon',
};

export default function ContactUsScreen() {
  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: COPY.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SampleDataBanner message={COPY.notAvailable} />
        <Text style={styles.heading}>{COPY.title}</Text>
        <Text style={styles.intro}>{COPY.intro}</Text>

        <View style={styles.card}>
          <TextField label={COPY.fullName} editable={false} />
          <TextField label={COPY.email} editable={false} />
          <TextField label={COPY.phone} editable={false} />
          <TextField label={COPY.subject} editable={false} />
          <View>
            <FieldLabel>{COPY.message}</FieldLabel>
            {/* Live: a textarea. Same box as the Withdraw screen's "Payment Details". */}
            <TextInput
              editable={false}
              multiline
              textAlignVertical="top"
              accessibilityLabel={COPY.message}
              style={styles.textarea}
            />
          </View>

          {/* Disabled until sending is confirmed to work from the app. Not pressable. */}
          {/* Blocked on docs/backend-requests/008-contact-us-json.md (no JSON submit route). */}
          <View
            style={styles.disabledButton}
            accessible
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel={`${COPY.submit}, ${COPY.comingSoon}`}>
            <Text style={styles.disabledButtonText}>{COPY.submit}</Text>
            <View style={styles.comingSoon}>
              <Text style={styles.comingSoonText}>{COPY.comingSoon}</Text>
            </View>
          </View>
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
    fontFamily: Fonts.primary,
    fontSize: 26,
    fontWeight: '800',
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
  // Same disabled "Coming soon" button as the Security screen and the return form.
  disabledButton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    opacity: 0.7,
  },
  disabledButtonText: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.mutedText,
  },
  comingSoon: {
    borderRadius: 999,
    backgroundColor: Colors.inputBorder,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  comingSoonText: {
    fontFamily: Fonts.primary,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.mutedText,
  },
});
