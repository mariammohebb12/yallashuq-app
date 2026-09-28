import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  loadSignupForm,
  loadStates,
  sendEmailOtp,
  sendWhatsappOtp,
  submitSignup,
  verifyEmailOtp,
  verifyWhatsappOtp,
  type DialCode,
  type SignupForm,
  type StateOption,
} from '@/api/signup';
import {
  FieldError,
  FieldLabel,
  FieldLink,
  PressableField,
  REQUIRED_MESSAGE,
  TextField,
  VerifiedBadge,
} from '@/components/form-fields';
import { FormMessage } from '@/components/form-message';
import { OtpModal } from '@/components/otp-modal';
import { PickerModal, type PickerItem } from '@/components/picker-modal';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

// Screen 6: Signup (Customer). Fields, copy, placeholders and styles mirror
// yallashuq.com/web/signup?signup_type=customer. Connected to the Odoo backend via
// src/api/signup.ts: the country lists, CSRF token and hidden fields come from the real signup
// page, states from /web/signup/states, OTPs are really sent/verified, and "Create Account"
// posts the real form. Messages from the backend are shown as-is.

// Odoo core's own message (auth_signup); the backend checks this too.
const PASSWORD_MISMATCH_MESSAGE = 'Passwords do not match; please retype them.';

// Basic shape checks to catch typos early — same rules and messages as the live signup script.
// The backend still does its own validation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{7,15}$/;
const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';
const INVALID_PHONE_MESSAGE = 'Please enter a valid phone number.';
// Live signup script's messages when submitting without a finished OTP check. The backend
// enforces phone verification itself too (checked via the session).
const VERIFY_EMAIL_MESSAGE = 'Please verify your email address.';
const VERIFY_PHONE_MESSAGE = 'Please verify your phone number.';

type FieldKey =
  | 'name'
  | 'phone'
  | 'dob'
  | 'street'
  | 'street2'
  | 'city'
  | 'state'
  | 'country'
  | 'zip'
  | 'password'
  | 'confirmPassword';

type Picker = 'dialCode' | 'country' | 'state';

type ProfilePhoto = { uri: string; fileName: string };

/** Latest selectable date of birth: yesterday (live form: date of birth must be before today). */
function latestBirthDate(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 1);
  return date;
}

