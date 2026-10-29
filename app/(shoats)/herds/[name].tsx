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
import { extractFrappeError } from "@/src/services/api";
import { useShoatHerd } from "@/src/shoats/hooks";
import { kg, ledgerSummary } from "@/src/shoats/logic";

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

  return (
    <Screen title={h.label} subtitle={`${h.species} · ${h.head} head`} back onRefresh={() => refetch()} refreshing={isRefetching}>
      <MetricGrid
        items={[
          { label: "Head", value: h.head },
          { label: "Average weight", value: kg(h.avgKg), sub: h.weightDate ? `sampled ${h.weightDate}` : undefined },
          { label: "Live weight", value: kg(h.liveWeightKg) },
        ]}
      />
      {h.classes.length ? <MetricGrid items={h.classes.map((k) => ({ label: k.label, value: k.head }))} /> : null}

      {h.inWithdrawal && h.withdrawalUntil ? (
        <Banner tone="warning">In withdrawal until {h.withdrawalUntil}: no meat or sale before then.</Banner>
      ) : null}
      {h.nextDue ? (
        <Banner tone="info">
          {`Births expected around ${h.nextDue.expectedBirthDate}${h.nextDue.daysToDue != null ? ` (${h.nextDue.daysToDue < 0 ? `${-h.nextDue.daysToDue} days late` : `in ${h.nextDue.daysToDue} days`})` : ""}, ${h.nextDue.femalesServed} ${h.labels.females.toLowerCase()} served.`}
        </Banner>
      ) : null}
      {h.paddock ? <Banner tone="info">{`Grazing ${h.paddock}.`}</Banner> : null}

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

      {h.weights.length ? (
        <>
          <SectionTitle>Weigh samples</SectionTitle>
          <Timeline
            events={h.weights.slice(0, 5).map((w) => ({
              date: w.date,
              title: `${kg(w.averageKg)} average`,
              desc: `${w.animalsWeighed} weighed · ${w.sampleClass === "All" ? "whole herd" : h.labels[w.sampleClass as keyof typeof h.labels] ?? w.sampleClass}`,
            }))}
          />
        </>
      ) : null}
      {h.matings.length ? (
        <>
          <SectionTitle>Matings</SectionTitle>
          <Timeline
            events={h.matings.slice(0, 5).map((m) => ({
              date: m.matingStart ?? "",
              title: `${m.femalesServed} ${h.labels.females.toLowerCase()} · ${m.status}`,
              desc: `${m.malesIn} ${h.labels.males.toLowerCase()} in · due ${m.expectedBirthDate ?? "—"}${m.bornAlive || m.bornDead ? ` · ${m.bornAlive} born alive, ${m.bornDead} dead` : ""}`,
            }))}
          />
        </>
      ) : null}
      {h.treatments.length ? (
        <>
          <SectionTitle>Treatments</SectionTitle>
          <Timeline
            events={h.treatments.slice(0, 5).map((x) => ({
              date: x.date,
              title: `${x.treatmentType} · ${x.productName}`,
              desc: `${x.numberTreated} treated · ${x.quantity} ${x.doseUom}${x.withdrawalEnd ? ` · withdrawal to ${x.withdrawalEnd}` : ""}`,
            }))}
          />
        </>
      ) : null}

      <SectionTitle>History</SectionTitle>
      {h.ledger.length ? (
        <Timeline events={h.ledger.map((e) => ({ date: e.date, title: `${e.eventType} · ${e.headAfter} head`, desc: ledgerSummary(e, h.labels) }))} />
      ) : (
        <Empty text="Nothing on the ledger yet" />
      )}
    </Screen>
  );
}
