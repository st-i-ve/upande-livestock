import { router } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, Input, Textarea } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/src/auth/authStore";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

type Result = "Confirmed" | "Not Pregnant" | "Aborted";

export default function PD() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [result, setResult] = useState<Result>("Confirmed");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (!animal) return setError("Pick the served cow.");
    if (operator !== defaultOperator) await setStoredOperator(operator);

    try {
      const r = await mutation.mutateAsync({
        eventType: "Pregnancy Diagnosis",
        animal: animal.id,
        currentHerd: animal.herd,
        operator,
        eventDate: todayISO(),
        diagnosisResult: result,
        remarks: remarks || undefined,
      });
      Alert.alert(
        r.queued ? "Queued offline" : "PD recorded",
        r.queued
          ? `${animal.name} saved locally. Will sync when online.`
          : result === "Confirmed"
            ? `${animal.name} confirmed pregnant. Expected calving in 280 days.`
            : `${animal.name} marked ${result}.`,
      );
      router.replace("/(tabs)/record/success?name=Pregnancy diagnosis");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="Pregnancy diagnosis" subtitle="Confirm or rule out" back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field label="Cow">
        <AnimalPickerButton
          title="Select served cow"
          placeholder="Search served cow..."
          include={(a) => a.sex === "F"}
          value={animal}
          onPickSingle={setAnimal}
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
        disabled={mutation.isPending || !animal}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
