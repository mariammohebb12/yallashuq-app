import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  fetchInvoice,
  fetchInvoiceMessages,
  type InvoiceMessage,
  type InvoiceSummary,
} from '@/api/invoices';
import { FormMessage } from '@/components/form-message';
import { InvoiceStatusBadge } from '@/components/invoice-status-badge';
import { SampleDataBanner } from '@/components/order-parts';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * Screen: one invoice — the live /my/invoices/<id> page, READ-ONLY.
 *
 * Shows: invoice number, amount (the live header shows the invoice total), status, "Download"
 * (opens the real PDF in the app — src/app/my/invoices/[id]/pdf.tsx) and "Communication history"
 * (REAL messages from /mail/thread/messages).
 * ⚠️ NO PAYMENT ⚠️ The live page's "Pay" card (card via Lahza) is deliberately left out — staging
 * offers it on invoices of orders that are already paid (docs/backend-requests/014-invoice-double-charge.md).
 * Also not shown: the invoice document preview (live: an embedded HTML copy — "Download" covers
 * it), the previous/next arrows, and the seller contact card on credit notes.
 * The header (number, amount, status) is sample data until #015 ships; the banner says so.
 */

const COPY = {
  // Confirmed from the live /my/invoices/<id> page.
  download: 'Download',
  communication: 'Communication history',
  // PLACEHOLDER COPY (not confirmed anywhere).
  sampleData: 'Sample data — invoice details are not your real invoice',
  notFound: 'This invoice could not be found.',
  noMessages: 'No messages yet.',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; invoice: InvoiceSummary | null; isSampleData: boolean };

type MessagesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; messages: InvoiceMessage[] };

/** "2026-09-16 08:47:58" (UTC) → "09/16/2026 08:47" in the phone's time zone. */
function formatMessageDate(value: string): string {
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [messages, setMessages] = useState<MessagesState>({ status: 'loading' });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const [invoiceResult, messagesResult] = await Promise.all([
      fetchInvoice(Number(id)),
      fetchInvoiceMessages(Number(id)),
    ]);
    if (request !== requestId.current) {
      return;
    }
    setState(
      invoiceResult.ok
        ? {
            status: 'ready',
            invoice: invoiceResult.invoice,
            isSampleData: invoiceResult.isSampleData,
          }
        : { status: 'error', message: invoiceResult.message }
    );
    setMessages(
      messagesResult.ok
        ? { status: 'ready', messages: messagesResult.messages }
        : { status: 'error', message: messagesResult.message }
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

  const invoice = state.status === 'ready' ? state.invoice : null;

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: invoice ? invoice.name : '' }} />
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
        <ScrollView contentContainerStyle={styles.content}>
          {state.status === 'error' ? (
            <FormMessage type="error" message={state.message} />
          ) : invoice === null ? (
            <FormMessage type="error" message={COPY.notFound} />
          ) : (
            <View style={styles.sections}>
              {/* ---- Header: number, amount, status, Download ---- */}
              <View style={styles.card}>
                <View style={styles.headerRow}>
                  <Text style={styles.invoiceName}>{invoice.name}</Text>
                  <InvoiceStatusBadge status={invoice.status} />
                </View>
                <Text style={styles.amount}>{invoice.amountTotalFormatted}</Text>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/my/invoices/[id]/pdf',
                      params: { id: String(invoice.id), title: invoice.name },
                    })
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}>
                  <SymbolView
                    name={{ ios: 'arrow.down.doc', android: 'download', web: 'download' }}
                    size={16}
                    tintColor={Colors.white}
                  />
                  <Text style={styles.downloadText}>{COPY.download}</Text>
                </Pressable>
              </View>

              {/* ---- Communication history (real) ---- */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{COPY.communication}</Text>
                {messages.status === 'loading' ? (
                  <ActivityIndicator color={Colors.primaryOrange} />
                ) : messages.status === 'error' ? (
                  <FormMessage type="error" message={messages.message} />
                ) : messages.messages.length === 0 ? (
                  <Text style={styles.muted}>{COPY.noMessages}</Text>
                ) : (
                  messages.messages.map((message) => (
                    <View key={message.id} style={styles.message}>
                      <View style={styles.messageMeta}>
                        <Text style={styles.author}>{message.authorName}</Text>
                        <Text style={styles.muted}>{formatMessageDate(message.date)}</Text>
                      </View>
                      <Text style={styles.body}>{message.text}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// Same page, banner and card styles as Order Detail.
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
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  invoiceName: {
    flexShrink: 1,
    fontFamily: Fonts.primaryBold,
    fontSize: 20,
    color: Colors.sectionHeading,
  },
  amount: {
    fontFamily: Fonts.primaryBold,
    fontSize: 28,
    color: Colors.primaryOrange,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: Colors.primaryOrange,
  },
  downloadText: {
    fontFamily: Fonts.primaryBold,
    fontSize: 15,
    color: Colors.white,
  },
  sectionTitle: {
    fontFamily: Fonts.primaryBold,
    fontSize: 16,
    color: Colors.sectionHeading,
  },
  message: {
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.inputBorder,
  },
  messageMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  author: {
    fontFamily: Fonts.primaryBold,
    fontSize: 14,
    color: Colors.dark,
  },
  body: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.dark,
  },
  muted: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    color: Colors.helperText,
  },
  pressed: {
    opacity: 0.85,
  },
});
