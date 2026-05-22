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
import { useHerds } from "@/src/hooks/useHerds";

export default function HerdDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const herdName = decodeURIComponent(name || "");

  const herdsQ = useHerds();
  const animalsQ = useAnimals();

  const h = useMemo(
    () => herdsQ.data?.find((x) => x.n === herdName) ?? null,
    [herdsQ.data, herdName],
  );

  const inHerd = useMemo(
    () => (animalsQ.data ?? []).filter((a) => a.herd === herdName),
    [animalsQ.data, herdName],
  );

  const isLoading = herdsQ.isLoading || animalsQ.isLoading;
  const error = herdsQ.error || animalsQ.error;
  const isRefetching = herdsQ.isRefetching || animalsQ.isRefetching;
  const refetch = () => {
    herdsQ.refetch();
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

      {h.bom ? (
        <>
          <SectionTitle>Feeding plan (TMR / BOM)</SectionTitle>
          <View style={s.bom}>
            <Text style={s.bomTitle}>{h.bom}</Text>
            <Text style={s.bomSub}>Linked BOM determines cost-per-kg DMI for this herd</Text>
            <Button label="View ration items" variant="outline" />
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
});
