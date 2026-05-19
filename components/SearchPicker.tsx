import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";

// Searchable variant of Picker for long stock-item / catalogue lists.
export function SearchPicker({
  value,
  onChange,
  options,
  placeholder = "Tap to choose",
  searchPlaceholder = "Search…",
  title = "Select",
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [query, options]);
  return (
    <>
      <Pressable onPress={() => { setQuery(""); setOpen(true); }} style={s.box}>
        <Text style={[s.value, !value && { color: COLORS.textSubtle }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons name="magnify" size={16} color={COLORS.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <View style={s.header}>
              <Text style={s.title}>{title}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.text} />
              </Pressable>
            </View>
            <View style={s.searchRow}>
              <MaterialCommunityIcons name="magnify" size={16} color={COLORS.textSubtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={COLORS.textSubtle}
                style={s.searchInput}
                autoFocus
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(o) => o}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={s.empty}>No matches</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { onChange(item); setOpen(false); }}
                  style={({ pressed }) => [s.option, pressed && { backgroundColor: COLORS.bgMuted }]}
                >
                  <Text style={[s.optText, item === value && { fontWeight: "700" }]}>{item}</Text>
                  {item === value ? <MaterialCommunityIcons name="check" size={18} color={COLORS.text} /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    gap: 8,
  },
  value: { flex: 1, fontSize: 13, color: COLORS.text },
  backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: "75%",
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 13, padding: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  optText: { flex: 1, fontSize: 13, color: COLORS.text },
  empty: { textAlign: "center", color: COLORS.textSubtle, fontSize: 12, paddingVertical: 24 },
});
