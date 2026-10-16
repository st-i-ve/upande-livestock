import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useHealthOptions } from "@/src/hooks/useHealthOptions";

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

const clock = (ms: number) =>
  ms
    ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "not yet";

/**
 * "Available stock" for one event type: a button that sits next to the stock
 * section and opens a sheet listing every item the event type may use, with its
 * quantity in each store and the unit, and when the list was last read from the
 * server. Shown only where the event type posts stock (the caller decides, from
 * the server's own rule). Reads the same `items_by_event` the pickers use, so
 * the two can never disagree; the Refresh button reads it again now.
 */
export function AvailableStockButton({ eventType }: { eventType: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const q = useHealthOptions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const choices = q.data?.items_by_event?.[eventType];

  const shown = useMemo(() => {
    const t = query.trim().toLowerCase();
    const all = choices ?? [];
    return t ? all.filter((x) => `${x.item_name ?? ""} ${x.value}`.toLowerCase().includes(t)) : all;
  }, [choices, query]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.btn, pressed && { backgroundColor: c.bgMuted }]}
        accessibilityRole="button"
        accessibilityLabel="Available stock"
      >
        <MaterialCommunityIcons name="warehouse" size={16} color={c.textMuted} />
        <Text style={s.btnLabel}>Available stock</Text>
      </Pressable>
      <Modal visible={open} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.header}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Available stock · {eventType}</Text>
                <Text style={s.meta}>
                  {q.isFetching ? "Refreshing…" : `Last refreshed ${clock(q.dataUpdatedAt)}`}
                </Text>
              </View>
              <Pressable onPress={() => void q.refetch()} hitSlop={8} style={{ marginRight: 14 }}>
                <MaterialCommunityIcons name="refresh" size={20} color={c.text} />
              </Pressable>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color={c.text} />
              </Pressable>
            </View>
            <View style={s.searchRow}>
              <MaterialCommunityIcons name="magnify" size={16} color={c.textSubtle} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Type to filter"
                placeholderTextColor={c.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                style={s.searchInput}
              />
            </View>
            <FlatList
              data={shown}
              keyExtractor={(x) => x.value}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={s.empty}>
                  {choices ? "Nothing in stock for this." : "Stock has not loaded. Pull the screen down to retry."}
                </Text>
              }
              renderItem={({ item }) => (
                <View style={s.row}>
                  <Text style={s.name} numberOfLines={2}>{item.item_name || item.value}</Text>
                  {(item.locations ?? []).map((l) => (
                    <View key={l.warehouse} style={s.store}>
                      <Text style={s.storeName} numberOfLines={1}>{l.warehouse}</Text>
                      <Text style={s.qty}>{fmt(l.qty)} {item.uom ?? ""}</Text>
                    </View>
                  ))}
                </View>
              )}
            />
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
      alignSelf: "flex-start",
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 8,
    },
    btnLabel: { fontSize: 12, color: c.text },
    backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 36,
      maxHeight: "85%",
      minHeight: "55%",
    },
    header: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    title: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: c.text },
    meta: { fontSize: 11, color: c.textMuted, marginTop: 1 },
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
    empty: { paddingVertical: 30, textAlign: "center", color: c.textSubtle, fontSize: 12 },
    row: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    name: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: c.text },
    store: { flexDirection: "row", justifyContent: "space-between", marginTop: 3, gap: 10 },
    storeName: { flex: 1, fontSize: 11, color: c.textMuted },
    qty: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: c.text },
  });
