import { router } from "expo-router";
import React, { useMemo } from "react";

import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Pill } from "@/components/Pill";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { useHealthCases } from "@/src/hooks/useHealthCases";
import { extractFrappeError } from "@/src/services/api";

const isOpen = (status: string) =>
  status === "Open" || status === "Under Treatment";

export default function Cases() {
  const { data: cases = [], isLoading, isRefetching, error, refetch } = useHealthCases();

  const { open, closed } = useMemo(() => {
    const o = cases.filter((c) => isOpen(c.caseStatus));
    const c = cases.filter((x) => !isOpen(x.caseStatus));
    return { open: o, closed: c.slice(0, 20) };
  }, [cases]);

  const subtitle = cases.length
    ? `${open.length} open · ${closed.length} closed`
    : "";

  return (
    <Screen
      title="Health cases"
      subtitle={subtitle}
      back
      onRefresh={refetch}
      refreshing={isRefetching}
    >
      <Button label="New case" icon="plus" onPress={() => router.push("/(tabs)/record/cases/new")} />

      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      ) : cases.length === 0 ? (
        <Banner tone="info">No health cases recorded yet.</Banner>
      ) : (
        <>
          <SectionTitle>Open</SectionTitle>
          {open.length === 0 ? (
            <Empty text="No open cases" />
          ) : (
            open.map((c) => (
              <Row
                key={c.name}
                left={<Avatar icon="stethoscope" tone="danger" />}
                title={`${c.animalName} · ${c.presentingSymptoms || "—"}`}
                meta={`${c.name} · ${c.openedDate}${c.totalTreatmentCost ? ` · ${Math.round(c.totalTreatmentCost).toLocaleString()} KES` : ""}`}
                right={<Pill label={c.caseStatus} tone="danger" />}
              />
            ))
          )}

          {closed.length > 0 ? (
            <>
              <SectionTitle>Recently closed</SectionTitle>
              {closed.map((c) => (
                <Row
                  key={c.name}
                  left={<Avatar icon="stethoscope" />}
                  title={`${c.animalName} · ${c.presentingSymptoms || "—"}`}
                  meta={`${c.name} · ${c.openedDate}${c.duration != null ? ` · ${c.duration}d` : ""}`}
                  right={<Pill label={c.caseStatus} />}
                />
              ))}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
