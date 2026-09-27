import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  fetchInvoices,
  type InvoiceFilter,
  type InvoiceSort,
  type InvoiceSummary,
} from '@/api/invoices';
import { PressableField } from '@/components/form-fields';
import { FormMessage } from '@/components/form-message';
import { InvoiceStatusBadge } from '@/components/invoice-status-badge';
import { SampleDataBanner } from '@/components/order-parts';
import { PickerModal } from '@/components/picker-modal';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: Invoices & Bills — the live /my/invoices page (opened from the Account tab). READ-ONLY.
 *
 * ⚠️ NO PAYMENT ⚠️ The live page's "Pay overdue" button (and each invoice's "Pay") is deliberately
 * left out: staging offers payment on invoices of orders that are already paid (double-charge
 * risk, docs/backend-requests/014-invoice-double-charge.md).
 *
 * ⚠️ THE LIST IS TEMPORARY MOCK DATA ⚠️ No JSON route (see src/api/invoices.ts, #015); a visible
 * banner says so. Same controls and columns as the live page, as one card per invoice: Invoice #,
 * Invoice Date, Due Date, Amount Due, Status; Sort By (Date, Due Date, Reference, Status) and
 * Filter By (All, Bills, Invoices, Overdue invoices), which ask fetchInvoices for that order /
 * subset like the live page asks the server. Tapping a card opens its detail.
 */

const COPY = {
  // Confirmed from the live /my/invoices page.
  heading: 'Invoices & Bills',
  sortBy: 'Sort By:',
  filterBy: 'Filter By:',
  invoiceDate: 'Invoice Date',
  dueDate: 'Due Date',
  amountDue: 'Amount Due',
  empty: 'There are currently no invoices and payments for your account.',
  // PLACEHOLDER COPY (not confirmed anywhere).
  sampleData: 'Sample data — the invoices endpoint is not ready yet',
};

// Live labels, in the live order.
const SORTS: { key: InvoiceSort; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'duedate', label: 'Due Date' },
  { key: 'name', label: 'Reference' },
  { key: 'state', label: 'Status' },
];
const FILTERS: { key: InvoiceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'bills', label: 'Bills' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'overdue_invoices', label: 'Overdue invoices' },
];

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; invoices: InvoiceSummary[]; isSampleData: boolean };

export default function InvoicesScreen() {
  const [sort, setSort] = useState<InvoiceSort>('date');
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [picker, setPicker] = useState<'sort' | 'filter' | null>(null);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const result = await fetchInvoices(filter, sort);
    if (id !== requestId.current) {
      return;
    }
    setState(
      result.ok
        ? { status: 'ready', invoices: result.invoices, isSampleData: result.isSampleData }
        : { status: 'error', message: result.message }
    );
  }, [filter, sort]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        requestId.current++;
      };
    }, [load])
  );

  const sortLabel = SORTS.find((option) => option.key === sort)?.label;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label;

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: COPY.heading }} />
      {state.status === 'loading' ? (
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator color={Colors.primaryOrange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {state.status === 'ready' && state.isSampleData && (
            <SampleDataBanner message={COPY.sampleData} />
          )}
          <Text style={styles.heading}>{COPY.heading}</Text>

          <View style={styles.controls}>
            <View style={styles.control}>
              <PressableField
                label={COPY.sortBy}
                value={sortLabel}
                icon="chevron"
                onPress={() => setPicker('sort')}
              />
            </View>
            <View style={styles.control}>
              <PressableField
                label={COPY.filterBy}
                value={filterLabel}
                icon="chevron"
                onPress={() => setPicker('filter')}
              />
            </View>
          </View>

          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : state.invoices.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{COPY.empty}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {state.invoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
      <PickerModal
        visible={picker === 'sort'}
        title={COPY.sortBy}
        items={SORTS.map((option) => ({ key: option.key, label: option.label }))}
        selectedKey={sort}
        onSelect={(key) => {
          setSort(key as InvoiceSort);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'filter'}
        title={COPY.filterBy}
        items={FILTERS.map((option) => ({ key: option.key, label: option.label }))}
        selectedKey={filter}
        onSelect={(key) => {
          setFilter(key as InvoiceFilter);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function InvoiceCard({ invoice }: { invoice: InvoiceSummary }) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/my/invoices/[id]', params: { id: String(invoice.id) } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${invoice.name}, ${invoice.amountDueFormatted}, ${invoice.status.label}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <Text style={styles.invoiceName}>{invoice.name}</Text>
        <InvoiceStatusBadge status={invoice.status} />
      </View>
      <LabelValue label={COPY.invoiceDate} value={invoice.invoiceDateFormatted} />
      <LabelValue label={COPY.dueDate} value={invoice.dueDateFormatted} />
      <View style={styles.amountRow}>
        <Text style={styles.label}>{COPY.amountDue}</Text>
        <Text style={styles.amount}>{invoice.amountDueFormatted}</Text>
      </View>
    </Pressable>
  );
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inlineRow}>
      <Text style={styles.label}>{label}: </Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

// Same page, heading, cards and empty box as My Orders.
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
    paddingBottom: 32,
  },
  heading: {
    fontFamily: Fonts.primary,
    fontSize: 26,
    fontWeight: '800',
    color: Colors.sectionHeading,
    marginBottom: 14,
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  control: {
    flex: 1,
  },
  emptyBox: {
    borderRadius: 16,
    backgroundColor: Colors.white,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.mutedText,
    textAlign: 'center',
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  invoiceName: {
    flexShrink: 1,
    fontFamily: Fonts.primary,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.dark,
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  label: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.helperText,
  },
  value: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.dark,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
  },
  amount: {
    fontFamily: Fonts.primary,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primaryOrange,
  },
  pressed: {
    opacity: 0.85,
  },
});
