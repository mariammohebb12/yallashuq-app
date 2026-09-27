import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchReturnForm, type ReturnForm, type ReturnFormLine } from '@/api/returns';
import { DisabledButton } from '@/components/coming-soon';
import { FieldLabel, PressableField, TextField } from '@/components/form-fields';
import { FormMessage } from '@/components/form-message';
import { SampleDataBanner } from '@/components/order-parts';
import { PickerModal } from '@/components/picker-modal';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: New return request — the live /my/orders/<id>/return form (opened by "Return /
 * Reschedule Items" on Order Detail, the same entry point as the live site).
 *
 * ⚠️ SUBMIT IS DISABLED — NOTHING IS SENT ⚠️
 * The live form posts multipart HTML to /my/orders/return/submit; there's no JSON route, so
 * "Submit Return Request" is disabled ("Coming soon") until docs/backend-requests/006-returns-json.md
 * ships. The returnable lines come from the (mock) order; see fetchReturnForm.
 *
 * Only this step's confirmed fields, in one column: Order (read-only), Items to Return (checkbox
 * per product + "Qty to Return" stepper when more than 1 unit), Reason for Return (the live
 * options), Image Upload, Submit.
 * NOT included although the live form has them (all required there): Return Type, Refund to,
 * Comments, "Are the original tags attached?", Tag Verification Images, Preferred Pickup Date,
 * Preferred Time Slot. A real submit will need them (see #006).
 */

const COPY = {
  // Confirmed from the live /my/orders/<id>/return form.
  itemsToReturn: 'Items to Return',
  qtyToReturn: 'Qty to Return',
  returnOptions: 'Return Options',
  reason: 'Reason for Return',
  reasonPlaceholder: 'Select reason',
  imageUpload: 'Image Upload (Required)',
  submit: 'Submit Return Request',
  // Confirmed from the live /my/returns/<id> page ("Order:").
  order: 'Order',
  // Confirmed: the live Order Detail button that opens this form.
  title: 'Return / Reschedule Items',
  // PLACEHOLDER COPY (not confirmed anywhere).
  sampleData: 'Sample data — items come from the sample order, not your real order',
  noImage: 'No image selected',
  addPhoto: 'Add photo',
  removePhoto: 'Remove photo',
  notFound: 'This order could not be found.',
  noItems: 'There are no items left to return on this order.',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; form: ReturnForm | null; isSampleData: boolean };

type Photo = { uri: string; fileName: string };

export default function NewReturnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const result = await fetchReturnForm(Number(id));
    if (request !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', form: result.form, isSampleData: result.isSampleData }
        : { status: 'error', message: result.message }
    );
  }, [id]);

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
      {state.status === 'ready' && state.isSampleData && (
        <View style={styles.bannerBar}>
          <SampleDataBanner message={COPY.sampleData} />
        </View>
      )}
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : state.form === null ? (
            <FormMessage type="error" message={COPY.notFound} />
          ) : (
            // Keyed by order so the choices reset when another order's form opens.
            <ReturnFormBody key={state.form.order.id} form={state.form} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ReturnFormBody({ form }: { form: ReturnForm }) {
  // Live: every line starts unchecked, with its quantity at the maximum.
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [quantities, setQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(form.lines.map((line) => [line.lineId, line.maxQuantity]))
  );
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [reasonPickerOpen, setReasonPickerOpen] = useState(false);
  const [photo, setPhoto] = useState<Photo>();

  const reason = form.reasons.find((option) => option.code === reasonCode);

  // Same native picker as the signup screens' profile photo (without the square crop).
  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, fileName: asset.fileName ?? asset.uri.split('/').pop() ?? '' });
    }
  }

  return (
    <View style={styles.sections}>
      <Card>
        <TextField label={COPY.order} value={form.order.name} editable={false} />
      </Card>

      {/* ---- Items to Return ---- */}
      <Card title={COPY.itemsToReturn}>
        {form.lines.length === 0 ? (
          <Text style={styles.muted}>{COPY.noItems}</Text>
        ) : (
          form.lines.map((line) => (
            <LineRow
              key={line.lineId}
              line={line}
              checked={selected[line.lineId] ?? false}
              quantity={quantities[line.lineId] ?? line.maxQuantity}
              onToggle={() =>
                setSelected((current) => ({ ...current, [line.lineId]: !current[line.lineId] }))
              }
              onQuantity={(quantity) =>
                setQuantities((current) => ({ ...current, [line.lineId]: quantity }))
              }
            />
          ))
        )}
      </Card>

      {/* ---- Return Options (only the confirmed fields) ---- */}
      <Card title={COPY.returnOptions}>
        <PressableField
          label={COPY.reason}
          placeholder={COPY.reasonPlaceholder}
          value={reason?.label}
          icon="chevron"
          onPress={() => setReasonPickerOpen(true)}
        />

        <View>
          <FieldLabel>{COPY.imageUpload}</FieldLabel>
          <View style={styles.photoRow}>
            <View style={styles.photoPreview}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
              ) : (
                <SymbolView
                  name={{ ios: 'photo', android: 'image', web: 'image' }}
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
                  accessibilityLabel={COPY.addPhoto}>
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
                  accessibilityLabel={COPY.removePhoto}>
                  <SymbolView
                    name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                    size={16}
                    tintColor={Colors.dark}
                  />
                </Pressable>
              </View>
              <Text style={styles.photoFileName} numberOfLines={1}>
                {photo ? photo.fileName : COPY.noImage}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* ---- Submit: disabled until a return route exists (#006) ---- */}
      <DisabledButton label={COPY.submit} />

      <PickerModal
        visible={reasonPickerOpen}
        title={COPY.reason}
        items={form.reasons.map((option) => ({ key: option.code, label: option.label }))}
        selectedKey={reasonCode ?? undefined}
        onSelect={(code) => {
          setReasonCode(code);
          setReasonPickerOpen(false);
        }}
        onClose={() => setReasonPickerOpen(false)}
      />
    </View>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title !== undefined && <Text style={styles.sectionTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function LineRow({
  line,
  checked,
  quantity,
  onToggle,
  onQuantity,
}: {
  line: ReturnFormLine;
  checked: boolean;
  quantity: number;
  onToggle: () => void;
  onQuantity: (quantity: number) => void;
}) {
  return (
    <View style={styles.line}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.checkRow}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && (
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
              size={14}
              weight="bold"
              tintColor={Colors.white}
            />
          )}
        </View>
        <Text style={styles.productName}>{line.productName}</Text>
      </Pressable>

      {/* Live: a number input (min 1, max = returnable) shown as "2 / 2"; only when > 1 unit. */}
      {line.maxQuantity > 1 && (
        <View style={styles.qtyRow}>
          <Text style={styles.qtyLabel}>{COPY.qtyToReturn}</Text>
          <View style={styles.stepper}>
            <StepperButton
              icon="minus"
              disabled={quantity <= 1}
              onPress={() => onQuantity(quantity - 1)}
            />
            <Text style={styles.stepperText}>
              {quantity} / {line.maxQuantity}
            </Text>
            <StepperButton
              icon="plus"
              disabled={quantity >= line.maxQuantity}
              onPress={() => onQuantity(quantity + 1)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function StepperButton({
  icon,
  disabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={icon === 'minus' ? 'Decrease quantity' : 'Increase quantity'}
      accessibilityState={{ disabled }}
      style={[styles.stepperButton, disabled && styles.disabled]}>
      <SymbolView
        name={
          icon === 'minus'
            ? { ios: 'minus', android: 'remove', web: 'remove' }
            : { ios: 'plus', android: 'add', web: 'add' }
        }
        size={14}
        tintColor={Colors.dark}
      />
    </Pressable>
  );
}

// Cards and the disabled button match Order Detail; the photo row matches the signup screens;
// the stepper matches the Cart's.
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 2,
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
  muted: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.mutedText,
  },
  line: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.iconButtonBorder,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: Colors.primaryOrange,
    backgroundColor: Colors.primaryOrange,
  },
  productName: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.sectionHeading,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingStart: 32,
  },
  qtyLabel: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.helperText,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
  },
  stepperButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    minWidth: 48,
    textAlign: 'center',
    fontFamily: Fonts.primary,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark,
  },
  disabled: {
    opacity: 0.4,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  photoPreview: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.photoPreviewBorder,
    backgroundColor: Colors.photoPreviewBackground,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
});
