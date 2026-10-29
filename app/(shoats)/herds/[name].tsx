import { router, useLocalSearchParams } from "expo-router";
import React from "react";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { MetricGrid } from "@/components/MetricGrid";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { Timeline } from "@/components/Timeline";
import { useCanRecord } from "@/src/hooks/useCanRecord";
import { extractFrappeError, todayISO } from "@/src/services/api";
import { useShoatHerd } from "@/src/shoats/hooks";
import { kg } from "@/src/shoats/logic";

export default function ShoatHerdPage() {
  const { canRecord } = useCanRecord();
  const { name } = useLocalSearchParams<{ name: string }>();
  const herdName = decodeURIComponent(name || "");
  const { data: h, isLoading, isRefetching, error, refetch } = useShoatHerd(herdName);

  if (isLoading) {
    return (
      <Screen title="Herd" back>
        <Loader />
      </Screen>
    );
  }
  if (error || !h) {
    return (
      <Screen title="Herd" back>
        {error ? <ErrorState text={extractFrappeError(error)} onRetry={() => refetch()} /> : <Banner tone="warning">Herd not found.</Banner>}
      </Screen>
    );
  }

  const go = (to: string) => router.push(`/(shoats)/record/${to}?herd=${encodeURIComponent(h.name)}` as any);
  const today = todayISO();

  return (
    <Screen title={h.label} subtitle={`${h.species} · ${h.head} head`} back onRefresh={() => refetch()} refreshing={isRefetching}>
      <MetricGrid
        items={[
          { label: "Head", value: h.head },
          { label: "Average weight", value: kg(h.avgKg), sub: h.lastSampleDate ? `sampled ${h.lastSampleDate}` : undefined },
          { label: "Live weight", value: kg(h.liveWeightKg) },
        ]}
      />
      {h.classes.length ? <MetricGrid items={h.classes.map((k) => ({ label: k.label, value: k.head }))} /> : null}

      {h.withdrawalUntil && h.withdrawalUntil >= today ? (
        <Banner tone="warning">In withdrawal until {h.withdrawalUntil}: no meat or sale before then.</Banner>
      ) : null}
      {h.expectedBirth ? <Banner tone="info">Next births expected around {h.expectedBirth}.</Banner> : null}

      {canRecord ? (
        <>
          <SectionTitle>Record for this herd</SectionTitle>
          <Button label="Weigh sample" icon="scale" onPress={() => go("weigh")} />
          <Button label="Count & movements" icon="counter" variant="outline" onPress={() => go("count")} />
          <Button label="Breeding" icon="heart" variant="outline" onPress={() => go("breeding")} />
          <Button label="Health" icon="medical-bag" variant="outline" onPress={() => go("health")} />
          <Button label="Feeding" icon="grain" variant="outline" onPress={() => go("feeding")} />
        </>
      ) : null}

      <SectionTitle>History</SectionTitle>
      {h.ledger.length ? (
        <Timeline events={h.ledger.map((e) => ({ date: e.date, title: e.eventType, desc: e.summary || undefined }))} />
      ) : (
        <Empty text="Nothing on the ledger yet" />
      )}
    </Screen>
  );
}
