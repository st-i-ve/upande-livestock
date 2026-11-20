import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { RADIUS, font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useSires } from "@/src/hooks/useSires";
import { filterSires, sireLabel, type Sire, type SireType } from "@/src/frappe/sireList";

import { Input } from "./Field";
import { Pill } from "./Pill";

const TYPES: Array<SireType | "All"> = ["All", "Semen", "Live bull"];

/**
 * Which bull, chosen from the farm's Livestock Sires (not typed), shown as
 * "Name · CODE", with a Semen / Live bull filter and a badge on sexed semen.
 *
 * The list is cached on the phone, so it works offline. When there is no list
 * at all (empty farm list, or offline and never loaded) the field falls back to
 * a text box, "Sire not listed", kept as the record's legacy text.
 */
export function SirePickerButton({
  linked,
  typed,
  onPick,
  onType,
}: {
  /** Livestock Sire name, or "". */
  linked: string;
  /** The free-text fallback. */
  typed: string;
  onPick: (sire: Sire | null) => void;
  onType: (text: string) => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { data: sires = [], isLoading } = useSires();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SireType | "All">("All");
  const [freeText, setFreeText] = useState(false);

  const chosen = sires.find((x) => x.name === linked);
  const list = useMemo(() => filterSires(sires, query, type), [sires, query, type]);

  if (!isLoading && (sires.length === 0 || freeText)) {
    return (
      <View style={{ gap: 6 }}>
        <Input value={typed} onChangeText={onType} placeholder="Sire not listed: bull name or number" />
        {sires.length > 0 ? (
          <Pressable onPress={() => { setFreeText(false); onType(""); }} hitSlop={8}>
            <Text style={s.link}>Pick from the sire list instead</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[s.btn, chosen && s.btnChosen]} accessibilityLabel="Pick the sire">
        <MaterialCommunityIcons name="dna" size={18} color={chosen ? c.selected : c.textMuted} />
        <Text style={[s.text, chosen && { color: c.text, ...font("600") }]} numberOfLines={1}>
          {chosen ? sireLabel(chosen) : isLoading ? "Loading sires…" : "Search sire by name or code"}
        </Text>
        {chosen?.sexed ? <Pill label="Sexed" /> : null}
        {chosen ? (
          <Pressable onPress={() => onPick(null)} hitSlop={8} accessibilityLabel="Clear the sire">
            <MaterialCommunityIcons name="close-circle" size={18} color={c.textSubtle} />
          </Pressable>
        ) : (
          <MaterialCommunityIcons name="chevron-down" size={18} color={c.textMuted} />
        )}
      </Pressable>
      <Modal visible={open} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setOpen(false)} onShow={() => { setQuery(""); setType("All"); }}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <View style={s.header}>
              <Text style={s.title}>Select sire</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color={c.text} />
              </Pressable>
            </View>
            <View style={s.tabs}>
              {TYPES.map((t) => (
                <Pressable key={t} style={[s.tab, type === t && s.tabActive]} onPress={() => setType(t)}>
                  <Text style={[s.tabText, type === t && s.tabTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.searchRow}>
              <MaterialCommunityIcons name="magnify" size={16} color={c.textSubtle} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Name or code" placeholderTextColor={c.textSubtle} style={s.searchInput} />
            </View>
            {isLoading && list.length === 0 ? (
              <View style={s.empty}><ActivityIndicator color={c.text} /></View>
            ) : list.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>No sire matches</Text>
              </View>
            ) : (
              <FlatList
                data={list}
                keyExtractor={(x) => x.name}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => { onPick(item); setOpen(false); }}
                    style={({ pressed }) => [s.item, pressed && { backgroundColor: c.bgMuted }, item.name === linked && s.itemSel]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.itemName} numberOfLines={1}>{sireLabel(item)}</Text>
                      <Text style={s.itemMeta} numberOfLines={1}>{item.type}</Text>
                    </View>
                    {item.sexed ? <Pill label="Sexed" /> : null}
                  </Pressable>
                )}
              />
            )}
            <Pressable onPress={() => { setOpen(false); setFreeText(true); onPick(null); }} hitSlop={8} style={{ paddingTop: 10 }}>
              <Text style={s.link}>Sire not listed</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    btn: {
      flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, paddingVertical: 11,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: RADIUS.md, backgroundColor: c.bg,
    },
    btnChosen: { borderWidth: 1.5, borderColor: c.selected, backgroundColor: c.selectedBg },
    text: { flex: 1, fontSize: 13, color: c.textMuted },
    link: { fontSize: 12, color: c.textMuted, textDecorationLine: "underline" },
    backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 14,
      paddingTop: 8, paddingBottom: 36, maxHeight: "85%", minHeight: "55%",
    },
    handle: { width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    title: { fontSize: 14, ...font("600"), color: c.text },
    tabs: { flexDirection: "row", backgroundColor: c.bgMuted, borderRadius: RADIUS.md, padding: 3, marginBottom: 10 },
    tab: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: "center" },
    tabActive: { backgroundColor: c.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderSubtle },
    tabText: { fontSize: 11, color: c.textMuted },
    tabTextActive: { color: c.text, ...font("600") },
    searchRow: {
      flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: RADIUS.md, marginBottom: 8,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13, padding: 0 },
    empty: { paddingVertical: 30, alignItems: "center", gap: 8 },
    emptyText: { color: c.textSubtle, fontSize: 12 },
    item: {
      flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    itemSel: {
      backgroundColor: c.selectedBg, borderWidth: 1.5, borderColor: c.selected, borderRadius: RADIUS.md,
      paddingHorizontal: 6, marginVertical: 2,
    },
    itemName: { fontSize: 13, ...font("600"), color: c.text },
    itemMeta: { fontSize: 11, color: c.textMuted, marginTop: 1 },
  });
