import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Divider } from "@/components/Divider";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { MetricGrid } from "@/components/MetricGrid";
import { Pill } from "@/components/Pill";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { FONT_FAMILY } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { StockBinRow } from "@/src/frappe/stock";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { useStockBins } from "@/src/hooks/useStockBins";
import { extractFrappeError } from "@/src/services/api";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const fmtQty = (q: number, uom: string) =>
  `${q.toLocaleString(undefined, { maximumFractionDigits: 2 })}${uom ? ` ${uom}` : ""}`;

const TONES: Record<string, "calf" | "bull" | "warning"> = {
  colostrum: "calf",
  drugs: "warning",
  semen: "bull",
  feed: "calf",
};

const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  colostrum: "water",
  drugs: "pill",
  semen: "test-tube",
  feed: "grain",
};

const TITLES: Record<string, { title: string; sub: string }> = {
  colostrum: { title: "Colostrum bank", sub: "Stock by warehouse" },
  drugs: { title: "Drug inventory", sub: "Stock at the drug warehouse" },
  semen: { title: "Semen straws", sub: "Stock at the semen warehouse" },
  feed: { title: "Feed inventory", sub: "Stock across feed warehouses" },
};

function StockList({
  type,
  rows,
  totalValue,
}: {
  type: string;
  rows: StockBinRow[];
  totalValue: number;
}) {
  // Group rows by warehouse so the operator can see where stock lives.
  const grouped = useMemo(() => {
    const out: Record<string, StockBinRow[]> = {};
    for (const r of rows) {
      (out[r.warehouse] ||= []).push(r);
    }
    return out;
  }, [rows]);

  const warehouses = Object.keys(grouped).sort();
  const totalQty = rows.reduce((a, r) => a + r.actualQty, 0);
  const tone = TONES[type] ?? "calf";
  const icon = ICONS[type] ?? "package-variant";

  return (
    <>
      <SectionHeader title="Stock overview" subtitle="On-hand quantities" />
      <MetricGrid
        items={[
          { label: "Distinct items", value: String(rows.length), sub: rows.length === 1 ? "row" : "rows" },
          { label: "Total qty", value: totalQty.toLocaleString(undefined, { maximumFractionDigits: 1 }), sub: rows[0]?.stockUom || "" },
          { label: "Stock value", value: Math.round(totalValue).toLocaleString(), sub: "KES" },
          { label: "Warehouses", value: String(warehouses.length), sub: "" },
        ]}
      />

      {rows.length === 0 ? (
        <Banner tone="info">No stock currently on hand.</Banner>
      ) : (
        warehouses.map((wh, i) => (
          <View key={wh}>
            {i > 0 ? <Divider /> : null}
            <SectionHeader title={wh} subtitle={`${grouped[wh].length} item${grouped[wh].length === 1 ? "" : "s"}`} />
            {grouped[wh].map((r) => (
              <Row
                key={`${r.itemCode}-${r.warehouse}`}
                left={<Avatar icon={icon} tone={tone as any} />}
                title={r.itemName}
                meta={`${r.itemCode}${r.valuationRate ? ` · ${Math.round(r.valuationRate).toLocaleString()} KES/${r.stockUom || "unit"}` : ""}`}
                right={
                  <Pill
                    label={fmtQty(r.actualQty, r.stockUom)}
                    tone={r.actualQty > 0 ? "success" : "danger"}
                  />
                }
              />
            ))}
          </View>
        ))
      )}
    </>
  );
}

export default function Inventory() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { type } = useLocalSearchParams<{ type: string }>();
  const meta = TITLES[type ?? ""];
  const { data: settings } = useLivestockSettings();

  // Map each inventory bucket to a warehouse / item filter pulled from
  // Livestock Settings so this stays in sync with the server-side config.
  const args = useMemo(() => {
    switch (type) {
      case "drugs":
        return { warehouse: settings?.custom_drug_warehouse, enabled: !!settings };
      case "semen":
        return { warehouse: settings?.custom_semen_warehouse, enabled: !!settings };
      case "colostrum":
        // Colostrum is item-defined, not warehouse-defined.
        return { itemNameLike: "Colostrum", enabled: true };
      case "feed":
        // Feed isn't isolated to one warehouse — show everything in the
        // milk target / discard warehouses (the dairy-feed buckets) plus
        // any item whose name suggests feed. This is best-effort until
        // the schema models a Feed warehouse explicitly.
        return { itemNameLike: "feed", enabled: true };
      default:
        return { enabled: false };
    }
  }, [type, settings]);

  const { data: rows = [], isLoading, isRefetching, error, refetch } = useStockBins(args);

  const totalValue = useMemo(
    () => rows.reduce((a, r) => a + r.actualQty * r.valuationRate, 0),
    [rows],
  );

  if (!meta) {
    return (
      <Screen title="Inventory" back>
        <View style={s.empty}>
          <MaterialCommunityIcons name="package-variant-closed" size={48} color={c.textSubtle} />
          <Text style={s.emptyText}>Unknown inventory category &quot;{type}&quot;.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={meta.title}
      subtitle={meta.sub}
      back
      onRefresh={refetch}
      refreshing={isRefetching}
    >
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      ) : (
        <StockList type={type ?? ""} rows={rows} totalValue={totalValue} />
      )}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    sectionHeader: {
      marginTop: 4,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 17,
      color: c.text,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: -0.2,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: FONT_FAMILY.regular,
      marginTop: 3,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 13,
      color: c.textMuted,
      fontFamily: FONT_FAMILY.regular,
      textAlign: "center",
    },
  });
