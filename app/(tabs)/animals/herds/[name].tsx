import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AnimalRow } from "@/components/AnimalRow";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { MetricGrid } from "@/components/MetricGrid";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { COLORS, RADIUS } from "@/constants/theme";
import { extractFrappeError } from "@/src/services/api";
import { useAnimals } from "@/src/hooks/useAnimals";
import { useHerd } from "@/src/hooks/useHerd";

export default function HerdDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const herdName = decodeURIComponent(name || "");

  // useHerd fetches the single doc with its ration_items child table inline.
  const herdQ = useHerd(herdName);
  const animalsQ = useAnimals();

  const h = herdQ.data ?? null;

  const inHerd = useMemo(
    () => (animalsQ.data ?? []).filter((a) => a.herd === herdName),
    [animalsQ.data, herdName],
  );

  const isLoading = herdQ.isLoading || animalsQ.isLoading;
  const error = herdQ.error || animalsQ.error;
  const isRefetching = herdQ.isRefetching || animalsQ.isRefetching;
  const refetch = () => {
    herdQ.refetch();
    animalsQ.refetch();
  };

  if (isLoading) {
    return (
      <Screen title="Herd" back>
        <Loader />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen title="Herd" back>
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      </Screen>
    );
  }
  if (!h) {
    return (
      <Screen title="Not found" back>
        <Banner tone="warning">Herd not found.</Banner>
      </Screen>
    );
  }

  return (
    <Screen
      title={h.n}
      subtitle={h.cat || undefined}
      back
      onRefresh={refetch}
      refreshing={isRefetching}
    >
      <MetricGrid
        items={[
          { label: "Animals", value: h.cnt },
          { label: "Cost centre", value: h.cc || "—", small: true },
        ]}
      />

      {h.bom || h.ration.length > 0 ? (
        <>
          <SectionTitle>Feeding plan (TMR / BOM)</SectionTitle>
          <View style={s.bom}>
            {h.bom ? <Text style={s.bomTitle}>{h.bom}</Text> : null}
            <Text style={s.bomSub}>
              {h.ration.length
                ? `${h.ration.length} ration item${h.ration.length === 1 ? "" : "s"}`
                : "Linked BOM determines cost-per-kg DMI for this herd"}
            </Text>
            {h.ration.length > 0 ? (
              <View style={s.rationList}>
                {h.ration.map((r, i) => (
                  <View key={`${r.name}-${i}`} style={s.rationRow}>
                    <Text style={s.rationName} numberOfLines={1}>{r.name || "—"}</Text>
                    {r.pct > 0 ? (
                      <Text style={s.rationPct}>{r.pct}%</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      <SectionTitle>
        Animals in herd {inHerd.length ? `(${inHerd.length} of ${h.cnt} shown)` : ""}
      </SectionTitle>
      {inHerd.length ? (
        inHerd.map((a) => (
          <AnimalRow
            key={a.id}
            a={a}
            meta={`${a.id} · ${a.lastWt} kg`}
            onPress={() => router.push(`/(tabs)/animals/${encodeURIComponent(a.id)}`)}
          />
        ))
      ) : (
        <Empty text="No animals in this herd" />
      )}

      <SectionTitle>Quick actions</SectionTitle>
      <Button label="Feed this herd" icon="grain" variant="outline" onPress={() => router.push("/(tabs)/record/events/animal-feed")} />
      <Button label="Record milking" icon="water" variant="outline" onPress={() => router.push("/(tabs)/record/events/milk")} />
    </Screen>
  );
}

const s = StyleSheet.create({
  bom: {
    backgroundColor: COLORS.bgMuted,
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 14,
  },
  bomTitle: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  bomSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  rationList: { marginTop: 10, gap: 6 },
  rationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  rationName: { flex: 1, fontSize: 12, color: COLORS.text },
  rationPct: { fontSize: 12, color: COLORS.textMuted, fontVariant: ["tabular-nums"] },
});
