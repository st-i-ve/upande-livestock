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
  const [selected, setSelected] = useState<Animal[]>([]);
  const [condition, setCondition] = useState("");
  const [severity, setSeverity] = useState<CaseSeverity>("Moderate");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalHealthCase();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (selected.length === 0) return setError("Pick at least one animal.");
    if (!company) return setError("Default company not loaded yet. Try again in a moment.");
    if (!condition.trim() && !notes.trim()) {
      return setError("Describe the condition or symptoms before opening a case.");
    }
    if (operator !== defaultOperator) await setStoredOperator(operator);

    const presentingSymptoms = [condition.trim(), notes.trim()].filter(Boolean).join(" — ");

    let succeeded = 0;
    let queued = 0;
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          animal: a.id,
          company,
          openedBy: operator,
          openedDate: todayISO(),
          caseStatus: "Open",
          presentingSymptoms,
          severity,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
      } catch (err) {
        setError(
          `${succeeded + queued} of ${selected.length} opened. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }
    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} case${succeeded === 1 ? "" : "s"} opened`);
    if (queued) parts.push(`${queued} queued (offline)`);
    Alert.alert("Health cases opened", parts.join(" · "));
    router.replace("/(tabs)/record/success?name=Health case");
  };

  return (
    <Screen title="New health case" subtitle="Opens cases in the action queue" back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field
        label="Animal(s)"
        help="Pick one or many — same condition opens a case per animal."
      >
        <AnimalPickerButton
          mode="multi"
          title="Select animals"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search by tag or name…"}
          value={selected}
          onPickMulti={setSelected}
        />
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
        label={mutation.isPending ? "Opening…" : selected.length > 1 ? `Open ${selected.length} cases` : "Open case"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
