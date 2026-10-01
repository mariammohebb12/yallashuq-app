import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  I18nManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sendChatMessage, type ChatTurn } from '@/api/mishmesh-chat';
import {
  fetchSupportMessages,
  fetchSupportStatus,
  sendSupportMessage,
  type SupportSession,
} from '@/api/mishmesh-support';
import { fetchSession } from '@/api/session';
import type { SmartSearchResult } from '@/api/smart-search';
import { MishMeshButton } from '@/components/mishmesh-button';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * MishMesh AI shopping assistant popup. REAL: messages go to /inventory_engine/chat
 * (src/api/mishmesh-chat.ts) with the earlier turns as history; the reply's text and product
 * results are shown in MishMesh's bubble. The app stops waiting after 30 s (the backend has no
 * timeout) and says so; a later reply is dropped. Request 021's remaining items still apply.
 *
 * Copied from the live site's `.o_inventory_chat_wrapper` (yallashuq.com, every page): markup from
 * the page HTML, styles from /odoo_inventory_engine/static/src/css/inventory_chat.css (phone
 * breakpoint ≤576px) plus /mishmesh_helpdesk_support/static/src/css/mishmesh_support.css (which
 * overrides the bubble colors), behavior from /odoo_inventory_engine/static/src/js/inventory_chat.js.
 *
 * Product results: the same rows as Smart Search (the route returns Smart Search's data, not the
 * catalog's product cards): image, name, seller, price ("Upon Request" at 0). Tapping one opens
 * Product detail. No Add to Cart — the rows have no variant id.
 *
 * HUMAN SUPPORT HANDOFF (client request 2026-09-28): a request for a person goes to the assistant
 * like any message — the backend may now create a real ticket + support channel from the chat
 * (mishmesh_helpdesk_support, commit f756149) and reply saying so. After that reply, if the message
 * looked like a handoff request (isHandoffRequest — English phrasing only for now), the popup
 * checks /mishmesh/support/status (src/api/mishmesh-support.ts). With an active session it switches
 * to "human mode": a status strip ("Waiting for an agent" until is_accepted, then "Connected to
 * support"), the session's messages polled from /mishmesh/support/messages, and the input sending
 * via /mishmesh/support/send. Without one it says so (or asks a guest to sign in).
 * NOT VERIFIED: whether f756149 is on production — creating a test ticket there was avoided.
 * Sending is off until an agent accepts: staging's `send` refuses before that ("No active support
 * session found."). Human-mode styling is app-only (the website's wasn't copied).
 */

// Copy confirmed from the live site.
const COPY = {
  /** Live: the user bubble shown after picking a file (`[Attached File: ${file.name}]`). */
  attachedFile: (name: string) => `[Attached File: ${name}]`,
  eyebrow: 'MISHMESH SHOPPING ASSISTANT',
  title: 'Tell me what you want to buy',
  introBold: 'I can help you find products fast.',
  introText: 'Try something like “I want chairs for my dining room”, “show warranty products”.',
  placeholder: 'Ask for any product, style, need',
  loading: '...',
  // Live: what the website's chat script sends as the query for an attachment.
  attachmentQuery: '[File Attachment]',
  // Same as Smart Search (confirmed from the live search card).
  uponRequest: 'Upon Request',
  // From the client's request (2026-09-28).
  waitingForAgent: 'Waiting for an agent',
  connectedToSupport: 'Connected to support',
  // PLACEHOLDER COPY (not confirmed anywhere).
  noSession: "You don't have an open support session yet.",
  timeout: "MishMesh didn't answer in time. Please try again.",
  signInForSupport: 'Please sign in to contact support.',
  sessionEnded: 'This support session has ended.',
  supportAgent: 'Support',
  supportPlaceholder: 'Write a message to support',
  waitingPlaceholder: 'You can write once an agent joins',
};

// The backend only reads the last 5 turns; a few more are sent in case that changes.
const HISTORY_TURNS = 10;

// The website's support script polls the session status every 8 s; messages use the same pace.
const SUPPORT_POLL_MS = 8000;

/*
 * "Connect me to support"-type requests (the phrasings tested against the backend in request 021:
 * "I need to speak to a person", "connect me to support"). English only — Arabic, Hebrew and
 * Russian phrasings still need to be confirmed. "support" alone doesn't count (it's also a product
 * word).
 */
const HANDOFF_PATTERNS = [
  /\b(connect|transfer|put)\b.*\b(support|agent|human|person|someone|representative)\b/i,
  /\b(speak|talk|chat)\b.*\b(to|with)\b.*\b(human|person|agent|someone|support|representative)\b/i,
  /\b(human|live|real)\s+(support|agent|person)\b/i,
  /\bcustomer\s+(support|service)\b/i,
];

export function isHandoffRequest(text: string): boolean {
  return HANDOFF_PATTERNS.some((pattern) => pattern.test(text));
}

// Colors from the live chat CSS (only used by this widget).
const C = {
  eyebrow: '#9a6b35',
  closeBorder: '#f4d3b0',
  closeIcon: '#7c4a19',
  windowBorder: 'rgba(242, 131, 22, 0.18)',
  avatarBackground: '#fff1e2',
  avatarBorder: '#ffd7b2',
  bubbleBorder: '#f2dfcd',
  engineBubble: '#f0f2f5',
  engineText: '#1c1e21',
  inputBorder: '#edd8c0',
};

type Message = {
  id: string;
  /** engine = MishMesh (or the app's own notices); agent = a human support agent. */
  type: 'user' | 'engine' | 'agent';
  text: string;
  author?: string | null;
  /** MishMesh's product results (engine messages only). */
  results?: SmartSearchResult[];
  /**
   * What goes into the chat history: user and MishMesh turns only — not the app's own notices or
   * support messages. Absent = left out.
   */
  turn?: ChatTurn;
};

/** Launcher + popup. Tapping the launcher toggles the popup, like the live site. */
export function MishMeshAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [processing, setProcessing] = useState(false);
  /** Set = human mode (a live support session). */
  const [support, setSupport] = useState<SupportSession | null>(null);
  const lastSupportMessageId = useRef(0);
  // Only the latest assistant request may add its reply (a timed-out one may still answer later).
  const chatRequestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function addMessages(...added: Message[]) {
    setMessages((m) => [...m, ...added]);
  }

  function notice(text: string): Message {
    return { id: `notice_${Date.now()}_${Math.random()}`, type: 'engine', text };
  }

  const endSupport = useCallback(() => {
    setSupport(null);
    lastSupportMessageId.current = 0;
    setMessages((m) => [...m, notice(COPY.sessionEnded)]);
  }, []);

  /** Refreshes the session (accepted? ended?) and appends new messages. */
  const pollSupport = useCallback(
    async (channelId: number) => {
      const status = await fetchSupportStatus();
      if (status.ok && (!status.session || status.session.channelId !== channelId)) {
        endSupport();
        return;
      }
      if (status.ok && status.session) {
        setSupport(status.session);
      }
      const result = await fetchSupportMessages(channelId, lastSupportMessageId.current);
      if (!result.ok) return; // Transient; the next poll retries.
      const fresh = result.messages.filter((msg) => msg.id > lastSupportMessageId.current);
      if (fresh.length > 0) {
        lastSupportMessageId.current = Math.max(...fresh.map((msg) => msg.id));
        setMessages((m) => [
          ...m,
          ...fresh.map(
            (msg): Message => ({
              id: `support_${msg.id}`,
              type: msg.isCustomer ? 'user' : 'agent',
              text: msg.text,
              author: msg.author,
            }),
          ),
        ]);
      }
    },
    [endSupport],
  );

  // While in human mode and the popup is open: fetch right away, then every SUPPORT_POLL_MS.
  const channelId = support?.channelId;
  useEffect(() => {
    if (!open || channelId === undefined) return;
    // Async: its state updates all happen after the network calls, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    pollSupport(channelId);
    const interval = setInterval(() => pollSupport(channelId), SUPPORT_POLL_MS);
    return () => clearInterval(interval);
  }, [open, channelId, pollSupport]);

  // Live: the paperclip opens an image picker (accept="image/*", one file). The site does NOT send
  // the image to the server — it posts only the text "[File Attachment]" to /inventory_engine/chat
  // and keeps the file in the browser (used only to fill the seller "add product" form). So here the
  // picked image stays on the device too; only the chat bubble uses its file name.
  async function attach() {
    if (processing) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const label = COPY.attachedFile(asset.fileName ?? asset.uri.split('/').pop() ?? '');
      // Like the live site: the bubble/history show the file name, the query is a fixed text.
      sendToAssistant(label, COPY.attachmentQuery);
    }
  }

  function send(query: string) {
    if (processing) return;
    const text = query.trim();
    if (!text) return;
    if (support) {
      sendToSupport(support, text);
    } else {
      sendToAssistant(text);
    }
  }

  // The customer's own message comes back from /mishmesh/support/messages, so it isn't added here.
  async function sendToSupport(session: SupportSession, text: string) {
    if (!session.isAccepted) return;
    setProcessing(true);
    const result = await sendSupportMessage(session.channelId, text);
    if (result.ok) {
      await pollSupport(session.channelId);
    } else {
      addMessages({ id: `user_${Date.now()}`, type: 'user', text }, notice(result.message));
    }
    setProcessing(false);
  }

  /** After a handoff request: switch to human mode if the backend opened a session. */
  async function checkHandoff() {
    const status = await fetchSupportStatus();
    if (!mounted.current) return;
    if (!status.ok) {
      addMessages(notice(status.message));
    } else if (status.session) {
      lastSupportMessageId.current = 0;
      setSupport(status.session); // Human mode; the polling effect loads the messages.
    } else {
      const who = await fetchSession();
      if (!mounted.current) return;
      addMessages(notice(who.ok && !who.session ? COPY.signInForSupport : COPY.noSession));
    }
  }

  /** `text` = the bubble and history entry; `query` = what's sent, when different (attachments). */
  async function sendToAssistant(text: string, query: string = text) {
    const now = Date.now();
    const request = ++chatRequestId.current;
    // Earlier turns only; the backend adds this message itself.
    const history = messages
      .map((m) => m.turn)
      .filter((turn): turn is ChatTurn => turn !== undefined)
      .slice(-HISTORY_TURNS);
    setProcessing(true);
    addMessages(
      { id: `user_${now}`, type: 'user', text, turn: { role: 'user', content: text } },
      { id: `loading_${now}`, type: 'engine', text: COPY.loading },
    );
    const result = await sendChatMessage(query, history);
    if (!mounted.current || request !== chatRequestId.current) return;
    let reply: Message;
    if (result.ok) {
      reply = {
        id: `engine_${now}`,
        type: 'engine',
        text: result.text,
        results: result.results,
        turn: result.text ? { role: 'assistant', content: result.text } : undefined,
      };
    } else {
      reply = notice(result.timedOut ? COPY.timeout : result.message);
    }
    setMessages((m) => [...m.filter((msg) => msg.id !== `loading_${now}`), reply]);
    if (result.ok && isHandoffRequest(text)) {
      await checkHandoff();
      if (!mounted.current) return;
    }
    setProcessing(false);
  }

  return (
    <>
      {/* The window is drawn after (above) the launcher: it sits flush on the tab bar, over the
          launcher's corner, and its own close button closes it. */}
      <MishMeshButton onPress={() => setOpen((o) => !o)} />
      {open && (
        <ChatWindow
          messages={messages}
          support={support}
          onSend={send}
          onAttach={attach}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ChatWindow({
  messages,
  support,
  onSend,
  onAttach,
  onClose,
}: {
  messages: Message[];
  support: SupportSession | null;
  onSend: (text: string) => void;
  onAttach: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardVisible = useKeyboardVisible();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const canWrite = !support || support.isAccepted;

  function submit() {
    if (!canWrite) return;
    onSend(input);
    setInput('');
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      pointerEvents="box-none"
      style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
      <View
        style={[
          styles.window,
          // App (client 2026-09-28), unlike the live site's fixed height min(75vh, 600px): the window
          // fits its content and grows with new messages, up to that same size (then the messages
          // scroll). Flush on the tab bar (live: 80px up, above the launcher); with the keyboard up,
          // just above the keyboard.
          { maxHeight: Math.min(windowHeight * 0.75, 600), marginBottom: keyboardVisible ? 12 : 0 },
        ]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{COPY.eyebrow}</Text>
          <Text style={styles.title}>{COPY.title}</Text>
        </View>
        {support && <SupportStatus session={support} />}

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          <EngineMessage>
            <Text style={[styles.engineText, styles.bold]}>{COPY.introBold}</Text>
            <Text style={[styles.engineText, styles.introParagraph]}>{COPY.introText}</Text>
          </EngineMessage>
          {messages.map((m) =>
            m.type === 'engine' ? (
              <EngineMessage key={m.id}>
                {m.text ? <Text style={styles.engineText}>{m.text}</Text> : null}
                {m.results && m.results.length > 0 && (
                  <View style={[styles.results, m.text ? styles.resultsAfterText : null]}>
                    {m.results.map((product) => (
                      <ResultRow key={product.id} product={product} onOpen={onClose} />
                    ))}
                  </View>
                )}
              </EngineMessage>
            ) : m.type === 'agent' ? (
              <EngineMessage key={m.id} agent>
                <Text style={[styles.engineText, styles.bold]}>{m.author || COPY.supportAgent}</Text>
                <Text style={styles.engineText}>{m.text}</Text>
              </EngineMessage>
            ) : (
              <View key={m.id} style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{m.text}</Text>
                </View>
              </View>
            ),
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={[styles.inputWrap, !canWrite && styles.disabled]}>
            {/* Attachments are the assistant's only; the support routes take text. */}
            {!support && (
              <Pressable
                onPress={onAttach}
                hitSlop={8}
                style={({ pressed }) => [styles.attach, pressed && styles.pressed]}
                accessibilityRole="button"
                // Live: title="Attach image or file".
                accessibilityLabel="Attach image or file">
                <SymbolView
                  name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }}
                  size={16}
                  tintColor={Colors.primaryOrange}
                />
              </Pressable>
            )}
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              editable={canWrite}
              placeholder={
                !support
                  ? COPY.placeholder
                  : support.isAccepted
                    ? COPY.supportPlaceholder
                    : COPY.waitingPlaceholder
              }
              autoComplete="off"
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={submit}
            />
          </View>
          <Pressable
            onPress={submit}
            disabled={!canWrite}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.pressed,
              !canWrite && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canWrite }}>
            <SymbolView
              name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
              size={18}
              tintColor={Colors.white}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            size={14}
            tintColor={C.closeIcon}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Human mode's status strip, under the header. */
function SupportStatus({ session }: { session: SupportSession }) {
  const connected = session.isAccepted;
  const label = connected ? COPY.connectedToSupport : COPY.waitingForAgent;
  return (
    <View
      style={[styles.supportStatus, connected ? styles.supportConnected : styles.supportWaiting]}
      accessible
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      accessibilityLabel={session.ticketName ? `${label}. ${session.ticketName}` : label}>
      <View style={[styles.statusDot, connected ? styles.dotConnected : styles.dotWaiting]} />
      <View style={styles.statusText}>
        <Text style={[styles.statusLabel, connected && styles.statusLabelConnected]}>{label}</Text>
        {session.ticketName ? (
          <Text style={styles.statusTicket} numberOfLines={1}>
            {session.ticketName}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** One product result (Smart Search's data): opens Product detail and closes the popup. */
function ResultRow({ product, onOpen }: { product: SmartSearchResult; onOpen: () => void }) {
  function open() {
    onOpen();
    router.push({ pathname: '/product/[id]', params: { id: String(product.id) } });
  }
  const price = product.priceLabel ?? COPY.uponRequest;
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={[product.name, product.seller, price].filter(Boolean).join(', ')}>
      <View style={styles.resultImage}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.resultImageFill}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <SymbolView
            name={{ ios: 'photo', android: 'image', web: 'image' }}
            size={18}
            tintColor={Colors.placeholderIcon}
          />
        )}
      </View>
      <View style={styles.resultText}>
        <Text style={styles.resultName} numberOfLines={2}>
          {product.name}
        </Text>
        {product.seller ? (
          <Text style={styles.resultSeller} numberOfLines={1}>
            {product.seller}
          </Text>
        ) : null}
        <Text style={styles.resultPrice}>{price}</Text>
      </View>
      {/* "forward" flips to point left in Arabic/Hebrew. */}
      <SymbolView
        name={{ ios: 'chevron.forward', android: 'chevron_right', web: 'chevron_right' }}
        size={12}
        tintColor={Colors.placeholderIcon}
      />
    </Pressable>
  );
}

/** A left-side bubble: MishMesh's (its avatar) or, with `agent`, a support agent's. */
function EngineMessage({ children, agent }: { children: React.ReactNode; agent?: boolean }) {
  return (
    <View style={styles.engineRow}>
      <View style={[styles.avatar, agent && styles.agentAvatar]}>
        {agent ? (
          <SymbolView
            name={{ ios: 'person.fill', android: 'person', web: 'person' }}
            size={18}
            tintColor={Colors.primaryOrange}
          />
        ) : (
          <Image
            source={require('@/assets/images/mishmesh.png')}
            style={styles.avatarImage}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        )}
      </View>
      <View style={styles.engineBubble}>{children}</View>
    </View>
  );
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subs = [
      Keyboard.addListener(show, () => setVisible(true)),
      Keyboard.addListener(hide, () => setVisible(false)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return visible;
}

// The live RTL stylesheet flips left/right, so the glow moves to the top-left corner there.
const glowCorner = I18nManager.isRTL ? 'top left' : 'top right';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  window: {
    flexShrink: 1,
    marginHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.windowBorder,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    experimental_backgroundImage: `radial-gradient(circle at ${glowCorner}, rgba(255, 206, 148, 0.48), transparent 34%), linear-gradient(180deg, #fffaf5 0%, #ffffff 22%)`,
    // Live: .shadow-2xl.
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 25 },
    elevation: 16,
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  eyebrow: {
    fontFamily: Fonts.primaryBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: C.eyebrow,
    textAlign: 'left',
  },
  title: {
    fontFamily: Fonts.primaryBold,
    marginTop: 8,
    // Keeps the heading clear of the close button.
    marginEnd: 36,
    fontSize: 22,
    lineHeight: 23,
    color: Colors.dark,
    textAlign: 'left',
  },
  close: {
    position: 'absolute',
    top: 12,
    end: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: C.closeBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  // Content height, shrinking (and scrolling) only when the window reaches its maximum height.
  messages: {
    flexGrow: 0,
    flexShrink: 1,
  },
  messagesContent: {
    // Messages stack from the bottom, right above the input (no empty gap under a short chat);
    // once they overflow, the list scrolls as before.
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  engineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: C.avatarBackground,
    borderWidth: 1,
    borderColor: C.avatarBorder,
    overflow: 'hidden',
  },
  agentAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 15,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  supportWaiting: {
    backgroundColor: Colors.photoPreviewBackground,
    borderColor: Colors.photoPreviewBorder,
  },
  supportConnected: {
    backgroundColor: Colors.successBackground,
    borderColor: Colors.successBorder,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotWaiting: {
    backgroundColor: Colors.primaryOrange,
  },
  dotConnected: {
    backgroundColor: Colors.badgeSuccess,
  },
  statusText: {
    flex: 1,
  },
  statusLabel: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    color: C.closeIcon,
    textAlign: 'left',
  },
  statusLabelConnected: {
    color: Colors.successText,
  },
  statusTicket: {
    fontFamily: Fonts.primary,
    fontSize: 11,
    color: Colors.mutedText,
    textAlign: 'left',
  },
  disabled: {
    opacity: 0.5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  engineBubble: {
    flex: 1,
    backgroundColor: C.engineBubble,
    borderWidth: 1,
    borderColor: C.bubbleBorder,
    borderRadius: 18,
    borderBottomStartRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: 'rgb(15, 23, 42)',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
  },
  engineText: {
    fontFamily: Fonts.primary,
    fontSize: 13,
    lineHeight: 19.5,
    color: C.engineText,
    textAlign: 'left',
  },
  bold: {
    fontFamily: Fonts.primaryBold,
  },
  // Product results inside MishMesh's bubble (app-only layout; the data is Smart Search's).
  results: {
    gap: 6,
  },
  resultsAfterText: {
    marginTop: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.bubbleBorder,
    backgroundColor: Colors.white,
  },
  resultImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: C.engineBubble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultImageFill: {
    width: '100%',
    height: '100%',
  },
  resultText: {
    flex: 1,
    gap: 1,
  },
  resultName: {
    fontFamily: Fonts.primaryBold,
    fontSize: 13,
    lineHeight: 17,
    color: Colors.sectionHeading,
  },
  resultSeller: {
    fontFamily: Fonts.primary,
    fontSize: 11,
    color: Colors.helperText,
  },
  resultPrice: {
    fontFamily: Fonts.primaryBold,
    fontSize: 12,
    color: Colors.primaryOrange,
  },
  introParagraph: {
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '85%',
    borderRadius: 18,
    borderBottomEndRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: '#f3861c',
    experimental_backgroundImage: 'linear-gradient(135deg, #f28316 0%, #de7314 100%)',
    shadowColor: 'rgb(242, 131, 22)',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  userText: {
    fontFamily: Fonts.primary,
    fontSize: 14,
    color: Colors.white,
    textAlign: 'left',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 15,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  attach: {
    width: 16,
    height: 16,
    marginEnd: 8,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.primary,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 13,
    color: Colors.dark,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryOrange,
    experimental_backgroundImage: 'linear-gradient(135deg, #f28316 0%, #cf6710 100%)',
  },
  pressed: {
    opacity: 0.85,
  },
});
