import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchSession } from '@/api/session';
import { TextField } from '@/components/form-fields';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Connection & Security — the live /my/security page (opened from the Account tab).
 *
 * ⚠️ NOTHING HERE WORKS YET — EVERY FIELD AND BUTTON IS DISABLED ⚠️
 * The live actions are real and consequential (change password, enable 2FA, log out from all
 * devices, delete account), and the app doesn't call any of their routes yet (live: HTML form
 * posts to /my/security and /my/deactivate_account; 2FA and "log out from all devices" are
 * Odoo dialogs). So nothing can be typed, tapped or submitted: no fake success, no silent no-op.
 *
 * The live page's sections, in its order, in one column: Change Password; Two-factor
 * authentication; Revoke All Sessions; Delete Account (the live confirmation popup's contents are
 * shown inline, since its button can't open it). No login history or session list — the live
 * page has neither.
 * The 2FA status line is the staging test account's real state ("not enabled"); the app can't read
 * a user's 2FA status yet.
 */

const COPY = {
  // Confirmed from the live /my/security page.
  title: 'Connection & Security',
  changePassword: 'Change Password',
  password: 'Password:',
  newPassword: 'New Password:',
  verifyNewPassword: 'Verify New Password:',
  twoFactor: 'Two-factor authentication',
  twoFactorNotEnabled: 'Two-factor authentication not enabled',
  enableTwoFactor: 'Enable two-factor authentication',
  revokeAllSessions: 'Revoke All Sessions',
  logOutAllDevices: 'Log out from all devices',
  deleteAccount: 'Delete Account',
  deleteWarning: 'Disable your account, preventing any further login.',
  cannotBeUndone: 'This action cannot be undone.',
  deleteStep1: '1. Enter your password to confirm you own this account',
  deleteStep2: (login: string) =>
    `2. Confirm you want to delete your account by copying down your login (${login}).`,
  passwordPlaceholder: 'Password',
  blockList: "Put my email and phone in a block list to make sure I'm never contacted again",
  // PLACEHOLDER COPY (not confirmed anywhere).
  notAvailable: 'Not available in the app yet — these settings can only be changed on the website',
  comingSoon: 'Coming soon',
  yourLogin: 'your login',
  loginField: 'Login',
};

export default function SecurityScreen() {
  const [login, setLogin] = useState<string | null>(null);
  const requestId = useRef(0);

  // Real: the signed-in login, which the live "Delete Account" step 2 quotes.
  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchSession();
    if (id === requestId.current && result.ok && result.session) {
      setLogin(result.session.login || null);
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

        <View style={styles.sections}>
          {/* ---- Change Password ---- */}
          <Card title={COPY.changePassword}>
            <DisabledPassword label={COPY.password} />
            <DisabledPassword label={COPY.newPassword} />
            <DisabledPassword label={COPY.verifyNewPassword} />
            <DisabledButton label={COPY.changePassword} />
          </Card>

          {/* ---- Two-factor authentication ---- */}
          <Card title={COPY.twoFactor}>
            <Text style={styles.body}>{COPY.twoFactorNotEnabled}</Text>
            <DisabledButton label={COPY.enableTwoFactor} />
          </Card>

          {/* ---- Revoke All Sessions ---- */}
          <Card title={COPY.revokeAllSessions}>
            <DisabledButton label={COPY.logOutAllDevices} />
          </Card>

          {/* ---- Delete Account (the live popup's contents, inline) ---- */}
          <Card title={COPY.deleteAccount}>
            <Text style={styles.warning}>{COPY.deleteWarning}</Text>
            <Text style={styles.warning}>{COPY.cannotBeUndone}</Text>
            <Text style={styles.body}>{COPY.deleteStep1}</Text>
            <TextField
              label={COPY.password}
              placeholder={COPY.passwordPlaceholder}
              secureTextEntry
              editable={false}
            />
            <Text style={styles.body}>{COPY.deleteStep2(login ?? COPY.yourLogin)}</Text>
            <TextField label={COPY.loginField} editable={false} autoCapitalize="none" />
            <View
              style={styles.checkRow}
              accessible
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false, disabled: true }}
              accessibilityLabel={COPY.blockList}>
              <View style={styles.checkbox} />
              <Text style={[styles.body, styles.checkLabel]}>{COPY.blockList}</Text>
            </View>
            <DisabledButton label={COPY.deleteAccount} />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DisabledPassword({ label }: { label: string }) {
  return <TextField label={label} secureTextEntry editable={false} />;
}

/** Same disabled "Coming soon" button as Order Detail / the return form. Not pressable. */
function DisabledButton({ label }: { label: string }) {
  return (
    <View
      style={styles.disabledButton}
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={`${label}, ${COPY.comingSoon}`}>
      <Text style={styles.disabledButtonText}>{label}</Text>
      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonText}>{COPY.comingSoon}</Text>
      </View>
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
  sections: {
    gap: 14,
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
  sectionTitle: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.sectionHeading,
  },
  body: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.dark,
  },
  warning: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.errorText,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    opacity: 0.6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
    backgroundColor: Colors.inputBackground,
  },
  checkLabel: {
    flex: 1,
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
