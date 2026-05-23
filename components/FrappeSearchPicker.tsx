import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
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
import { listDocuments, type FrappeFilter } from "@/src/frappe/generic";

/**
 * Remote-search picker over any Frappe DocType. Renders as a button that
 * opens a sheet. Use this for Link fields like Item, Warehouse, Account,
 * Animal Disease, Sire Catalog etc.
 *
 * `displayField` is the human-readable label shown in the picker; the
 * `name` of each row is what gets stored. Pass an explicit `searchField`
 * if Frappe's default "like %name%" search doesn't match what you need.
 */
export function FrappeSearchPicker({
  doctype,
  value,
  onChange,
  placeholder = "Select…",
  fields,
  displayField,
  metaField,
  searchField,
  filters,
  emptyText = "No matches",
  icon = "magnify",
}: {
  doctype: string;
  value: string | null;
  onChange: (name: string, row: any) => void;
  placeholder?: string;
  fields?: string[];
  displayField?: string;
  metaField?: string;
  searchField?: string;
  filters?: FrappeFilter[];
  emptyText?: string;
  icon?: keyof typeof import("@expo/vector-icons").MaterialCommunityIcons.glyphMap;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allFields = useMemo(() => {
    const set = new Set<string>(["name"]);
    fields?.forEach((f) => set.add(f));
    if (displayField) set.add(displayField);
    if (metaField) set.add(metaField);
    return Array.from(set);
  }, [fields, displayField, metaField]);

  // Search-time results, debounced via React Query's per-key cache.
  const list = useQuery({
    queryKey: [doctype, "search", query, filters ?? []],
    queryFn: () =>
      listDocuments({
        doctype,
        fields: allFields,
        filters,
        searchQuery: query.trim(),
        searchField: searchField ?? (displayField || "name"),
        limit: 30,
      }),
    staleTime: 30_000,
  });

  // Resolve the currently-selected row for label rendering.
  const resolved = useQuery({
    queryKey: [doctype, "single", value ?? ""],
    queryFn: () =>
      value
        ? listDocuments({
            doctype,
            fields: allFields,
            filters: [["name", "=", value]],
            limit: 1,
          }).then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    enabled: !!value,
    staleTime: 5 * 60_000,
  });

  const labelFor = (row: any) =>
    row?.[displayField ?? "name"] || row?.name || "";

  const metaFor = (row: any) => {
    const parts: string[] = [];
    if (metaField && row?.[metaField] && row[metaField] !== row[displayField ?? "name"]) {
      parts.push(String(row[metaField]));
    }
    if (displayField && row?.name && row.name !== row[displayField]) {
      parts.push(row.name);
    }
    return parts.join(" · ");
  };

  const buttonLabel = useMemo(() => {
    if (resolved.data) {
      const label = labelFor(resolved.data);
      const meta = metaFor(resolved.data);
      return meta ? `${label} · ${meta}` : label;
    }
    if (value) return value;
    return placeholder;
  }, [resolved.data, value, placeholder]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.btn, pressed && { backgroundColor: COLORS.bgMuted }]}
      >
        <MaterialCommunityIcons name={icon} size={16} color={COLORS.textMuted} />
        <Text style={[s.btnLabel, !resolved.data && !value && s.placeholder]} numberOfLines={1}>
          {buttonLabel}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textSubtle} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <View style={s.header}>
              <Text style={s.title}>Select {doctype}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.text} />
              </Pressable>
            </View>
            <View style={s.searchRow}>
              <MaterialCommunityIcons name="magnify" size={16} color={COLORS.textSubtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Type to filter"
                placeholderTextColor={COLORS.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                style={s.searchInput}
              />
            </View>
            {list.isLoading ? (
              <View style={s.empty}>
                <ActivityIndicator color={COLORS.text} />
                <Text style={s.emptyText}>Loading…</Text>
              </View>
            ) : (list.data?.length ?? 0) === 0 ? (
              <View style={s.empty}>
                <MaterialCommunityIcons name="magnify-close" size={28} color={COLORS.textSubtle} />
                <Text style={s.emptyText}>{emptyText}</Text>
              </View>
            ) : (
              <FlatList
                data={list.data ?? []}
                keyExtractor={(row: any) => row.name}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      onChange(item.name, item);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      s.row,
                      value === item.name && { backgroundColor: COLORS.bgMuted },
                      pressed && { backgroundColor: COLORS.bgMuted },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>{labelFor(item)}</Text>
                      {metaFor(item) ? (
                        <Text style={s.meta} numberOfLines={1}>{metaFor(item)}</Text>
                      ) : null}
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
