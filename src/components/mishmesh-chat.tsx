import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
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

import { MishMeshButton } from '@/components/mishmesh-button';
import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

/*
 * MishMesh AI shopping assistant popup — VISUAL SHELL ONLY, no backend wiring yet.
 *
 * Copied from the live site's `.o_inventory_chat_wrapper` (yallashuq.com, every page): markup from
 * the page HTML, styles from /odoo_inventory_engine/static/src/css/inventory_chat.css (phone
 * breakpoint ≤576px) plus /mishmesh_helpdesk_support/static/src/css/mishmesh_support.css (which
 * overrides the bubble colors), behavior from /odoo_inventory_engine/static/src/js/inventory_chat.js.
 *
 * Not built on purpose: product result cards (never seen for real) and the "human-mode" support
 * handover styling.
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
  // TEMPORARY: the live site's real no-match reply, shown for every message until the assistant is
  // wired to the backend (separate step).
  fallbackReply:
    'I could not find matching products in our local inventory or active affiliate partner listings right now. Please try a different product name or check again later.',
};

// TEMPORARY: fake "thinking" time before the fallback reply. Not a live-site value.
const FAKE_REPLY_DELAY_MS = 1200;

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

type Message = { id: string; type: 'user' | 'engine'; text: string };

/** Launcher + popup. Tapping the launcher toggles the popup, like the live site. */
export function MishMeshAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [processing, setProcessing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Live: the paperclip opens an image picker (accept="image/*", one file). The site does NOT send
  // the image to the server — it posts only the text "[File Attachment]" to /inventory_engine/chat
  // and keeps the file in the browser (used only to fill the seller "add product" form). So here the
  // picked image stays on the device too; only the chat bubble uses its file name.
  async function attach() {
    if (processing) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      send(COPY.attachedFile(asset.fileName ?? asset.uri.split('/').pop() ?? ''));
    }
  }

  function send(query: string) {
    if (processing) return;
    const text = query.trim();
    if (!text) return;
    const now = Date.now();
    setProcessing(true);
    setMessages((m) => [
      ...m,
      { id: `user_${now}`, type: 'user', text },
      { id: `loading_${now}`, type: 'engine', text: COPY.loading },
    ]);
    timer.current = setTimeout(() => {
      setMessages((m) => [
        ...m.filter((msg) => msg.id !== `loading_${now}`),
        { id: `engine_${now}`, type: 'engine', text: COPY.fallbackReply },
      ]);
      setProcessing(false);
    }, FAKE_REPLY_DELAY_MS);
  }

  return (
    <>
      {open && <ChatWindow messages={messages} onSend={send} onAttach={attach} onClose={() => setOpen(false)} />}
      <MishMeshButton onPress={() => setOpen((o) => !o)} />
    </>
  );
}

function ChatWindow({
  messages,
  onSend,
  onAttach,
  onClose,
}: {
  messages: Message[];
  onSend: (text: string) => void;
  onAttach: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardVisible = useKeyboardVisible();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  function submit() {
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
          // Live: height min(75vh, 600px), bottom 80px (just above the launcher). With the keyboard
          // up the launcher is hidden, so the window sits just above the keyboard instead.
          { height: Math.min(windowHeight * 0.75, 600), marginBottom: keyboardVisible ? 12 : 80 },
        ]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{COPY.eyebrow}</Text>
          <Text style={styles.title}>{COPY.title}</Text>
        </View>

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
          <View style={styles.inputWrap}>
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
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={COPY.placeholder}
              autoComplete="off"
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={submit}
            />
          </View>
          <Pressable
            onPress={submit}
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Send">
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

function EngineMessage({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.engineRow}>
      <View style={styles.avatar}>
        <Image
          source={require('@/assets/images/mishmesh.png')}
          style={styles.avatarImage}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
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
  messages: {
    flex: 1,
  },
  messagesContent: {
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
