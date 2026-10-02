import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

import { fetchReviewInfo, submitReview, type ReviewInfo } from '@/api/orders';
import { FormMessage } from '@/components/form-message';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * The live order review popup (#product_review_modal on /my/orders) — layout, copy and colors
 * from the live markup, behavior from its script: if the customer already reviewed the product,
 * it opens pre-filled with their rating and comment ("Update Your Experience" / "Update") so they
 * can keep or change them; otherwise it starts empty ("Rate Your Experience" / "Submit").
 * Opened by "Edit Review" on the My Orders list.
 *
 * REAL (wired 2026-09-28): opening loads /my/orders/review/info; "Submit"/"Update" saves through
 * /my/orders/review/submit (see src/api/orders.ts). As on the live site: no star → "Please select
 * a star rating." and nothing is sent; while saving the button reads "Submitting..."; success
 * closes the popup (the backend sends no success message — the live page just reloads); a failure
 * shows the backend's own message.
 *
 * Added 2026-10-02 ("photo upload on product reviews" — real gap closed, the backend had no
 * image field at all). The photo row below is NOT from the live site's markup — there was no
 * reference to confirm it against, so it follows this screen's own existing visual language
 * (same rounded chips/buttons as the rest of the app) rather than copying anything. Flag this to
 * Mariam/Basem before treating the look as final. Up to 3 photos, picked from the library (no
 * camera capture — keeping this to one picker call, same as the rest of the app's image use).
 */

// Copy moved into src/i18n/locales/en.json under "reviewModal" (RTL/i18n work, 2026-10-01).
// `orderDate` and `star` use i18next interpolation / count-based pluralization instead of
// template-literal functions.

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
  const { t } = useTranslation();
  const [info, setInfo] = useState<ReviewInfo | 'loading' | { error: string }>('loading');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchReviewInfo(orderId).then((result) => {
      if (!active) {
        return;
      }
      if (!result.ok) {
        setInfo({ error: result.message }); // The backend's message, e.g. "Unauthorized".
        return;
      }
      setInfo(result.info);
      // An existing review is shown as-is, for the customer to keep or change.
      setRating(result.info.existingRating);
      setComment(result.info.existingComment);
      setImages(result.info.existingImages);
    });
    return () => {
      active = false;
    };
  }, [orderId]);

  const loaded = info !== 'loading' && !('error' in info) ? info : null;
  const isUpdate = loaded !== null && loaded.isUpdate;

  async function handleSubmit() {
    if (!loaded || submitting) {
      return;
    }
    if (rating === 0) {
      setSubmitError(t('reviewModal.selectRating'));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitReview({
      orderId,
      productId: loaded.productId,
      rating,
      comment,
      images,
    });
    setSubmitting(false);
    if (result.ok) {
      onClose();
    } else {
      setSubmitError(result.message);
    }
  }

  async function handleAddPhoto() {
    if (images.length >= 3) {
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSubmitError(t('reviewModal.photoPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) {
      return;
    }
    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    setImages((current) => [...current, `data:${mime};base64,${asset.base64}`].slice(0, 3));
  }

  function handleRemovePhoto(index: number) {
    setImages((current) => current.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.card} accessibilityViewIsModal>
      <View style={styles.header}>
        <Text style={styles.title}>{isUpdate ? t('reviewModal.updateTitle') : t('reviewModal.title')}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('reviewModal.close')}>
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
        ) : 'error' in info ? (
          <View style={styles.productSummary}>
            <Text style={styles.orderDate}>{info.error}</Text>
          </View>
        ) : (
          <View style={styles.productSummary}>
            <View style={styles.productImage}>
              <Image
                source={{ uri: info.productImageUrl }}
                style={styles.productImageFill}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
            </View>
            <View style={styles.productText}>
              <Text style={styles.productName}>{info.productName}</Text>
              <Text style={styles.orderDate}>
                {t('reviewModal.orderDate', { date: info.orderDateFormatted })}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.ratingBlock}>
          <Text style={styles.tapToRate}>{t('reviewModal.tapToRate')}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = value <= rating;
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    setRating(value);
                    setSubmitError(null);
                  }}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={t('reviewModal.star', { count: value })}
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

        <Text style={styles.feedbackLabel}>{t('reviewModal.feedback')}</Text>
        <TextInput
          style={styles.feedbackInput}
          value={comment}
          onChangeText={setComment}
          placeholder={t('reviewModal.feedbackPlaceholder')}
          placeholderTextColor={Colors.placeholderIcon}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.feedbackLabel}>{t('reviewModal.photosLabel')}</Text>
        <View style={styles.photoRow}>
          {images.map((uri, index) => (
            <View key={`${index}-${uri.slice(-12)}`} style={styles.photoThumb}>
              <Image source={{ uri }} style={styles.photoThumbFill} contentFit="cover" />
              <Pressable
                onPress={() => handleRemovePhoto(index)}
                style={styles.photoRemove}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('reviewModal.removePhoto')}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={10}
                  tintColor={Colors.white}
                />
              </Pressable>
            </View>
          ))}
          {images.length < 3 && (
            <Pressable
              onPress={handleAddPhoto}
              style={styles.photoAdd}
              accessibilityRole="button"
              accessibilityLabel={t('reviewModal.addPhoto')}>
              <SymbolView
                name={{ ios: 'camera', android: 'add-a-photo', web: 'add-a-photo' }}
                size={20}
                tintColor={Colors.mutedText}
              />
            </Pressable>
          )}
        </View>

        {submitError && <FormMessage type="error" message={submitError} />}

        <View style={styles.buttons}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, styles.cancelText]}>{t('reviewModal.cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={!loaded || submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !loaded || submitting, busy: submitting }}
            style={({ pressed }) => [
              styles.button,
              styles.updateButton,
              (pressed || !loaded || submitting) && styles.pressed,
            ]}>
            <Text style={[styles.buttonText, styles.updateText]}>
              {submitting
                ? t('reviewModal.submitting')
                : isUpdate
                  ? t('reviewModal.update')
                  : t('reviewModal.submit')}
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
    fontFamily: Fonts.primaryBold,
    fontSize: 24,
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
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
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
    fontFamily: Fonts.secondaryBold,
    fontSize: 13,
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
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  photoThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.phoneCountryBackground,
  },
  photoThumbFill: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.phoneGroupBorder,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.phoneGroupBorder,
  },
  cancelText: {
    color: Colors.cancelText,
  },
  updateButton: {
    backgroundColor: Colors.primaryOrange,
  },
  updateText: {
    color: Colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
