import { router, useFocusEffect, type Href } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { signOut } from '@/api/auth';
import { fetchProfileDetails, type ProfileDetails } from '@/api/profile';
import { fetchSession, type Session } from '@/api/session';
import { ComingSoonBadge } from '@/components/coming-soon';
import { FormMessage } from '@/components/form-message';
import { PickerModal } from '@/components/picker-modal';
import { setAppLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n/direction';
import { chevronForwardIcon } from '@/theme/directional-icon';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

import LoginScreen from '@/app/login';

/*
 * Account tab — the live "My Account" page (yallashuq.com/my).
 *
 * Signed out: shows the existing Login screen, as the live site redirects /my to login (confirmed).
 * Signed in: the live page's cards (Continue Shopping, My Orders, Marketplace Documents,
 * Gift & Vouchers, eWallet) and the profile panel.
 * Returns / Warranties have no card on the live page (their pages do exist: /my/returns,
 * /my/warranties). My Returns has a row here anyway (client request 2026-09-28, app-only), right
 * after My Orders; Warranties has none.
 *
 * DATA — real: the session (fetchSession: name + login), and address + phone read from the live
 * /my page's profile panel (fetchProfileDetails, TEMPORARY HTML workaround, 2026-09-28). An
 * address/phone the customer hasn't saved shows as a grey italic empty-field placeholder (client
 * request 2026-09-28); if the page can't be read, "Not available yet". MISSING, shown with a
 * clearly marked "Not available yet" instead of a value: gift-card count and eWallet balance. Requested in docs/backend-requests/004-account-summary-json.md (still to be
 * checked against the staging test account — /my/counters may already cover the last two).
 * Email: the login is shown as the email only when it is one (customers can sign in with a phone).
 *
 * Phone layout (confirmed 2026-09-25): the desktop page's side-by-side columns are reflowed to a
 * single column — profile panel at the top, then the links below it.
 * Links (client request 2026-09-28, app-only design): settings-style rows — icon, title (+ the
 * live description, when there is one), the row's value if it has one, chevron — grouped into
 * rounded white cards with thin dividers. Groups are consecutive runs of the existing order (no
 * reordering, no group headings); the icons are standard SF Symbols / Material icons chosen here.
 * Sign Out (client request 2026-09-28): the last row, on its own; it's an action, so no chevron.
 * It ends the session (src/api/auth.ts signOut) and the tab then shows the Login screen.
 */

// Copy moved into src/i18n/locales/en.json under the "account" key (RTL/i18n work,
// 2026-10-01) — see that file for the same strings with their original sourcing notes
// (confirmed-from-live-site vs. placeholder). Looked up here via useTranslation()/t().

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'signedOut' }
  /** `details` null = couldn't read the address/phone (shown as "Not available yet"). */
  | { status: 'signedIn'; session: Session; details: ProfileDetails | null };