/** YYYY-MM-DD in local time, as an HTML date input submits it. */
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function SignupCustomerScreen() {
  // Loaded from the real signup page (also starts the session the OTP checks are stored in).
  const [signupForm, setSignupForm] = useState<SignupForm>();
  const [states, setStates] = useState<StateOption[]>([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dialCode, setDialCode] = useState<DialCode>();
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState<Date>();
  const [photo, setPhoto] = useState<ProfilePhoto>();
  const [street, setStreet] = useState('');
  const [street2, setStreet2] = useState('');
  const [city, setCity] = useState('');
  const [countryId, setCountryId] = useState<string>();
  const [stateId, setStateId] = useState<string>();
  const [zip, setZip] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // The values the live form stores in its hidden email_verified / phone_verified inputs after a
  // successful OTP check (the email, and country code + number). Fields lock once verified.
  const [verifiedEmail, setVerifiedEmail] = useState<string>();
  const [verifiedPhone, setVerifiedPhone] = useState<string>();
  const [otpChannel, setOtpChannel] = useState<'email' | 'whatsapp' | null>(null);
  const [sendingOtp, setSendingOtp] = useState<'email' | 'whatsapp' | null>(null);
  // Field-level errors from the backend or the verification checks (shown under the field).
  const [emailError, setEmailError] = useState<string>();
  const [phoneError, setPhoneError] = useState<string>();

  const [openPicker, setOpenPicker] = useState<Picker | null>(null);
  const [iosDobPickerOpen, setIosDobPickerOpen] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [missing, setMissing] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [infoMessage, setInfoMessage] = useState<string>();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Loads the signup page data; returns it, or undefined after showing the error. */
  async function ensureSignupForm(): Promise<SignupForm | undefined> {
    if (signupForm) {
      return signupForm;
    }
    const result = await loadSignupForm();
    if (!mounted.current) {
      return undefined;
    }
    if ('error' in result) {
      setErrorMessage(result.error);
      return undefined;
    }
    setSignupForm(result);
    setDialCode((current) => current ?? result.dialCodes.find((d) => d.code === result.defaultDialCode));
    return result;
  }

  // Load once on open.
  useEffect(() => {
    ensureSignupForm();
  }, []);

  const countryCode = dialCode?.code ?? '';
  const fullPhone = `${countryCode}${phone}`;
  const emailIsVerified = verifiedEmail !== undefined;
  const phoneIsVerified = verifiedPhone !== undefined;
  const selectedCountry = signupForm?.countries.find((c) => c.id === countryId);
  const selectedState = states.find((s) => s.id === stateId);
  // State is required only when the selected country has states (live form behavior).
  const stateRequired = states.length > 0;
  const passwordsMismatch =
    password !== '' && confirmPassword !== '' && password !== confirmPassword;

  const dialCodeItems = useMemo<PickerItem[]>(
    () =>
      (signupForm?.dialCodes ?? []).map((d) => ({
        key: d.key,
        label: d.name,
        detail: `+${d.code}`,
        imageUrl: d.flagUrl,
      })),
    [signupForm]
  );
  const countryItems = useMemo<PickerItem[]>(
    () => (signupForm?.countries ?? []).map((c) => ({ key: c.id, label: c.name })),
    [signupForm]
  );
  const stateItems = useMemo<PickerItem[]>(
    () => states.map((s) => ({ key: s.id, label: s.name })),
    [states]
  );

  function clearMissing(field: FieldKey) {
    setMissing((current) => (current[field] ? { ...current, [field]: false } : current));
  }

  /** Returns a change handler that stores the value and clears the field's required note. */
  function onChange(field: FieldKey, setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      clearMissing(field);
    };
  }

  function errorFor(field: FieldKey): string | undefined {
    return missing[field] ? REQUIRED_MESSAGE : undefined;
  }

  async function selectCountry(id: string) {
    if (id === countryId) {
      return;
    }
    setCountryId(id);
    setStateId(undefined); // States belong to a country.
    setStates([]);
    clearMissing('country');
    try {
      const loaded = await loadStates(id);
      if (mounted.current) {
        setStates(loaded);
      }
    } catch {
      // Same as the live form: without states, State just isn't required.
    }
  }

  function openDobPicker() {
    const maximumDate = latestBirthDate();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: dob ?? maximumDate,
        maximumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) {
            setDob(date);
            clearMissing('dob');
          }
        },
      });
    } else {
      setIosDobPickerOpen(true);
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, fileName: asset.fileName ?? asset.uri.split('/').pop() ?? '' });
    }
  }

  async function handleVerifyEmail() {
    const address = email.trim();
    if (address === '' || sendingOtp) {
      return; // Same as the live form: nothing to verify yet.
    }
    if (!EMAIL_PATTERN.test(address)) {
      setEmailError(INVALID_EMAIL_MESSAGE); // Don't send a code to an address that can't be right.
      return;
    }
    setSendingOtp('email');
    const result = await sendEmailOtp(address);
    if (!mounted.current) {
      return;
    }
    setSendingOtp(null);
    if (result.ok) {
      setEmailError(undefined);
      setOtpChannel('email');
    } else {
      setEmailError(result.message);
    }
  }

  async function handleVerifyPhone() {
    if (phone === '' || sendingOtp) {
      return;
    }
    if (!PHONE_PATTERN.test(phone)) {
      setPhoneError(INVALID_PHONE_MESSAGE);
      return;
    }
    setSendingOtp('whatsapp');
    // NOTE: fails until WhatsApp OTP sending is configured on the backend — see sendWhatsappOtp.
    const result = await sendWhatsappOtp(phone, countryCode);
    if (!mounted.current) {
      return;
    }
    setSendingOtp(null);
    if (result.ok) {
      setPhoneError(undefined);
      setOtpChannel('whatsapp');
    } else {
      setPhoneError(result.message);
    }
  }

  async function handleOtpSubmit(code: string): Promise<string | undefined> {
    const result =
      otpChannel === 'email' ? await verifyEmailOtp(email.trim(), code) : await verifyWhatsappOtp(code);
    if (!result.ok) {
      return result.message; // Shown inside the modal.
    }
    if (otpChannel === 'email') {
      setVerifiedEmail(email.trim());
      setEmailError(undefined);
    } else {
      setVerifiedPhone(fullPhone);
      setPhoneError(undefined);
    }
    setOtpChannel(null);
    return undefined;
  }

  async function handleOtpResend(): Promise<string | undefined> {
    const result =
      otpChannel === 'email'
        ? await sendEmailOtp(email.trim())
        : await sendWhatsappOtp(phone, countryCode);
    return result.ok ? undefined : result.message;
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }
    const required: Record<FieldKey, boolean> = {
      name: name.trim() === '',
      phone: phone === '',
      dob: dob === undefined,
      street: street.trim() === '',
      street2: street2.trim() === '',
      city: city.trim() === '',
      state: stateRequired && stateId === undefined,
      country: countryId === undefined,
      zip: zip.trim() === '',
      password: password === '',
      confirmPassword: confirmPassword === '',
    };
    setMissing(required);

    // Email is optional; if given it must look right and be verified. Phone must be verified —
    // the backend refuses signup without it, so don't send a request that can only fail.
    const trimmedEmail = email.trim();
    let newEmailError: string | undefined;
    if (trimmedEmail !== '' && !EMAIL_PATTERN.test(trimmedEmail)) {
      newEmailError = INVALID_EMAIL_MESSAGE;
    } else if (trimmedEmail !== '' && verifiedEmail !== trimmedEmail) {
      newEmailError = VERIFY_EMAIL_MESSAGE;
    }
    let newPhoneError: string | undefined;
    if (phone !== '' && !PHONE_PATTERN.test(phone)) {
      newPhoneError = INVALID_PHONE_MESSAGE;
    } else if (phone !== '' && verifiedPhone !== fullPhone) {
      newPhoneError = VERIFY_PHONE_MESSAGE;
    }
    setEmailError(newEmailError);
    setPhoneError(newPhoneError);

    if (
      Object.values(required).some(Boolean) ||
      passwordsMismatch ||
      newEmailError ||
      newPhoneError
    ) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(undefined);
    setInfoMessage(undefined);
    const form = await ensureSignupForm();
    if (!form || !mounted.current) {
      setSubmitting(false);
      return;
    }
    const result = await submitSignup(
      form.hiddenFields,
      {
        name: name.trim(),
        login: trimmedEmail,
        phone,
        countryCode,
        dob: toIsoDate(dob!),
        street: street.trim(),
        street2: street2.trim(),
        city: city.trim(),
        stateId: stateId ?? '',
        countryId: countryId!,
        zip: zip.trim(),
        bankAccountNo: bankAccount.trim(),
        bankIfsc: bankIfsc.trim(),
        password,
        confirmPassword,
        emailVerified: verifiedEmail ?? '',
        phoneVerified: verifiedPhone ?? '',
      },
      photo ? new File(photo.uri) : undefined
    );
    if (!mounted.current) {
      return;
    }
    setSubmitting(false);
    if (result.kind === 'success') {
      // PENDING CONFIRMATION: where to land after signup isn't specified; Odoo signs the new user
      // in, so go to Home like a successful login.
      router.replace('/');
    } else if (result.kind === 'info') {
      setInfoMessage(result.message);
    } else {
      setErrorMessage(result.message);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: '', headerShadowVisible: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.subtext}>Join thousands of happy shoppers worldwide</Text>
          </View>

          <View style={styles.fields}>
            <TextField
              label="Your Name"
              placeholder="e.g. John Doe"
              autoComplete="name"
              value={name}
              onChangeText={onChange('name', setName)}
              error={errorFor('name')}
            />

            <TextField
              label="Email Address (Optional)"
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError(undefined);
              }}
              editable={!emailIsVerified}
              error={emailError}
              footer={
                emailIsVerified ? (
                  <VerifiedBadge />
                ) : (
                  // "Sending..." is the live site's own label while the code is being sent.
                  <FieldLink onPress={handleVerifyEmail}>
                    {sendingOtp === 'email' ? 'Sending...' : 'Verify'}
                  </FieldLink>
                )
              }
            />

            <View>
              <FieldLabel>Phone Number</FieldLabel>
              <View
                style={[
                  styles.phoneGroup,
                  phoneFocused && styles.phoneGroupFocused,
                  (missing.phone || phoneError !== undefined) && styles.phoneGroupInvalid,
                  phoneIsVerified && styles.locked,
                ]}>
                <Pressable
                  style={styles.countryButton}
                  onPress={() => setOpenPicker('dialCode')}
                  disabled={phoneIsVerified || !signupForm}
                  accessibilityRole="button"
                  accessibilityLabel={`Country code +${countryCode}`}>
                  {dialCode && <Image source={{ uri: dialCode.flagUrl }} style={styles.flag} />}
                  <SymbolView
                    name={{
                      ios: 'chevron.down',
                      android: 'keyboard_arrow_down',
                      web: 'keyboard_arrow_down',
                    }}
                    size={10}
                    tintColor={Colors.placeholderIcon}
                  />
                </Pressable>
                <View style={styles.phoneSection}>
                  <Text style={styles.dialCode}>{countryCode}</Text>
                  <TextInput
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text.replace(/\D/g, ''));
                      clearMissing('phone');
                      setPhoneError(undefined);
                    }}
                    editable={!phoneIsVerified}
                    placeholder="6021234567"
                    placeholderTextColor={Colors.placeholderIcon}
                    keyboardType="number-pad"
                    autoComplete="tel-national"
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                  />
                </View>
              </View>
              <FieldError message={errorFor('phone') ?? phoneError} />
              {phoneIsVerified ? (
                <VerifiedBadge />
              ) : (
                <FieldLink onPress={handleVerifyPhone}>
                  {sendingOtp === 'whatsapp' ? 'Sending...' : 'Verify'}
                </FieldLink>
              )}
            </View>

            <PressableField
              label="Date of Birth"
              icon="calendar"
              value={dob?.toLocaleDateString()}
              onPress={openDobPicker}
              error={errorFor('dob')}
            />

            <View>
              <FieldLabel>Profile Photo (Optional)</FieldLabel>
              <View style={styles.photoRow}>
                <View style={styles.photoPreview}>
                  {photo ? (
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
                  ) : (
                    <SymbolView
                      name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                      size={22}
                      tintColor={Colors.primaryOrange}
                    />
                  )}
                </View>
                <View style={styles.photoActions}>
                  <View style={styles.photoButtons}>
                    <Pressable
                      style={styles.iconButton}
                      onPress={pickPhoto}
                      accessibilityRole="button"
                      accessibilityLabel="Edit photo">
                      <SymbolView
                        name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                        size={16}
                        tintColor={Colors.dark}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => setPhoto(undefined)}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo">
                      <SymbolView
                        name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                        size={16}
                        tintColor={Colors.dark}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.photoFileName} numberOfLines={1}>
                    {photo ? photo.fileName : 'No image selected'}
                  </Text>
                </View>
              </View>
            </View>

            <TextField
              label="Street Address 1"
              placeholder="123 Street Name"
              autoComplete="address-line1"
              value={street}
              onChangeText={onChange('street', setStreet)}
              error={errorFor('street')}
            />
            <TextField
              label="Street Address 2"
              placeholder="Apt, Suite, etc."
              autoComplete="address-line2"
              value={street2}
              onChangeText={onChange('street2', setStreet2)}
              error={errorFor('street2')}
            />
            <TextField
              label="City"
              placeholder="City Name"
              value={city}
              onChangeText={onChange('city', setCity)}
              error={errorFor('city')}
            />
            <PressableField
              label="Country"
              placeholder="Select Country"
              icon="chevron"
              value={selectedCountry?.name}
              disabled={!signupForm}
              onPress={() => setOpenPicker('country')}
              error={errorFor('country')}
            />
            {/* Disabled until a country is chosen and its states are loaded (a country with no
                states leaves it disabled and not required, as on the live form). */}
            <PressableField
              label="State"
              placeholder="Select State"
              icon="chevron"
              value={selectedState?.name}
              disabled={states.length === 0}
              onPress={() => setOpenPicker('state')}
              error={errorFor('state')}
            />
            <TextField
              label="Zip / Postal Code"
              placeholder="12345"
              autoComplete="postal-code"
              value={zip}
              onChangeText={onChange('zip', setZip)}
              error={errorFor('zip')}
            />
            <TextField
              label="Bank Account Number (Optional)"
              autoCorrect={false}
              value={bankAccount}
              onChangeText={setBankAccount}
            />
            <TextField
              label="IFSC / Routing Code (Optional)"
              autoCapitalize="characters"
              autoCorrect={false}
              value={bankIfsc}
              onChangeText={setBankIfsc}
            />
            <TextField
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={onChange('password', setPassword)}
              error={errorFor('password')}
            />
            <TextField
              label="Confirm Password"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={onChange('confirmPassword', setConfirmPassword)}
              error={
                errorFor('confirmPassword') ??
                (passwordsMismatch ? PASSWORD_MISMATCH_MESSAGE : undefined)
              }
            />
          </View>

          {/* Backend messages; each is hidden while empty. */}
          <View style={styles.formMessages}>
            <FormMessage type="error" message={errorMessage} />
            <FormMessage type="success" message={infoMessage} />
          </View>

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
              <Text style={styles.submitText}>Create Account</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            {/* Returns to Login if it's already in the stack (usual path), otherwise opens it. */}
            <Pressable onPress={() => router.dismissTo('/login')} hitSlop={8}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={openPicker === 'dialCode'}
        title="Phone Number"
        items={dialCodeItems}
        selectedKey={dialCode?.key}
        searchPlaceholder="Search country..."
        onSelect={(key) => {
          setDialCode(signupForm?.dialCodes.find((d) => d.key === key) ?? dialCode);
          setPhoneError(undefined);
        }}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === 'country'}
        title="Country"
        items={countryItems}
        selectedKey={countryId}
        searchPlaceholder="Search country..."
        onSelect={selectCountry}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === 'state'}
        title="State"
        items={stateItems}
        selectedKey={stateId}
        // PLACEHOLDER COPY: the live form's State field is a plain <select> with no search box;
        // wording follows the site's "Search country..." pattern.
        searchPlaceholder="Search state..."
        onSelect={(id) => {
          setStateId(id);
          clearMissing('state');
        }}
        onClose={() => setOpenPicker(null)}
      />

      <OtpModal
        visible={otpChannel !== null}
        channel={otpChannel ?? 'email'}
        target={otpChannel === 'whatsapp' ? `+${fullPhone}` : email.trim()}
        onVerify={handleOtpSubmit}
        onResend={handleOtpResend}
        onClose={() => setOtpChannel(null)}
      />

      {Platform.OS === 'ios' && (
        <Modal
          visible={iosDobPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosDobPickerOpen(false)}>
          <Pressable style={styles.dateBackdrop} onPress={() => setIosDobPickerOpen(false)} />
          <View style={styles.dateSheet}>
            <View style={styles.dateSheetHeader}>
              <Pressable
                onPress={() => setIosDobPickerOpen(false)}
                hitSlop={12}
                accessibilityRole="button">
                <Text style={styles.dateDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              mode="date"
              display="spinner"
              value={dob ?? latestBirthDate()}
              maximumDate={latestBirthDate()}
              themeVariant="light"
              textColor={Colors.dark}
              onChange={(_, date) => {
                if (date) {
                  setDob(date);
                  clearMissing('dob');
                }
              }}
            />
          </View>
        </Modal>
      )}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 40,
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
  fields: {
    gap: 18,
  },
  phoneGroup: {
    flexDirection: 'row',
    height: 53,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.phoneGroupBorder,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  phoneGroupFocused: {
    borderColor: Colors.primaryOrange,
  },
  phoneGroupInvalid: {
    borderColor: Colors.errorText,
  },
  // Live site dims the phone group once it's verified.
  locked: {
    opacity: 0.7,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 70,
    paddingHorizontal: 12,
    backgroundColor: Colors.phoneCountryBackground,
    borderEndWidth: 1,
    borderEndColor: Colors.phoneGroupBorder,
  },
  flag: {
    width: 35,
    height: 17.5,
    borderRadius: 2,
  },
  phoneSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  dialCode: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.primarySemiBold,
    fontSize: 14,
    color: Colors.dark,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
  photoActions: {
    flex: 1,
    gap: 10,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoFileName: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.helperText,
  },
  formMessages: {
    marginTop: 24,
    marginBottom: -8,
  },
  submitButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 17,
    color: Colors.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 32,
  },
  footerText: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.mutedText,
  },
  footerLink: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.primaryOrange,
  },
  dateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dateSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  dateSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dateDone: {
    fontFamily: Fonts.primaryBold,
    fontSize: 17,
    color: Colors.primaryOrange,
  },
});
