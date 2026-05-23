import { router } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/src/auth/authStore";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

export default function Service() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [type, setType] = useState<"A.I." | "Natural">("A.I.");
  const [straw, setStraw] = useState<string>("");
  const [sireCatalog, setSireCatalog] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (!animal) return setError("Pick the cow to service.");
    if (operator !== defaultOperator) await setStoredOperator(operator);

    try {
      const r = await mutation.mutateAsync({
        eventType: "Service",
        animal: animal.id,
        currentHerd: animal.herd,
        operator,
        eventDate: todayISO(),
        serviceType: type,
        semenItem: straw || undefined,
        sire: sireCatalog || undefined,
        remarks: remarks || undefined,
      });
      Alert.alert(
        r.queued ? "Queued offline" : "Service recorded",
        r.queued
          ? `${animal.name} saved locally. Will sync when the device is back online.`
          : `${animal.name} marked as served.`,
      );
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
      <Field label="Semen straw (Item)" help="Search Frappe Items. 1 straw issued from Stores on submit.">
        <FrappeSearchPicker
          doctype="Item"
          value={straw || null}
          onChange={(name) => setStraw(name)}
          fields={["name", "item_name", "item_code"]}
          displayField="item_name"
          metaField="item_code"
          searchField="item_name"
          filters={[["disabled", "=", 0], ["is_stock_item", "=", 1]]}
          icon="test-tube"
        />
      </Field>
      <Field label="Sire (catalog · optional)">
        <FrappeSearchPicker
          doctype="Sire Catalog"
          value={sireCatalog || null}
          onChange={(name) => setSireCatalog(name)}
          fields={["name"]}
          icon="cow"
        />
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
