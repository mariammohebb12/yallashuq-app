import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

// Exact text of the live seller signup page's terms modal (#termsModal, auth_login.xml).
// Do not reword.
const POLICY_TITLE = 'Marketplace Commission Policy';
const POLICY_ITEMS = [
  'The platform charges a commission on each successful order placed through the marketplace.',
  'The commission rate may vary depending on the seller account, product category, or subscription plan.',
  'Commission is automatically deducted before releasing payouts to the seller.',
  'Sellers can view their applicable commission rate in their seller dashboard.',
  'The platform reserves the right to update commission structures when necessary.',
  'For customer return requests, seller must approve or reject before pickup scheduling.',
  'If seller approves a return, pickup/delivery charges are borne by seller and may be adjusted from seller payout settlement.',
  'For damaged-product returns, seller is responsible for refund issuance. For quality issue, size/fit issue, or wrong item, admin handles refund issuance.',
  'Admin intervenes only in escalated or serious dispute cases.',
];
const POLICY_NOTE =
  'By checking the agreement box on the registration form, you acknowledge that you have read, understood, and agree to be bound by these policies.';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** "Accept & Close": on the live site this also ticks the agreement checkbox. */
  onAccept: () => void;
};

export function CommissionPolicyModal({ visible, onClose, onAccept }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{POLICY_TITLE}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={16}
                tintColor={Colors.dark}
              />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {POLICY_ITEMS.map((item, index) => (
              <View key={index} style={styles.item}>
                <Text style={styles.itemNumber}>{index + 1}.</Text>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
            <View style={styles.note}>
              <Text style={styles.noteText}>{POLICY_NOTE}</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.button, styles.closeButton, pressed && styles.pressed]}
              onPress={onClose}
              accessibilityRole="button">
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.button, styles.acceptButton, pressed && styles.pressed]}
              onPress={onAccept}
              accessibilityRole="button">
              <Text style={styles.acceptText}>Accept & Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    maxHeight: '90%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  item: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  itemNumber: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    lineHeight: 27,
    color: Colors.policyText,
  },
  itemText: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 15,
    lineHeight: 27,
    color: Colors.policyText,
  },
  // Live: background #f8fafc with a 4px orange left border.
  note: {
    marginTop: 8,
    padding: 20,
    borderRadius: 8,
    borderStartWidth: 4,
    borderStartColor: Colors.primaryOrange,
    backgroundColor: Colors.phoneCountryBackground,
  },
  noteText: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    lineHeight: 22,
    color: Colors.policyText,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.85,
  },
  // PENDING CONFIRMATION: the live "Close" is Bootstrap's btn-secondary, whose theme color isn't
  // in the page source; shown as a neutral outlined pill for now.
  closeButton: {
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
  },
  closeText: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark,
  },
  acceptButton: {
    backgroundColor: Colors.primaryOrange,
  },
  acceptText: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
