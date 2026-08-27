import { router } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, Input, Textarea } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useOperator } from "@/src/hooks/useOperator";
import { useServicedPendingPd } from "@/src/hooks/useServicedPendingPd";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

type Result = "Confirmed" | "Not Pregnant" | "Aborted";

export default function PD() {

  const { operator, missing: noOperator, missingMessage } = useOperator();
  const [selected, setSelected] = useState<Animal[]>([]);
  const [result, setResult] = useState<Result>("Confirmed");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();
  const { data: servedIds, isLoading: filterLoading } = useServicedPendingPd();

  const handleSubmit = async () => {
    setError(null);
    if (noOperator) return setError(missingMessage);
    if (selected.length === 0) return setError("Pick at least one cow.");

    let succeeded = 0;
    let queued = 0;
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          eventType: "Pregnancy Diagnosis",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          eventDate: todayISO(),
          diagnosisResult: result,
          remarks: remarks || undefined,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
      } catch (err) {
        setError(
          `${succeeded + queued} of ${selected.length} diagnosed. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }
    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} marked ${result}`);
    if (queued) parts.push(`${queued} queued (offline)`);
    Alert.alert(
      "PD recorded",
      `${parts.join(" · ")}${result === "Confirmed" && succeeded > 0 ? "\nExpected calving in 280 days per cow." : ""}`,
    );
    router.replace("/(tabs)/record/success?name=Pregnancy diagnosis");
  };

  return (
    <Screen title="Pregnancy diagnosis" subtitle="Confirm or rule out" back>
      <Field
        label="Cow(s)"
        help={
          filterLoading
            ? "Loading served animals…"
            : "Only animals with an open service. Pick one or many — same result applied to each."
        }
      >
        <AnimalPickerButton
          mode="multi"
          title="Select served cows"
          placeholder={
            filterLoading
              ? "Loading served animals…"
              : selected.length
                ? `${selected.length} selected — tap to change`
                : "Search served cow..."
          }
          include={(a) => a.sex === "F" && (servedIds ? servedIds.has(a.id) : false)}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <Field label="Diagnosis date"><Input value={todayISO()} editable={false} /></Field>
      <Field label="Result">
        <Chips>
          {(["Confirmed", "Not Pregnant", "Aborted"] as const).map((r) => (
            <Chip key={r} label={r} active={result === r} onPress={() => setResult(r)} />
          ))}
        </Chips>
      </Field>
      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Vet observations..." />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit PD"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
