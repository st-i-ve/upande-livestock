import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Field } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Picker } from "@/components/Picker";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { qtyAt, type StockChoice } from "@/src/frappe/eventItems";
import { useColors } from "@/src/hooks/useColors";
import { storeQtyKey, useStoreQtyMap } from "@/src/hooks/useStoreQty";

export type StockPick = { itemCode: string; uom: string; warehouse: string };

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Item + store + what is in it, for any event line that issues stock.
 *
 * Same contract as the web StockPicker: `choices` are the event type's
 * in-stock items (`items_by_event`), each carrying the store holding the most
 * of it and every store holding any. Picking an item picks its store; the store
 * can be moved to another that genuinely has the item. With no choices (the
 * event type is not mapped to post stock, or the list did not load) it falls
 * back to free item / warehouse search with a live Bin read.
 */
export function StockItemFields({
  choices,
  value,
  onChange,
  qtyNeeded,
  itemLabel = "Item",
  icon = "pill",
}: {
  choices: StockChoice[] | undefined;
  value: StockPick;
  onChange: (next: StockPick) => void;
  /** Total the line will draw, to flag a shortage. */
  qtyNeeded?: number;
  itemLabel?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const c = useColors();
  const mapped = !!choices?.length;
  const chosen = mapped ? choices!.find((x) => x.value === value.itemCode) : undefined;

  // Live Bin read, only for the free-pick fallback.
  const live = useStoreQtyMap(
    !mapped && value.itemCode && value.warehouse
      ? [{ itemCode: value.itemCode, warehouse: value.warehouse }]
      : [],
  );
  const avail = mapped
    ? chosen
      ? (qtyAt(chosen, value.warehouse) ?? 0)
      : undefined
    : live.data?.[storeQtyKey(value.itemCode, value.warehouse)];

  const stores = chosen?.locations ?? [];
  const storeText = (l: { warehouse: string; qty: number }) =>
    `${l.warehouse} · ${fmt(l.qty)} ${chosen?.uom ?? value.uom}`.trim();

  return (
    <>
      <Field label={itemLabel}>
        {mapped ? (
          <ChoicePicker
            choices={choices!}
            value={value.itemCode}
            icon={icon}
            onPick={(ch) =>
              onChange({ itemCode: ch.value, uom: ch.uom ?? "", warehouse: ch.warehouse ?? "" })
            }
          />
        ) : (
          <FrappeSearchPicker
            doctype="Item"
            value={value.itemCode || null}
            onChange={(name, row) => onChange({ ...value, itemCode: name, uom: row?.stock_uom || "" })}
            fields={["name", "item_name", "item_code", "stock_uom"]}
            displayField="item_name"
            metaField="item_code"
            searchField="item_name"
            filters={[["disabled", "=", 0], ["is_stock_item", "=", 1]]}
            icon={icon}
          />
        )}
      </Field>
      <Field label="Issue from store">
        {mapped ? (
          stores.length ? (
            <Picker
              value={storeText(stores.find((l) => l.warehouse === value.warehouse) ?? stores[0])}
              options={stores.map(storeText)}
              onChange={(text) => {
                const hit = stores.find((l) => storeText(l) === text);
                if (hit) onChange({ ...value, warehouse: hit.warehouse });
              }}
            />
          ) : (
            <Text style={{ fontSize: 12, color: c.textSubtle }}>Pick an item first.</Text>
          )
        ) : (
          <FrappeSearchPicker
            doctype="Warehouse"
            value={value.warehouse || null}
            onChange={(name) => onChange({ ...value, warehouse: name })}
            fields={["name", "warehouse_name"]}
            displayField="warehouse_name"
            searchField="warehouse_name"
            filters={[["disabled", "=", 0]]}
            icon="warehouse"
          />
        )}
      </Field>
      {value.itemCode && value.warehouse ? (
        <Text
          style={{
            fontSize: 11,
            marginBottom: 8,
            color: avail != null && qtyNeeded != null && qtyNeeded > avail ? c.danger : c.textMuted,
          }}
        >
          {avail == null
            ? `Checking stock in ${value.warehouse}…`
            : `Available in ${value.warehouse}: ${fmt(avail)}${value.uom ? " " + value.uom : ""}${
                qtyNeeded != null && qtyNeeded > avail ? " — not enough" : ""
              }`}
        </Text>
      ) : null}
    </>
  );
}

function ChoicePicker({
  choices,
  value,
  onPick,
  icon,
}: {
  choices: StockChoice[];
  value: string;
  onPick: (c: StockChoice) => void;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = choices.find((x) => x.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? choices.filter((x) => `${x.item_name ?? ""} ${x.value}`.toLowerCase().includes(q))
      : choices;
  }, [choices, query]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.btn, pressed && { backgroundColor: c.bgMuted }]}
      >
        <MaterialCommunityIcons name={icon} size={16} color={c.textMuted} />
        <Text style={[s.btnLabel, !current && { color: c.textSubtle }]} numberOfLines={1}>
          {current ? current.item_name || current.value : "Select item…"}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={c.textSubtle} />
      </Pressable>
      <Modal visible={open} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.header}>
              <Text style={s.title}>Select item in stock</Text>
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
              ListEmptyComponent={<Text style={s.empty}>No matches</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onPick(item);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    s.row,
                    item.value === value && { backgroundColor: c.bgMuted },
                    pressed && { backgroundColor: c.bgMuted },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{item.item_name || item.value}</Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {fmt(item.qty ?? 0)} {item.uom ?? ""} in {item.warehouse}
                      {(item.locations?.length ?? 0) > 1 ? ` (+${item.locations!.length - 1} more)` : ""}
                    </Text>
                  </View>
                  {item.value === value ? <MaterialCommunityIcons name="check" size={18} color={c.text} /> : null}
                </Pressable>
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
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    btnLabel: { flex: 1, fontSize: 13, color: c.text },
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
    empty: { paddingVertical: 30, textAlign: "center", color: c.textSubtle, fontSize: 12 },
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
