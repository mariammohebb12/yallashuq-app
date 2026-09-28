import { router, useFocusEffect, type Href } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { signOut } from '@/api/auth';
import { fetchProfileDetails, type ProfileDetails } from '@/api/profile';
import { fetchSession, type Session } from '@/api/session';
import { ComingSoonBadge } from '@/components/coming-soon';
import { FormMessage } from '@/components/form-message';
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
 * /my/warranties), so none here either.
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

const COPY = {
  // Confirmed from the live "My Account" page.
  cards: {
    shop: {
      title: 'Continue Shopping',
      description: 'Browse categories and discover products',
    },
    orders: { title: 'My Orders', description: 'Check order history and tracking updates' },
    documents: {
      title: 'Marketplace Documents',
      description: 'View your order confirmations and receipts',
    },
    giftCards: {
      title: 'Gift & Vouchers',
      description: 'View your available gift cards and vouchers',
    },
    wallet: { title: 'eWallet', description: 'Manage your balance and view transaction history' },
    security: {
      title: 'Connection & Security',
      description: 'Configure your connection parameters',
    },
    // Confirmed from the live /contactus page (its heading and intro line); the live "My
    // Account" page has no such card — the site links it from the header ("Contact Support").
    contact: {
      title: 'Contact Us',
      description: 'Share your query and our team will get back to you quickly.',
    },
    // Confirmed from the live /helpdesk page's heading. No description: the live site has no
    // visible link card for this form (only a hidden default "Help" menu item).
    helpdesk: { title: 'Submit a Ticket' },
    // Confirmed from the live "My Account" page's Tickets card (present in its HTML, but hidden
    // there with d-none).
    tickets: { title: 'Tickets', description: 'Follow all your helpdesk tickets' },
    // Confirmed from the live "My Account" page's Quotations card (hidden there with d-none); it
    // has a title only.
    quotations: { title: 'Quotations to review' },
    // Confirmed from the live /my/invoices page's heading. No description: the live account
    // page's invoice cards say "Follow, download or pay …" and this screen has no payment.
    invoices: { title: 'Invoices & Bills' },
  },
  editInformation: 'Edit information',
  // From the client's request (2026-09-28). The live site's link says "Log Out" / "Logout".
  signOut: 'Sign Out',
  // PLACEHOLDER COPY (not confirmed anywhere).
  address: 'Address',
  phone: 'Phone',
  email: 'Email',
  missing: 'Not available yet',
  // From the client's request (2026-09-28): shown only when the customer has none saved.
  addAddress: 'Add your address',
  addPhone: 'Add your phone number',
};

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
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [signingOut, setSigningOut] = useState(false);
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
  const groups: AccountCard[][] = [
    [
      { key: 'shop', ...COPY.cards.shop, href: '/shop', icon: sym('bag', 'shopping_bag') },
      {
        key: 'orders',
        ...COPY.cards.orders,
        href: '/my/orders',
        icon: sym('shippingbox', 'package_2'),
      },
      {
        key: 'documents',
        ...COPY.cards.documents,
        href: '/my/documents',
        icon: sym('doc.text', 'description'),
      },
    ],
    [
      // MISSING: gift-card count (live "0 Cards") — no JSON source confirmed yet.
      {
        key: 'giftCards',
        ...COPY.cards.giftCards,
        href: '/my/gift-cards',
        icon: sym('giftcard', 'redeem'),
        badge: null,
      },
      // MISSING: eWallet balance (live "₪0.00") — no JSON source confirmed yet.
      {
        key: 'wallet',
        ...COPY.cards.wallet,
        href: '/my/wallet',
        icon: sym('wallet.pass', 'account_balance_wallet'),
        badge: null,
      },
    ],
    [{ key: 'security', ...COPY.cards.security, href: '/my/security', icon: sym('lock', 'lock') }],
    [
      { key: 'contact', ...COPY.cards.contact, href: '/contactus', icon: sym('envelope', 'mail') },
      {
        key: 'helpdesk',
        ...COPY.cards.helpdesk,
        href: '/helpdesk',
        icon: sym('lifepreserver', 'support'),
      },
      {
        key: 'tickets',
        ...COPY.cards.tickets,
        href: '/my/tickets',
        icon: sym('ticket', 'confirmation_number'),
      },
    ],
    [
      {
        key: 'quotations',
        ...COPY.cards.quotations,
        href: '/my/quotes',
        icon: sym('doc.plaintext', 'request_quote'),
      },
      {
        key: 'invoices',
        ...COPY.cards.invoices,
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
          label={COPY.address}
          value={details && details.addressLines.join('\n')}
          emptyText={COPY.addAddress}
        />
        <ProfileRow
          icon="phone"
          label={COPY.phone}
          value={details && (details.phone ?? '')}
          emptyText={COPY.addPhone}
        />
        <ProfileRow icon="email" label={COPY.email} value={email} />

        <Pressable
          onPress={() => router.push('/my/edit-information')}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.editLink}>
          <Text style={styles.editLinkText}>{COPY.editInformation}</Text>
        </Pressable>
      </View>
      {groups.map((group) => (
        <View key={group[0].key} style={[styles.card, styles.group]}>
          {group.map((card, index) => (
            <Pressable
              key={card.key}
              onPress={() => router.push(card.href)}
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
                  <MissingValue />
                ) : (
                  <Text style={styles.badge}>{card.badge}</Text>
                ))}
              {/* "forward" flips to point left in Arabic/Hebrew. */}
              <SymbolView
                name={{ ios: 'chevron.forward', android: 'chevron_right', web: 'chevron_right' }}
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
            <Text style={styles.cardTitle}>{COPY.signOut}</Text>
          </View>
          {signingOut && <ActivityIndicator color={Colors.primaryOrange} />}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function sym(ios: string, android: string): SymbolViewProps['name'] {
  return { ios, android, web: android } as SymbolViewProps['name'];
}

/** A value the backend doesn't provide (yet) — shown as such, never as a made-up value. */
function MissingValue() {
  return <ComingSoonBadge label={COPY.missing} style={styles.missing} />;
}

/**
 * `value`: the text; '' = the customer has none saved (shows `emptyText` as a grey italic
 * empty-field placeholder — display only, tapping does nothing); null = unknown (couldn't be read).
 */
function ProfileRow({
  icon,
  label,
  value,
  emptyText,
}: {
  icon: 'address' | 'phone' | 'email';
  label: string;
  value: string | null;
  emptyText?: string;
}) {
  const empty = value === '' && emptyText !== undefined;
  return (
    <View
      // Icon at the top of a multi-line address, as on the live page.
      style={[styles.profileRow, !empty && styles.profileRowTop]}
      accessible
      accessibilityLabel={`${label}: ${empty ? emptyText : value || COPY.missing}`}>
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
        <MissingValue />
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
