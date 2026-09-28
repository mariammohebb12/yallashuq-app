import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/theme/fonts';
import { Colors } from '@/theme/theme';

export type PickerItem = {
  key: string;
  label: string;
  /** Muted text at the end of the row, e.g. "+971". */
  detail?: string;
  imageUrl?: string;
};

type Props = {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedKey?: string;
  /** Adds a search box that filters by label and detail. */
  searchPlaceholder?: string;
  onSelect: (key: string) => void;
  onClose: () => void;
};

/** Full-height sheet with a (optionally searchable) list; used for country and state pickers. */
export function PickerModal({
  visible,
  title,
  items,
  selectedKey,
  searchPlaceholder,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.detail?.toLowerCase().includes(q)
    );
  }, [items, query]);

  function close() {
    setQuery('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}>
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={18}
              tintColor={Colors.dark}
            />
          </Pressable>
        </View>

        {searchPlaceholder !== undefined && (
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.placeholderIcon}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const selected = item.key === selectedKey;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                  selected && styles.rowSelected,
                ]}
                onPress={() => {
                  onSelect(item.key);
                  close();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}>
                {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.flag} />}
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                  {item.label}
                </Text>
                {item.detail && <Text style={styles.rowDetail}>{item.detail}</Text>}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontFamily: Fonts.primaryBold,
    fontSize: 18,
    color: Colors.dark,
  },
  // Search box and rows follow the live site's country dropdown styles.
  searchBox: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.phoneCountryBackground,
  },
  searchInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: Colors.phoneGroupBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: Colors.phoneCountryBackground,
  },
  rowSelected: {
    backgroundColor: Colors.activeRowBackground,
  },
  flag: {
    width: 35,
    height: 17.5,
    borderRadius: 2,
  },
  rowLabel: {
    flex: 1,
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.dark,
  },
  rowLabelSelected: {
    color: Colors.primaryOrange,
    fontFamily: Fonts.primaryBold,
  },
  rowDetail: {
    fontFamily: Fonts.primary,
    fontSize: 15,
    color: Colors.mutedText,
  },
});