type AccountCard = {
  key: string;
  icon: SymbolViewProps['name'];
  title: string;
  /** Omitted when the live site has no confirmed description for this link. */
  description?: string;
  href: Href;
  /** Right-hand value (live: "0 Cards", "₪0.00"). `null` = missing from the backend so far. */
  badge?: string | null;
};

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [signingOut, setSigningOut] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const [result, detailsResult] = await Promise.all([fetchSession(), fetchProfileDetails()]);
    if (request !== requestId.current) {
      return;
    }
    if (!result.ok) {
      setState({ status: 'error', message: result.message });
    } else if (result.session) {
      setState({
        status: 'signedIn',
        session: result.session,
        details: detailsResult.ok ? detailsResult.details : null,
      });
    } else {
      setState({ status: 'signedOut' });
    }
  }, []);

  // Re-check on every visit (signing in/out can happen elsewhere, e.g. after signup).
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++;
      };
    }, [load])
  );

  async function handleSignOut() {
    if (signingOut) {
      return; // One request at a time.
    }
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    await load(); // Now signed out: the tab shows the Login screen.
  }

  if (state.status === 'loading') {
    return (
      <View style={[styles.page, styles.centered]}>
        <ActivityIndicator color={Colors.primaryOrange} />
      </View>
    );
  }
  if (state.status === 'signedOut') {
    return <LoginScreen onSignedIn={load} />;
  }
  if (state.status === 'error') {
    return (
      <View style={[styles.page, styles.content]}>
        <FormMessage type="error" message={state.message} />
      </View>
    );
  }

  const { session, details } = state;
  // `t()` with no interpolation returns a string even when the key resolves to an object path
  // mistake would show the key itself — titles/descriptions below are all leaf string keys.
  const groups: AccountCard[][] = [
    [
      {
        key: 'shop',
        title: t('account.cards.shop.title'),
        description: t('account.cards.shop.description'),
        href: '/shop',
        icon: sym('bag', 'shopping_bag'),
      },
      {
        key: 'orders',
        title: t('account.cards.orders.title'),
        description: t('account.cards.orders.description'),
        href: '/my/orders',
        icon: sym('shippingbox', 'package_2'),
      },
      {
        key: 'returns',
        title: t('account.cards.returns.title'),
        href: '/my/returns',
        icon: sym('arrow.uturn.backward', 'assignment_return'),
      },
      {
        key: 'documents',
        title: t('account.cards.documents.title'),
        description: t('account.cards.documents.description'),
        href: '/my/documents',
        icon: sym('doc.text', 'description'),
      },
      // Address Book (app-only, client request 2026-10-02, tracker #22) — no live-site card.
      {
        key: 'addresses',
        title: t('account.cards.addresses.title'),
        href: '/my/addresses',
        icon: sym('mappin.and.ellipse', 'location_on'),
      },
    ],
    [
      // MISSING: gift-card count (live "0 Cards") — no JSON source confirmed yet.
      {
        key: 'giftCards',
        title: t('account.cards.giftCards.title'),
        description: t('account.cards.giftCards.description'),
        href: '/my/gift-cards',
        icon: sym('giftcard', 'redeem'),
        badge: null,
      },
      // MISSING: eWallet balance (live "₪0.00") — no JSON source confirmed yet.
      {
        key: 'wallet',
        title: t('account.cards.wallet.title'),
        description: t('account.cards.wallet.description'),
        href: '/my/wallet',
        icon: sym('wallet.pass', 'account_balance_wallet'),
        badge: null,
      },
    ],
    [
      {
        key: 'security',
        title: t('account.cards.security.title'),
        description: t('account.cards.security.description'),
        href: '/my/security',
        icon: sym('lock', 'lock'),
      },
    ],
    [
      {
        key: 'language',
        title: t('account.cards.language.title'),
        description: t('account.cards.language.description'),
        // Not a real route — opened via the row's own onPress override below.
        href: '/my/security',
        icon: sym('globe', 'language'),
        badge: t(`languagePicker.names.${i18n.language}`),
      },
    ],
    [
      {
        key: 'contact',
        title: t('account.cards.contact.title'),
        description: t('account.cards.contact.description'),
        href: '/contactus',
        icon: sym('envelope', 'mail'),
      },
      {
        key: 'helpdesk',
        title: t('account.cards.helpdesk.title'),
        href: '/helpdesk',
        icon: sym('lifepreserver', 'support'),
      },
      {
        key: 'tickets',
        title: t('account.cards.tickets.title'),
        description: t('account.cards.tickets.description'),
        href: '/my/tickets',
        icon: sym('ticket', 'confirmation_number'),
      },
    ],
    [
      {
        key: 'quotations',
        title: t('account.cards.quotations.title'),
        href: '/my/quotes',
        icon: sym('doc.plaintext', 'request_quote'),
      },
      {
        key: 'invoices',
        title: t('account.cards.invoices.title'),
        href: '/my/invoices',
        icon: sym('list.bullet.rectangle', 'receipt_long'),
      },
    ],
  ];
  const email = session.login.includes('@') ? session.login : null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={[styles.card, styles.profile]}>
        <View style={styles.avatar}>
          <SymbolView
            name={{ ios: 'person.fill', android: 'person', web: 'person' }}
            size={28}
            tintColor={Colors.primaryOrange}
          />
        </View>
        <Text style={styles.profileName}>{session.name}</Text>

        <ProfileRow
          icon="address"
          label={t('account.address')}
          value={details && details.addressLines.join('\n')}
          emptyText={t('account.addAddress')}
          missingLabel={t('account.missing')}
        />
        <ProfileRow
          icon="phone"
          label={t('account.phone')}
          value={details && (details.phone ?? '')}
          emptyText={t('account.addPhone')}
          missingLabel={t('account.missing')}
        />
        <ProfileRow
          icon="email"
          label={t('account.email')}
          value={email}
          missingLabel={t('account.missing')}
        />

        <Pressable
          onPress={() => router.push('/my/edit-information')}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.editLink}>
          <Text style={styles.editLinkText}>{t('account.editInformation')}</Text>
        </Pressable>
      </View>
      {groups.map((group) => (
        <View key={group[0].key} style={[styles.card, styles.group]}>
          {group.map((card, index) => (
            <Pressable
              key={card.key}
              onPress={() =>
                card.key === 'language' ? setLanguagePickerVisible(true) : router.push(card.href)
              }
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel={
                card.description ? `${card.title}. ${card.description}` : card.title
              }>
              {index > 0 && <View style={styles.divider} />}
              <SymbolView
                name={card.icon}
                size={20}
                tintColor={Colors.primaryOrange}
                style={styles.rowIcon}
              />
              <View style={styles.rowText}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                {card.description ? (
                  <Text style={styles.cardDescription}>{card.description}</Text>
                ) : null}
              </View>
              {card.badge !== undefined &&
                (card.badge === null ? (
                  <MissingValue label={t('account.missing')} />
                ) : (
                  <Text style={styles.badge}>{card.badge}</Text>
                ))}
              {/* iOS auto-flips "forward"; android/web name is swapped by hand for RTL. */}
              <SymbolView
                name={chevronForwardIcon()}
                size={13}
                weight="semibold"
                tintColor={Colors.placeholderIcon}
              />
            </Pressable>
          ))}
        </View>
      ))}

      <View style={[styles.card, styles.group]}>
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityState={{ disabled: signingOut, busy: signingOut }}>
          <SymbolView
            name={sym('rectangle.portrait.and.arrow.right', 'logout')}
            size={20}
            tintColor={Colors.primaryOrange}
            style={styles.rowIcon}
          />
          <View style={styles.rowText}>
            <Text style={styles.cardTitle}>{t('account.signOut')}</Text>
          </View>
          {signingOut && <ActivityIndicator color={Colors.primaryOrange} />}
        </Pressable>
      </View>

      <PickerModal
        visible={languagePickerVisible}
        title={t('languagePicker.title')}
        selectedKey={i18n.language}
        items={SUPPORTED_LANGUAGES.map((code) => ({
          key: code,
          label: t(`languagePicker.names.${code}`),
        }))}
        onSelect={(key) => {
          // setAppLanguage persists the choice and reloads the app if the RTL/LTR
          // direction changed (see src/i18n/direction.ts).
          setAppLanguage(key as (typeof SUPPORTED_LANGUAGES)[number]);
        }}
        onClose={() => setLanguagePickerVisible(false)}
      />
    </ScrollView>
  );
}

