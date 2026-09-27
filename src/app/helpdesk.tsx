import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { fetchSession } from '@/api/session';
import { FieldLabel, PressableField, TextField } from '@/components/form-fields';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Submit a Ticket — the live /helpdesk page (redirects to /helpdesk/customer-care-1),
 * opened from the Account tab.
 *
 * ⚠️ SUBMITTING ISN'T AVAILABLE — FIELDS AND SUBMIT ARE DISABLED ⚠️
 * The live form is Odoo's standard website form: its script sends multipart/form-data in the
 * background to /website/form/helpdesk.ticket (with the page's csrf_token, team_id = 1) and then
 * opens /your-ticket-has-been-submitted. Checked on staging 2026-09-27: without the csrf_token, or
 * as JSON, the route answers 400; with the token and empty fields it answers
 * {"error_fields": [...]} and creates nothing. A successful submission from the app hasn't been
 * tested (it would create a real ticket), so nothing can be typed or sent — no fake success.
 * Blocked on docs/backend-requests/009-helpdesk-ticket-json.md.
 *
 * Same fields as the live form, in its order: Full Name*, Phone Number, Email Address*, Company
 * Name, Message Subject*, Ask Your Question*, Attachment; then "Submit Ticket". The live form
 * pre-fills name / phone / email / company for a signed-in customer; the app pre-fills what the
 * session has (name, and the login when it's an email). The hidden "Helpdesk Team" field isn't
 * shown. Not shown: the live "About our team" text (Odoo's default demo copy).
 */

const COPY = {
  // Confirmed from the live /helpdesk/customer-care-1 page.
  title: 'Submit a Ticket',
  fullName: 'Full Name *',
  phone: 'Phone Number',
  email: 'Email Address *',
  company: 'Company Name',
  subject: 'Message Subject *',
  question: 'Ask Your Question *',
  attachment: 'Attachment',
  submit: 'Submit Ticket',
  // PLACEHOLDER COPY (not confirmed anywhere).
  notAvailable: 'Submitting tickets from the app isn’t available yet',
  comingSoon: 'Coming soon',
};

export default function HelpdeskScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const requestId = useRef(0);

  // Real: the signed-in customer's name and login (live: data-fill-with="name" / "email").
  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchSession();
    if (id === requestId.current && result.ok && result.session) {
      setName(result.session.name);
      setEmail(result.session.login.includes('@') ? result.session.login : '');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++;
      };
    }, [load])
  );

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: COPY.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SampleDataBanner message={COPY.notAvailable} />
        <Text style={styles.heading}>{COPY.title}</Text>

        <View style={styles.card}>
          <TextField label={COPY.fullName} value={name} editable={false} />
          <TextField label={COPY.phone} editable={false} />
          <TextField label={COPY.email} value={email} editable={false} />
          <TextField label={COPY.company} editable={false} />
          <TextField label={COPY.subject} editable={false} />
          <View>
            <FieldLabel>{COPY.question}</FieldLabel>
            {/* Live: a 5-row textarea. Same box as the Contact Us "Message". */}
            <TextInput
              editable={false}
              multiline
              textAlignVertical="top"
              accessibilityLabel={COPY.question}
              style={styles.textarea}
            />
          </View>
          <PressableField label={COPY.attachment} icon="file" disabled onPress={() => {}} />

          {/* Blocked on docs/backend-requests/009-helpdesk-ticket-json.md. Not pressable. */}
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

// Same layout as the Contact Us screen.
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
