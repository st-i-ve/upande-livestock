import { router } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Divider } from "@/components/Divider";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { MetricGrid } from "@/components/MetricGrid";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { useSales } from "@/src/hooks/useDisposals";
import { extractFrappeError } from "@/src/services/api";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function SalesList() {
  const { data: sales = [], isLoading, isRefetching, error, refetch } = useSales();

  const { ytdRevenue, ytdProfit, count } = useMemo(() => {
    const year = new Date().getFullYear().toString();
    const ytd = sales.filter((s) => (s.disposalDate || "").startsWith(year));
    return {
      ytdRevenue: ytd.reduce((acc, s) => acc + s.salePrice, 0),
      ytdProfit: ytd.reduce((acc, s) => acc + s.gainLoss, 0),
      count: ytd.length,
    };
  }, [sales]);

  return (
    <Screen
      title="Sales"
      subtitle="Animals sold to buyers"
      back
      onRefresh={refetch}
      refreshing={isRefetching}
    >
      <SectionHeader title="Year-to-date" subtitle="Revenue and profit summary" />
      <MetricGrid
        items={[
          { label: "YTD revenue", value: ytdRevenue.toLocaleString(), sub: `${count} sale${count === 1 ? "" : "s"} · KES` },
          {
            label: "YTD net P&L",
            value: `${ytdProfit >= 0 ? "+" : ""}${ytdProfit.toLocaleString()}`,
            sub: "vs book value",
          },
        ]}
      />

      <Divider />

      <SectionHeader title="Record a new sale" subtitle="Posts gain/loss to the GL" />
      <Button label="Record sale" icon="cash" onPress={() => router.push("/(tabs)/record/sales/new")} />

      <Divider />

      <SectionHeader title="Recent sales" subtitle="Most recent disposals where type = Sold" />
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      ) : sales.length === 0 ? (
        <Banner tone="info">No sales recorded yet.</Banner>
      ) : (
        sales.slice(0, 20).map((sale) => (
          <Row
            key={sale.name}
            left={<Avatar icon="cash" />}
            title={`${sale.animalName}${sale.buyerName ? ` → ${sale.buyerName}` : ""}`}
            meta={`${sale.disposalDate} · ${sale.salePrice.toLocaleString()} KES · ${sale.gainLoss >= 0 ? "gain" : "loss"} ${Math.abs(sale.gainLoss).toLocaleString()}`}
          />
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
    marginTop: 3,
  },
});
