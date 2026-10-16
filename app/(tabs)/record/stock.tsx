import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Loader } from "@/components/Loader";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { extractFrappeError } from "@/src/services/api";
import { useColors } from "@/src/hooks/useColors";
import { useLivestockStock } from "@/src/hooks/useLivestockStock";
import { usePullToRefresh, useRefreshOnFocus } from "@/src/hooks/useServerLists";

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Stock in the livestock stores: read-only, online only, searchable. Only the
 * item groups the farm set events to post stock from are listed (the server
 * decides; field roles cannot read Bin). Pull down to read it again.
 */
export default function LivestockStockList() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const q = useLivestockStock();
  const { refreshing, onRefresh } = usePullToRefresh();
  useRefreshOnFocus();
  const [query, setQuery] = useState("");

  const stores = useMemo(() => {
    const t = query.trim().toLowerCase();
    return (q.data?.stores ?? [])
      .map((st) => ({
        ...st,
        items: t
          ? st.items.filter((i) => `${i.item_name} ${i.item_code} ${st.warehouse}`.toLowerCase().includes(t))
          : st.items,
      }))
      .filter((st) => st.items.length);
  }, [q.data, query]);

  const updated = q.dataUpdatedAt
    ? new Date(q.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "";

  return (
    <Screen title="Stock" subtitle={updated ? `Last refreshed ${updated}` : "Livestock stores"} back onRefresh={onRefresh} refreshing={refreshing}>
      <View style={s.searchRow}>
        <MaterialCommunityIcons name="magnify" size={16} color={c.textSubtle} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search item or store"
          placeholderTextColor={c.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          style={s.searchInput}
        />
      </View>
      {q.isLoading ? <Loader /> : null}
      {q.error ? <Banner tone="danger">{extractFrappeError(q.error)}</Banner> : null}
      {q.data && !stores.length ? (
        <Text style={s.empty}>{query ? "No match." : "Nothing in stock in the livestock stores."}</Text>
      ) : null}
      {stores.map((st) => (
        <View key={st.warehouse}>
          <SectionTitle>{st.warehouse}</SectionTitle>
          {st.items.map((i) => (
            <View key={i.item_code} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={2}>{i.item_name}</Text>
                {i.events.length ? <Text style={s.meta} numberOfLines={1}>{i.events.join(", ")}</Text> : null}
              </View>
              <Text style={s.qty}>{fmt(i.qty)} {i.uom}</Text>
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
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
      gap: 10,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    name: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: c.text },
    meta: { fontSize: 11, color: c.textMuted, marginTop: 1 },
    qty: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: c.text },
  });
