import React, { useState } from "react";
import {  } from "react-native";
import { recordSuccess } from "@/src/ui/recordSuccess";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, Input, Textarea } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/src/auth/authStore";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useServicedPendingPd } from "@/src/hooks/useServicedPendingPd";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

type Result = "Confirmed" | "Not Pregnant" | "Aborted";

export default function PD() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [selected, setSelected] = useState<Animal[]>([]);
  const [result, setResult] = useState<Result>("Confirmed");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();
  const { data: servedIds, isLoading: filterLoading } = useServicedPendingPd();

  const resetForm = () => {
    setSelected([]);
    setResult("Confirmed");
    setRemarks("");
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (selected.length === 0) return setError("Pick at least one cow.");
    if (operator !== defaultOperator) await setStoredOperator(operator);

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
    recordSuccess({
      title: "PD recorded",
      message: `${parts.join(" · ")}${result === "Confirmed" && succeeded > 0 ? "\nExpected calving in 280 days per cow." : ""}`,
      onAnother: resetForm,
    });
  };

  return (
    <Screen title="Pregnancy diagnosis" subtitle="Confirm or rule out" back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
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
