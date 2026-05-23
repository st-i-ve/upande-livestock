import { router } from "expo-router";
import React from "react";

import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Pill } from "@/components/Pill";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { useDiagnoses } from "@/src/hooks/useDiagnoses";
import { extractFrappeError } from "@/src/services/api";

const pillTone = (action: string): "danger" | "warning" | "default" => {
  if (action === "Escalated to Case" || action === "Referred to Vet") return "danger";
  if (action === "Treated on Spot" || action === "Logged — monitor") return "warning";
  return "default";
};

const shortAction = (action: string): string => {
  if (action === "Escalated to Case") return "→ Case";
  if (action === "Logged — monitor") return "Monitor";
  if (action === "Treated on Spot") return "Treated";
  if (action === "Referred to Vet") return "→ Vet";
  if (action === "No action — normal") return "No action";
  return action;
};

export default function Diagnoses() {
  const { data: items = [], isLoading, isRefetching, error, refetch } = useDiagnoses();

  return (
    <Screen
      title="Diagnoses"
      subtitle={items.length ? `${items.length} on record` : "Routine health observations"}
      back
      onRefresh={refetch}
      refreshing={isRefetching}
    >
      <Button label="New diagnosis" icon="plus" onPress={() => router.push("/(tabs)/record/events/diagnosis")} />

      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      ) : items.length === 0 ? (
        <Banner tone="info">No diagnoses recorded yet.</Banner>
      ) : (
        <>
          <SectionTitle>Recent</SectionTitle>
          {items.map((d) => (
            <Row
              key={d.name}
              left={<Avatar icon="magnify" />}
              title={`${d.animalName}${d.suggestedDiagnosis ? ` · ${d.suggestedDiagnosis}` : ""}`}
              meta={`${d.diagnosisDate} · ${d.name}${d.relatedCase ? ` · case ${d.relatedCase}` : ""}`}
              right={<Pill label={shortAction(d.actionTaken)} tone={pillTone(d.actionTaken)} />}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
