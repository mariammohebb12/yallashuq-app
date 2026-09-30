import { Stack, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchProfileNames } from '@/api/profile';
import { fetchSession } from '@/api/session';
import { DisabledButton } from '@/components/coming-soon';
import { FieldLabel, PressableField, TextField } from '@/components/form-fields';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: My account (profile) — the live /my/account page, opened by "Edit information" on the
 * Account tab.
 *
 * ⚠️ SAVING ISN'T AVAILABLE — EVERY FIELD AND "SAVE PROFILE" ARE DISABLED ⚠️
 * The live form is an HTML multipart POST to /my/account with a csrf_token (page reload); a JSON
 * call or a post without the token → 400, and no JSON profile route exists (checked on staging
 * 2026-09-27; no profile was changed). Blocked on
 * docs/backend-requests/013-profile-update-json.md.
 *
 * The live profile fields, in order: Profile Photo, First Name, Last Name, Email, Phone, Company
 * Name, VAT Number, Street, Street 2, State / Province, City, Country, Zip / Postal Code; then
 * "Save Profile". Company Name, VAT Number and Country are disabled on the live form too, with the
 * note shown here.
 * Values: the live form is pre-filled with the customer's details, but no JSON route returns them
 * (#004). Email comes from the session login, when it's an email. First / Last Name are read from
 * the live /my/account form's own pre-filled inputs (src/api/profile.ts, TEMPORARY HTML
 * workaround) — the backend's split of the full name, not one guessed here.
 * Deliberately NOT here: the live page's "Change Password" section (/my/account/change_password)
 * and the intro "Manage your profile, address details, and password in one place." Passwords
 * belong to the Security screen: /my/security is the authoritative form (decided by Basem/Mariam
 * 2026-09-30 — Odoo's core page, safe across Odoo upgrades), even though the custom route works.
 */

const COPY = {
  // Confirmed from the live /my/account page.
  heading: 'My account',
  profilePhoto: 'Profile Photo',
  lockedNote:
    'Company name, VAT Number and country can not be changed once document(s) have been issued for your account. Please contact us directly for that operation.',
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  companyName: 'Company Name',
  vat: 'VAT Number',
  street: 'Street',
  street2: 'Street 2',
  state: 'State / Province',
  statePlaceholder: 'select...',
  city: 'City',
  country: 'Country',
  countryPlaceholder: 'Country...',
  zip: 'Zip / Postal Code',
  save: 'Save Profile',
  // PLACEHOLDER COPY (not confirmed anywhere).
  notAvailable: 'Editing your profile from the app isn’t available yet',
};

export default function EditInformationScreen() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const requestId = useRef(0);

  // Real: the signed-in login (Email, when it's an email address) and the live form's names.
  const load = useCallback(async () => {
    const id = ++requestId.current;
    const [result, names] = await Promise.all([fetchSession(), fetchProfileNames()]);
    if (id !== requestId.current) {
      return;
    }
    if (result.ok && result.session) {
      setEmail(result.session.login.includes('@') ? result.session.login : '');
    }
    if (names.ok && names.names) {
      setFirstName(names.names.firstName);
      setLastName(names.names.lastName);
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
      <Stack.Screen options={{ title: COPY.heading }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SampleDataBanner message={COPY.notAvailable} />
        <Text style={styles.heading}>{COPY.heading}</Text>

        <View style={styles.card}>
          <View>
            <FieldLabel>{COPY.profilePhoto}</FieldLabel>
            {/* Live: a file input. Same round preview as the signup screens; can't be changed. */}
            <View
              style={styles.photoPreview}
              accessible
              accessibilityLabel={COPY.profilePhoto}
              accessibilityState={{ disabled: true }}>
              <SymbolView
                name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                size={22}
                tintColor={Colors.primaryOrange}
              />
            </View>
          </View>

          <Text style={styles.note}>{COPY.lockedNote}</Text>

          <TextField label={COPY.firstName} value={firstName} editable={false} />
          <TextField label={COPY.lastName} value={lastName} editable={false} />
          <TextField label={COPY.email} value={email} editable={false} />
          <TextField label={COPY.phone} editable={false} />
          <TextField label={COPY.companyName} editable={false} />
          <TextField label={COPY.vat} editable={false} />
          <TextField label={COPY.street} editable={false} />
          <TextField label={COPY.street2} editable={false} />
          <PressableField
            label={COPY.state}
            placeholder={COPY.statePlaceholder}
            icon="chevron"
            disabled
            onPress={() => {}}
          />
          <TextField label={COPY.city} editable={false} />
          <PressableField
            label={COPY.country}
            placeholder={COPY.countryPlaceholder}
            icon="chevron"
            disabled
            onPress={() => {}}
          />
          <TextField label={COPY.zip} editable={false} />

          {/* Blocked on docs/backend-requests/013-profile-update-json.md. Not pressable. */}
          <DisabledButton label={COPY.save} />
        </View>
      </ScrollView>
    </View>
  );
}

// Same layout as the Contact Us / Submit a Ticket screens; photo preview as on the signup screens.
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
  photoPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.helperText,
  },
});
