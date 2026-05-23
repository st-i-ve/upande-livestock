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
import { useCulls } from "@/src/hooks/useDisposals";
import { extractFrappeError } from "@/src/services/api";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const topReason = (rows: { disposalType: string }[]): string => {
  if (rows.length === 0) return "—";
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.disposalType] = (counts[r.disposalType] ?? 0) + 1;
  const winner = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  return winner ? winner[0] : "—";
};

export default function CullsList() {
  const { data: culls = [], isLoading, isRefetching, error, refetch } = useCulls();

  const { ytdWriteOff, ytdCount, ytdTop } = useMemo(() => {
    const year = new Date().getFullYear().toString();
    const ytd = culls.filter((c) => (c.disposalDate || "").startsWith(year));
    // gain_loss is negative for losses; sum the absolute book-value impact.
    const totalLoss = ytd.reduce((acc, c) => acc + (c.gainLoss < 0 ? c.gainLoss : 0), 0);
    return {
      ytdWriteOff: totalLoss,
      ytdCount: ytd.length,
      ytdTop: topReason(ytd),
    };
  }, [culls]);

  return (
    <Screen
      title="Culls / deaths"
      subtitle="Animals removed without sale"
      back
      onRefresh={refetch}
      refreshing={isRefetching}
    >
      <SectionHeader title="Year-to-date" subtitle="Write-offs and leading causes" />
      <MetricGrid
        items={[
          {
            label: "YTD write-off",
            value: ytdWriteOff.toLocaleString(),
            sub: `${ytdCount} animal${ytdCount === 1 ? "" : "s"} · KES`,
          },
          { label: "Top reason", value: ytdTop, sub: "", small: true },
        ]}
      />

      <Divider />

      <SectionHeader title="Record a cull or death" subtitle="Writes the asset off the GL" />
      <Button
        label="Record cull / death"
        icon="delete"
        variant="danger"
        onPress={() => router.push("/(tabs)/record/culls/new")}
      />

      <Divider />

      <SectionHeader title="Recent removals" subtitle="Last entries with book value impact" />
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      ) : culls.length === 0 ? (
        <Banner tone="info">No culls or deaths recorded yet.</Banner>
      ) : (
        culls.slice(0, 30).map((c) => (
          <Row
            key={c.name}
            left={<Avatar icon="delete" tone="danger" />}
            title={`${c.animalName} · ${c.disposalType}`}
            meta={`${c.disposalDate} · book ${c.bookValue.toLocaleString()} written off${c.insuranceClaimAmount ? ` · insurance ${c.insuranceClaimAmount.toLocaleString()}` : ""}`}
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
