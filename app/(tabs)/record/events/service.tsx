import { router } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/src/auth/authStore";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";
import { semenItems } from "@/data/mock";
import type { Animal } from "@/types";

export default function Service() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [type, setType] = useState<"A.I." | "Natural">("A.I.");
  const [straw, setStraw] = useState(semenItems[0]);
  const [sire, setSire] = useState("(none)");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (!animal) return setError("Pick the cow to service.");
    if (operator !== defaultOperator) await setStoredOperator(operator);

    // Strip the trailing item-code marker if present (e.g. "Semen Delta Stormer-F (4040030377)").
    // The Frappe Item link expects the raw item code if you have it; otherwise pass null.
    const code = /\(([^()]+)\)\s*$/.exec(straw)?.[1] ?? null;

    try {
      await mutation.mutateAsync({
        eventType: "Service",
        animal: animal.id,
        currentHerd: animal.herd,
        operator,
        eventDate: todayISO(),
        serviceType: type,
        semenItem: code ?? undefined,
        sire: sire === "(none)" ? undefined : sire,
        remarks: remarks || undefined,
      });
      Alert.alert("Service recorded", `${animal.name} marked as served.`);
      router.replace("/(tabs)/record/success?name=Service");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="Service / AI" subtitle="Issue semen straw" back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field label="Cow">
        <AnimalPickerButton
          title="Select cow (eligible only)"
          placeholder="Search cow on heat..."
          include={(a) => a.sex === "F" && !a.pregnant && a.repro !== "Calf"}
          value={animal}
          onPickSingle={setAnimal}
        />
      </Field>
      <FieldRow>
        <Field label="Service date" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
        <Field label="Type" style={{ flex: 1 }}>
          <Picker value={type} onChange={(v) => setType(v as "A.I." | "Natural")} options={["A.I.", "Natural"]} />
        </Field>
      </FieldRow>
      <Field label="Semen straw (Item)" help="Link to Item master · 1 straw issued from Stores on submit.">
        <Picker value={straw} onChange={setStraw} options={semenItems} />
      </Field>
      <Field label="Sire (catalog · optional)">
        <Picker value={sire} onChange={setSire} options={["(none)", "Delta Stormer (Holstein)", "Delta Keen (Holstein)"]} />
      </Field>
      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Heat signs, technician notes..." />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit service"}
        disabled={mutation.isPending || !animal}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
