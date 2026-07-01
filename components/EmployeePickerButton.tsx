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

import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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
        style={({ pressed }) => [s.btn, pressed && { backgroundColor: c.bgMuted }]}
      >
        <MaterialCommunityIcons name="account-tie" size={16} color={c.textMuted} />
        <Text style={[s.btnLabel, !selected && !value && s.placeholder]} numberOfLines={1}>
          {buttonLabel}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={c.textSubtle} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <View style={s.header}>
              <Text style={s.title}>Select operator</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color={c.text} />
              </Pressable>
            </View>
            <View style={s.searchRow}>
              <MaterialCommunityIcons name="magnify" size={16} color={c.textSubtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name"
                placeholderTextColor={c.textSubtle}
                style={s.searchInput}
              />
            </View>
            {isLoading ? (
              <View style={s.empty}>
                <ActivityIndicator color={c.text} />
                <Text style={s.emptyText}>Loading…</Text>
              </View>
            ) : hits.length === 0 ? (
              <View style={s.empty}>
                <MaterialCommunityIcons name="account-question-outline" size={28} color={c.textSubtle} />
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
                      value === item.name && { backgroundColor: c.bgMuted },
                      pressed && { backgroundColor: c.bgMuted },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>{item.employeeName}</Text>
                      <Text style={s.meta} numberOfLines={1}>{item.name}{item.userId ? ` · ${item.userId}` : ""}</Text>
                    </View>
                    {value === item.name ? (
                      <MaterialCommunityIcons name="check" size={18} color={c.text} />
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

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  btnLabel: { flex: 1, fontSize: 13, color: c.text },
  placeholder: { color: c.textSubtle },

  backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: "85%",
    minHeight: "55%",
  },
  handle: { width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: c.text },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: RADIUS.md,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 13, padding: 0 },
  empty: { paddingVertical: 30, alignItems: "center", gap: 8 },
  emptyText: { color: c.textSubtle, fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSubtle,
  },
  name: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: c.text },
  meta: { fontSize: 11, color: c.textMuted, marginTop: 1 },
});
