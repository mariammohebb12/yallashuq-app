import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
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

import { fetchReviewInfo, type ReviewInfo } from '@/api/orders';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * The live order review popup (#product_review_modal on /my/orders) — layout, copy and colors
 * from the live markup, behavior from its script: if the customer already reviewed the product,
 * it opens pre-filled with their rating and comment ("Update Your Experience" / "Update") so they
 * can keep or change them; otherwise it starts empty ("Rate Your Experience" / "Submit").
 * Opened by "Edit Review" on the My Orders list.
 *
 * VISUAL ONLY FOR NOW: "Update"/"Submit" just closes the popup; nothing is submitted. The live site saves
 * through the existing JSON route /my/orders/review/submit — to be wired once orders are real
 * (#005; see src/api/orders.ts). The live page's "Please select a star rating." check comes with
 * that step too.
 */

const COPY = {
  // Confirmed from the live review popup and its script.
  title: 'Rate Your Experience',
  updateTitle: 'Update Your Experience',
  orderDate: (date: string) => `Order Date: ${date}`,
  tapToRate: 'Tap to Rate',
  feedback: 'ADDITIONAL FEEDBACK',
  feedbackPlaceholder: 'Tell us about the quality, fit or any details...',
  cancel: 'Cancel',
  submit: 'Submit',
  update: 'Update',
  // PLACEHOLDER COPY (not confirmed anywhere).
  close: 'Close',
  star: (value: number) => `${value} star${value === 1 ? '' : 's'}`,
  notFound: "This order's product could not be loaded.",
};

type Props = {
  /** Order to review; null hides the popup. */
  orderId: number | null;
  onClose: () => void;
};

export function ReviewModal({ orderId, onClose }: Props) {
  return (
    <Modal visible={orderId !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Mounted per opening, so every opening starts from the backend's data. */}
        {orderId !== null && <ReviewCard key={orderId} orderId={orderId} onClose={onClose} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReviewCard({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const [info, setInfo] = useState<ReviewInfo | null | 'loading'>('loading');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    let active = true;
    fetchReviewInfo(orderId).then((result) => {
      if (!active) {
        return;
      }
      const loaded = result.ok ? result.info : null;
      setInfo(loaded);
      // An existing review is shown as-is, for the customer to keep or change.
      if (loaded) {
        setRating(loaded.existingRating);
        setComment(loaded.existingComment);
      }
    });
    return () => {
      active = false;
    };
  }, [orderId]);

  const isUpdate = info !== 'loading' && info !== null && info.isUpdate;

  return (
    <View style={styles.card} accessibilityViewIsModal>
      <View style={styles.header}>
        <Text style={styles.title}>{isUpdate ? COPY.updateTitle : COPY.title}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={COPY.close}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            size={16}
            tintColor={Colors.ratingValue}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        bounces={false}>
        {info === 'loading' ? (
          <View style={styles.productSummary}>
            <ActivityIndicator color={Colors.primaryOrange} />
          </View>
        ) : info === null ? (
          <View style={styles.productSummary}>
            <Text style={styles.orderDate}>{COPY.notFound}</Text>
          </View>
        ) : (
          <View style={styles.productSummary}>
            <View style={styles.productImage}>
              {info.productImageUrl ? (
                <Image
                  source={{ uri: info.productImageUrl }}
                  style={styles.productImageFill}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <SymbolView
                  name={{ ios: 'photo', android: 'image', web: 'image' }}
                  size={20}
                  tintColor={Colors.placeholderIcon}
                />
              )}
            </View>
            <View style={styles.productText}>
              <Text style={styles.productName}>{info.productName}</Text>
              <Text style={styles.orderDate}>{COPY.orderDate(info.orderDateFormatted)}</Text>
            </View>
          </View>
        )}

        <View style={styles.ratingBlock}>
          <Text style={styles.tapToRate}>{COPY.tapToRate}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = value <= rating;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRating(value)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={COPY.star(value)}
                  accessibilityState={{ selected: value === rating }}>
                  <SymbolView
                    name={
                      filled
                        ? { ios: 'star.fill', android: 'star', web: 'star' }
                        : { ios: 'star', android: 'star_outline', web: 'star_outline' }
                    }
                    size={32}
                    tintColor={filled ? Colors.ratingStar : Colors.starEmpty}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.feedbackLabel}>{COPY.feedback}</Text>
        <TextInput
          style={styles.feedbackInput}
          value={comment}
          onChangeText={setComment}
          placeholder={COPY.feedbackPlaceholder}
          placeholderTextColor={Colors.placeholderIcon}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View style={styles.buttons}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, styles.cancelText]}>{COPY.cancel}</Text>
          </Pressable>
          {/* VISUAL ONLY: closes without submitting (see the header comment). */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.updateButton, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, styles.updateText]}>
              {isUpdate ? COPY.update : COPY.submit}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
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
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  // Live: 'Playfair Display', #0F172A, 700, 1.5rem.
  title: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.ratingValue,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
  },
  // Live: grey panel (#f8fafc), rounded, 60×60 image with a #e2e8f0 border.
  productSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.phoneCountryBackground,
    minHeight: 84,
    marginBottom: 24,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageFill: {
    width: '100%',
    height: '100%',
  },
  productText: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.ratingValue,
  },
  orderDate: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.mutedText,
  },
  ratingBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  // Live: Archivo, uppercase, letter-spacing 1px, small, muted.
  tapToRate: {
    fontFamily: Fonts.secondary,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.mutedText,
    marginBottom: 8,
  },
  // Live: 32px stars with 4px padding and an 8px gap.
  stars: {
    flexDirection: 'row',
    gap: 16,
  },
  feedbackLabel: {
    fontFamily: Fonts.secondary,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.mutedText,
    marginBottom: 8,
  },
  // Live: 4 rows, 12px radius, Archivo 14px, white background.
  feedbackInput: {
    minHeight: 104,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: Fonts.secondary,
    fontSize: 14,
    color: Colors.dark,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
  },
  cancelText: {
    color: Colors.cancelText,
  },
  updateButton: {
    backgroundColor: Colors.reviewLink,
  },
  updateText: {
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