function sym(ios: string, android: string): SymbolViewProps['name'] {
  return { ios, android, web: android } as SymbolViewProps['name'];
}

/** A value the backend doesn't provide (yet) — shown as such, never as a made-up value. */
function MissingValue({ label }: { label: string }) {
  return <ComingSoonBadge label={label} style={styles.missing} />;
}

/**
 * `value`: the text; '' = the customer has none saved (shows `emptyText` as a grey italic
 * empty-field placeholder — display only, tapping does nothing); null = unknown (couldn't be read).
 * `missingLabel`: the translated "Not available yet" text — passed in rather than looked up here,
 * since this isn't a hook-using component.
 */
function ProfileRow({
  icon,
  label,
  value,
  emptyText,
  missingLabel,
}: {
  icon: 'address' | 'phone' | 'email';
  label: string;
  value: string | null;
  emptyText?: string;
  missingLabel: string;
}) {
  const empty = value === '' && emptyText !== undefined;
  return (
    <View
      // Icon at the top of a multi-line address, as on the live page.
      style={[styles.profileRow, !empty && styles.profileRowTop]}
      accessible
      accessibilityLabel={`${label}: ${empty ? emptyText : value || missingLabel}`}>
      <SymbolView
        name={
          icon === 'address'
            ? { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }
            : icon === 'phone'
              ? { ios: 'phone', android: 'call', web: 'call' }
              : { ios: 'envelope', android: 'mail', web: 'mail' }
        }
        size={15}
        tintColor={Colors.helperText}
        style={!empty && styles.profileIconTop}
      />
      {empty ? (
        <View style={styles.emptyField}>
          <Text style={styles.emptyFieldText} numberOfLines={1}>
            {emptyText}
          </Text>
        </View>
      ) : value ? (
        <Text style={styles.profileValue}>{value}</Text>
      ) : (
        <MissingValue label={missingLabel} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    // Clears the floating MishMesh launcher (56px + 16px offset) at the end of the page.
    paddingBottom: 88,
  },
  // One rounded card per group of rows, below the profile.
  group: {
    marginTop: 14,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  // Thin divider between rows, inset to start after the icon (14 padding + 20 icon + 12 gap).
  divider: {
    position: 'absolute',
    top: 0,
    start: 46,
    end: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.inputBorder,
  },
  rowPressed: {
    backgroundColor: Colors.pageBackground,
  },
  rowIcon: {
    width: 20,
    height: 20,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.sectionHeading,
  },
  cardDescription: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.mutedText,
  },
  badge: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    color: Colors.primaryOrange,
  },
  missing: {},
  profile: {
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 20,
    color: Colors.sectionHeading,
    textAlign: 'center',
  },
  profileRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileRowTop: {
    alignItems: 'flex-start',
  },
  // Centres the 15px icon on the first 14px text line.
  profileIconTop: {
    marginTop: 2,
  },
  // Looks like an empty input: light box, grey italic placeholder (like the search bar's).
  emptyField: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.pageBackground,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  emptyFieldText: {
    fontFamily: Fonts.primaryItalic,
    fontSize: 14,
    color: Colors.placeholderIcon,
  },
  profileValue: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.dark,
  },
  editLink: {
    marginTop: 4,
  },
  editLinkText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.85,
  },
});
