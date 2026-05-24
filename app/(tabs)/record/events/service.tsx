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
  const [selected, setSelected] = useState<Animal[]>([]);
  const [type, setType] = useState<"A.I." | "Natural">("A.I.");
  const [straw, setStraw] = useState<string>("");
  const [sireCatalog, setSireCatalog] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (selected.length === 0) return setError("Pick at least one cow to service.");
    if (operator !== defaultOperator) await setStoredOperator(operator);

    let succeeded = 0;
    let queued = 0;
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          eventType: "Service",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          eventDate: todayISO(),
          serviceType: type,
          semenItem: straw || undefined,
          sire: sireCatalog || undefined,
          remarks: remarks || undefined,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
      } catch (err) {
        setError(
          `${succeeded + queued} of ${selected.length} served. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }
    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} served`);
    if (queued) parts.push(`${queued} queued (offline)`);
    Alert.alert("Service recorded", parts.join(" · "));
    router.replace("/(tabs)/record/success?name=Service");
  };

  return (
    <Screen title="Service / AI" subtitle="Issue semen straw" back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field
        label="Cow(s)"
        help="Pick one or many. Same straw issued per cow; one Animal Event per cow on submit."
      >
        <AnimalPickerButton
          mode="multi"
          title="Select cows (eligible only)"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search cow on heat..."}
          include={(a) => a.sex === "F" && !a.pregnant && a.repro !== "Calf"}
          value={selected}
          onPickMulti={setSelected}
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
      <Field label="Semen straw (Item)" help="Search Frappe Items. 1 straw issued from Stores per cow on submit.">
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
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
