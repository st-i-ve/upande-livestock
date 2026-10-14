import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";

import { AnimalRow } from "@/components/AnimalRow";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { MetricGrid } from "@/components/MetricGrid";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { extractFrappeError } from "@/src/services/api";
import { useCanRecord } from "@/src/hooks/useCanRecord";
import { useAnimals } from "@/src/hooks/useAnimals";
import { useHerds } from "@/src/hooks/useHerds";

export default function HerdDetail() {
  const { canRecord } = useCanRecord();
  const { name } = useLocalSearchParams<{ name: string }>();
  const herdName = decodeURIComponent(name || "");

  // Read-only: rations and recipes are configured on the web.
  const herdQ = useHerds();
  const animalsQ = useAnimals();

  const h = (herdQ.data ?? []).find((x) => x.n === herdName) ?? null;

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
        ]}
      />

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

      {canRecord ? (
        <>
          <SectionTitle>Quick actions</SectionTitle>
          <Button label="Feed this herd" icon="grain" variant="outline" onPress={() => router.push("/(tabs)/record/events/animal-feed")} />
          <Button label="Record milking" icon="water" variant="outline" onPress={() => router.push("/(tabs)/record/events/milk")} />
        </>
      ) : null}
    </Screen>
  );
}
