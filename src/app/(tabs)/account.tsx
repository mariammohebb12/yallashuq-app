import { router, useFocusEffect, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchSession, type Session } from '@/api/session';
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
 * DATA — only the session is real so far (fetchSession: name + login). MISSING, shown with a
 * clearly marked "Not available yet" instead of a value: address, phone, gift-card count and
 * eWallet balance. Requested in docs/backend-requests/004-account-summary-json.md (still to be
 * checked against the staging test account — /my/counters may already cover the last two).
 * Email: the login is shown as the email only when it is one (customers can sign in with a phone).
 *
 * Phone layout (confirmed 2026-09-25): the desktop page's side-by-side columns are reflowed to a
 * single column — profile panel at the top, then the 5 cards stacked one per row.
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
  },
  editInformation: 'Edit information',
  // PLACEHOLDER COPY (not confirmed anywhere).
  address: 'Address',
  phone: 'Phone',
  email: 'Email',
  missing: 'Not available yet',
};

type ScreenState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session };

type AccountCard = {
  key: string;
  title: string;
  description: string;
  href: Href;
  /** Right-hand value (live: "0 Cards", "₪0.00"). `null` = missing from the backend so far. */
  badge?: string | null;
};

export default function AccountScreen() {
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const result = await fetchSession();
    if (request !== requestId.current) {
      return;
    }
    if (!result.ok) {
      setState({ status: 'error', message: result.message });
    } else if (result.session) {
      setState({ status: 'signedIn', session: result.session });
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

  const { session } = state;
  const cards: AccountCard[] = [
    { key: 'shop', ...COPY.cards.shop, href: '/shop' },
    { key: 'orders', ...COPY.cards.orders, href: '/my/orders' },
    { key: 'documents', ...COPY.cards.documents, href: '/my/documents' },
    // MISSING: gift-card count (live "0 Cards") — no JSON source confirmed yet.
    { key: 'giftCards', ...COPY.cards.giftCards, href: '/my/gift-cards', badge: null },
    // MISSING: eWallet balance (live "₪0.00") — no JSON source confirmed yet.
    { key: 'wallet', ...COPY.cards.wallet, href: '/my/wallet', badge: null },
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

        {/* MISSING: address and phone aren't in the session data. */}
        <ProfileRow icon="address" label={COPY.address} value={null} />
        <ProfileRow icon="phone" label={COPY.phone} value={null} />
        <ProfileRow icon="email" label={COPY.email} value={email} />

        <Pressable
          onPress={() => router.push('/my/edit-information')}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.editLink}>
          <Text style={styles.editLinkText}>{COPY.editInformation}</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {cards.map((card) => (
          <View key={card.key}>
            <Pressable
              onPress={() => router.push(card.href)}
              style={({ pressed }) => [styles.card, styles.linkCard, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${card.title}. ${card.description}`}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDescription}>{card.description}</Text>
              {card.badge !== undefined &&
                (card.badge === null ? (
                  <MissingValue />
                ) : (
                  <Text style={styles.badge}>{card.badge}</Text>
                ))}
            </Pressable>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

/** A value the backend doesn't provide (yet) — shown as such, never as a made-up value. */
function MissingValue() {
  return (
    <View style={styles.missing}>
      <Text style={styles.missingText}>{COPY.missing}</Text>
    </View>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: 'address' | 'phone' | 'email';
  label: string;
  value: string | null;
}) {
  return (
    <View style={styles.profileRow} accessible accessibilityLabel={`${label}: ${value ?? COPY.missing}`}>
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
      />
      {value !== null ? <Text style={styles.profileValue}>{value}</Text> : <MissingValue />}
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
  // Single column of cards below the profile.
  grid: {
    marginTop: 14,
    gap: 10,
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
  linkCard: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.sectionHeading,
  },
  cardDescription: {
    fontFamily: Fonts.primary,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.mutedText,
  },
  badge: {
    alignSelf: 'flex-start',
    fontFamily: Fonts.primary,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryOrange,
  },
  missing: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: Colors.inputBorder,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  missingText: {
    fontFamily: Fonts.primary,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.mutedText,
  },
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
    fontFamily: Fonts.primary,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.sectionHeading,
    textAlign: 'center',
  },
  profileRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryOrange,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.85,
  },
});
