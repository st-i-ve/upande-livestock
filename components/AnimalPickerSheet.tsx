import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";
import { animals as ALL } from "@/data/mock";
import { avatarToneFor, initials, pillFor } from "@/services/utils";
import type { Animal } from "@/types";

import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Pill } from "./Pill";

export type PickerMode = "single" | "multi";

type GroupRow =
  | { type: "header"; herd: string; count: number; selectedCount: number }
  | { type: "animal"; animal: Animal };

export function AnimalPickerSheet({
  visible,
  onClose,
  mode,
  title,
  include,
  onPickSingle,
  onPickMulti,
  emptyAction,
  initialSelectedIds,
}: {
  visible: boolean;
  onClose: () => void;
  mode: PickerMode;
  title: string;
  include?: (a: Animal) => boolean;
  onPickSingle?: (a: Animal) => void;
  onPickMulti?: (a: Animal[]) => void;
  emptyAction?: { label: string; onPress: () => void };
  /** Seed the picker with prior choices so reopens preserve selection. */
  initialSelectedIds?: string[];
}) {
  const [view, setView] = useState<"all" | "herd">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const list = useMemo(() => {
    let l = include ? ALL.filter(include) : ALL;
    if (query) {
      const q = query.toLowerCase();
      l = l.filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
    }
    return l;
  }, [include, query]);

  // Group rows for the herd view: header → child animal rows.
  const herdRows = useMemo<GroupRow[]>(() => {
    const groups: Record<string, Animal[]> = {};
    list.forEach((a) => {
      (groups[a.herd] = groups[a.herd] || []).push(a);
    });
    const rows: GroupRow[] = [];
    Object.entries(groups).forEach(([herd, arr]) => {
      const selectedCount = arr.filter((a) => selected.has(a.id)).length;
      rows.push({ type: "header", herd, count: arr.length, selectedCount });
      arr.forEach((animal) => rows.push({ type: "animal", animal }));
    });
    return rows;
  }, [list, selected]);

  const toggle = (id: string) => {
    if (mode === "single") {
      const a = ALL.find((x) => x.id === id);
      if (a && onPickSingle) {
        onPickSingle(a);
        onClose();
      }
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleHerd = (herd: string) => {
    const arr = list.filter((a) => a.herd === herd);
    const allSel = arr.every((a) => selected.has(a.id));
    setSelected((prev) => {
      const next = new Set(prev);
      arr.forEach((a) => (allSel ? next.delete(a.id) : next.add(a.id)));
      return next;
    });
  };

  const toggleAll = () => {
    const allSel = list.length > 0 && list.every((a) => selected.has(a.id));
    setSelected((prev) => {
      const next = new Set(prev);
      list.forEach((a) => (allSel ? next.delete(a.id) : next.add(a.id)));
      return next;
    });
  };

  const confirm = () => {
    if (onPickMulti) {
      onPickMulti(Array.from(selected).map((id) => ALL.find((a) => a.id === id)!).filter(Boolean));
    }
    onClose();
  };

  const reset = () => {
    setQuery("");
    setSelected(new Set(initialSelectedIds ?? []));
    setView("all");
  };

  const renderAnimal = (a: Animal, indent = false) => {
    const p = pillFor(a);
    const isSel = selected.has(a.id);
    return (
      <Pressable
        onPress={() => toggle(a.id)}
        style={({ pressed }) => [s.item, indent && { paddingLeft: 24 }, pressed && { backgroundColor: COLORS.bgMuted }]}
      >
        {mode === "multi" ? (
          <View style={[s.cb, isSel && { backgroundColor: COLORS.text, borderColor: COLORS.text }]}>
            {isSel ? <MaterialCommunityIcons name="check" size={13} color={COLORS.bg} /> : null}
          </View>
        ) : null}
        <Avatar text={initials(a.name)} tone={avatarToneFor(a)} size={30} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.itemName} numberOfLines={1}>{a.name}</Text>
          <Text style={s.itemMeta} numberOfLines={1}>{a.id} · {a.herd}</Text>
        </View>
        {p ? <Pill label={p.label} tone={p.tone} /> : null}
      </Pressable>
    );
  };

  const allSelected = list.length > 0 && list.every((a) => selected.has(a.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={reset}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={20} color={COLORS.text} />
            </Pressable>
          </View>
          <View style={s.tabs}>
            <Pressable style={[s.tab, view === "all" && s.tabActive]} onPress={() => setView("all")}>
              <Text style={[s.tabText, view === "all" && s.tabTextActive]}>Search</Text>
            </Pressable>
            <Pressable style={[s.tab, view === "herd" && s.tabActive]} onPress={() => setView("herd")}>
              <Text style={[s.tabText, view === "herd" && s.tabTextActive]}>By herd</Text>
            </Pressable>
          </View>
          <View style={s.searchRow}>
            <MaterialCommunityIcons name="magnify" size={16} color={COLORS.textSubtle} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tag or name"
              placeholderTextColor={COLORS.textSubtle}
              style={s.searchInput}
            />
          </View>

          {list.length === 0 ? (
            <View style={s.empty}>
              <MaterialCommunityIcons name="magnify-close" size={32} color={COLORS.textSubtle} />
              <Text style={s.emptyText}>No animals match</Text>
              {emptyAction ? (
                <Button label={emptyAction.label} variant="outline" icon="plus" onPress={() => { onClose(); emptyAction.onPress(); }} />
              ) : null}
            </View>
          ) : view === "all" ? (
            <FlatList
              data={list}
              keyExtractor={(a) => a.id}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                mode === "multi" ? (
                  <Pressable onPress={toggleAll} style={s.item}>
                    <View style={[s.cb, allSelected && { backgroundColor: COLORS.text, borderColor: COLORS.text }]}>
                      {allSelected ? <MaterialCommunityIcons name="check" size={13} color={COLORS.bg} /> : null}
                    </View>
                    <Text style={[s.itemName, { fontWeight: "700" }]}>Select all ({list.length})</Text>
                  </Pressable>
                ) : null
              }
              renderItem={({ item }) => renderAnimal(item)}
            />
          ) : (
            <FlatList
              data={herdRows}
              keyExtractor={(r, i) => (r.type === "header" ? `h:${r.herd}` : `a:${r.animal.id}:${i}`)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                if (item.type === "header") {
                  const allSel = item.selectedCount === item.count && item.count > 0;
                  const someSel = item.selectedCount > 0 && !allSel;
                  return (
                    <Pressable onPress={() => toggleHerd(item.herd)} style={s.groupHeader}>
                      {mode === "multi" ? (
                        <View style={[
                          s.cb,
                          (allSel || someSel) && { backgroundColor: COLORS.text, borderColor: COLORS.text },
                        ]}>
                          {allSel ? (
                            <MaterialCommunityIcons name="check" size={13} color={COLORS.bg} />
                          ) : someSel ? (
                            <MaterialCommunityIcons name="minus" size={13} color={COLORS.bg} />
                          ) : null}
                        </View>
                      ) : null}
                      <MaterialCommunityIcons name="fence" size={16} color={COLORS.textMuted} />
                      <Text style={s.groupTitle}>{item.herd}</Text>
                      <Text style={s.groupCount}>{item.count} head</Text>
                    </Pressable>
                  );
                }
                return renderAnimal(item.animal, true);
              }}
            />
          )}

          {mode === "multi" && list.length > 0 ? (
            <View style={s.bar}>
              <Text style={s.barText}>
                <Text style={{ fontWeight: "700" }}>{selected.size}</Text> selected
              </Text>
              <Button label="Confirm" onPress={confirm} style={{ marginTop: 0, paddingHorizontal: 16 }} />
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
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
  title: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  tabs: { flexDirection: "row", backgroundColor: COLORS.bgMuted, borderRadius: RADIUS.md, padding: 3, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.borderSubtle },
  tabText: { fontSize: 11, color: COLORS.textMuted },
  tabTextActive: { color: COLORS.text, fontWeight: "600" },
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
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  cb: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  itemName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  itemMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 10,
    backgroundColor: COLORS.bgMuted,
    paddingHorizontal: 6,
    marginTop: 6,
    borderRadius: RADIUS.sm,
  },
  groupTitle: { flex: 1, fontSize: 12, fontWeight: "700", color: COLORS.text },
  groupCount: { fontSize: 11, color: COLORS.textMuted },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bgMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    marginTop: 10,
  },
  barText: { color: COLORS.text, fontSize: 12 },
});
