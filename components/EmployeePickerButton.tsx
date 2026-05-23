import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { COLORS, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useEmployee, useEmployeeSearch } from "@/src/hooks/useEmployees";

export function EmployeePickerButton({
  value,
  onChange,
  placeholder = "Select operator…",
}: {
  value: string | null;
  onChange: (employeeName: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Active search-time state pulls a fresh list per query keystroke (debounced
  // upstream by React Query's staleTime + per-key cache).
  const { data: hits = [], isLoading } = useEmployeeSearch(query);
  // Resolve the currently selected employee's display name so the button
  // shows the human name rather than the cryptic ID.
  const { data: selected } = useEmployee(value || undefined);

  const buttonLabel = useMemo(() => {
    if (selected) return `${selected.employeeName} · ${selected.name}`;
    if (value) return value;
    return placeholder;
  }, [selected, value, placeholder]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.btn, pressed && { backgroundColor: COLORS.bgMuted }]}
      >
        <MaterialCommunityIcons name="account-tie" size={16} color={COLORS.textMuted} />
        <Text style={[s.btnLabel, !selected && !value && s.placeholder]} numberOfLines={1}>
          {buttonLabel}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textSubtle} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <View style={s.header}>
              <Text style={s.title}>Select operator</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.text} />
              </Pressable>
            </View>
            <View style={s.searchRow}>
              <MaterialCommunityIcons name="magnify" size={16} color={COLORS.textSubtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name"
                placeholderTextColor={COLORS.textSubtle}
                style={s.searchInput}
              />
            </View>
            {isLoading ? (
              <View style={s.empty}>
                <ActivityIndicator color={COLORS.text} />
                <Text style={s.emptyText}>Loading…</Text>
              </View>
            ) : hits.length === 0 ? (
              <View style={s.empty}>
                <MaterialCommunityIcons name="account-question-outline" size={28} color={COLORS.textSubtle} />
                <Text style={s.emptyText}>No employees match</Text>
              </View>
            ) : (
              <FlatList
                data={hits}
                keyExtractor={(e) => e.name}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      onChange(item.name);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      s.row,
                      value === item.name && { backgroundColor: COLORS.bgMuted },
                      pressed && { backgroundColor: COLORS.bgMuted },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>{item.employeeName}</Text>
                      <Text style={s.meta} numberOfLines={1}>{item.name}{item.userId ? ` · ${item.userId}` : ""}</Text>
                    </View>
                    {value === item.name ? (
                      <MaterialCommunityIcons name="check" size={18} color={COLORS.text} />
                    ) : null}
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  btnLabel: { flex: 1, fontSize: 13, color: COLORS.text },
  placeholder: { color: COLORS.textSubtle },

  backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: "85%",
    minHeight: "55%",
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: COLORS.text },
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
  empty: { paddingVertical: 30, alignItems: "center", gap: 8 },
  emptyText: { color: COLORS.textSubtle, fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  name: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: COLORS.text },
  meta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
});
