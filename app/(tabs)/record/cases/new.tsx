import { router } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/src/auth/authStore";
import type { CaseSeverity } from "@/src/frappe/animalHealthCase";
import { useCreateAnimalHealthCase } from "@/src/hooks/mutations";
import { useDefaultCompany } from "@/src/hooks/useDefaultCompany";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

const SEVERITIES: CaseSeverity[] = ["Mild", "Moderate", "Severe", "Critical"];

export default function CaseNew() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);
  const { data: company } = useDefaultCompany();

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [condition, setCondition] = useState("");
  const [severity, setSeverity] = useState<CaseSeverity>("Moderate");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalHealthCase();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (!animal) return setError("Pick an animal.");
    if (!company) return setError("Default company not loaded yet. Try again in a moment.");
    if (!condition.trim() && !notes.trim()) {
      return setError("Describe the condition or symptoms before opening a case.");
    }
    if (operator !== defaultOperator) await setStoredOperator(operator);

    const presentingSymptoms = [condition.trim(), notes.trim()].filter(Boolean).join(" — ");

    try {
      await mutation.mutateAsync({
        animal: animal.id,
        company,
        openedBy: operator,
        openedDate: todayISO(),
        caseStatus: "Open",
        presentingSymptoms,
        severity,
      });
      Alert.alert("Health case opened", `New case opened for ${animal.name}.`);
      router.replace("/(tabs)/record/success?name=Health case");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="New health case" subtitle="Opens an active case in the action queue" back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field label="Animal">
        <AnimalPickerButton value={animal} onPickSingle={setAnimal} />
      </Field>
      <Field label="Date">
        <Input value={todayISO()} editable={false} />
      </Field>
      <Field label="Condition">
        <Input value={condition} onChangeText={setCondition} placeholder="Mastitis, lameness, ..." />
      </Field>
      <Field label="Severity">
        <Picker value={severity} onChange={(v) => setSeverity(v as CaseSeverity)} options={SEVERITIES} />
      </Field>
      <Field label="Presenting symptoms / notes">
        <Textarea value={notes} onChangeText={setNotes} placeholder="Observations, treatment plan, ..." />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Opening…" : "Open case"}
        disabled={mutation.isPending || !animal}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
