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
import { useBatchDrugIssue, useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useDefaultCompany } from "@/src/hooks/useDefaultCompany";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

export default function Service() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [selected, setSelected] = useState<Animal[]>([]);
  const [type, setType] = useState<"A.I." | "Natural">("A.I.");
  const [straw, setStraw] = useState<string>("");
  const [semenWarehouse, setSemenWarehouse] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalEvent();
  const batchMutation = useBatchDrugIssue();
  const { data: company } = useDefaultCompany();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (selected.length === 0) return setError("Pick at least one cow to service.");
    // For A.I. with a semen straw, we issue it from a store — need the source.
    const willIssueSemen = type === "A.I." && !!straw;
    if (willIssueSemen && !semenWarehouse) {
      return setError("Pick the store the semen straws come from.");
    }
    if (willIssueSemen && !company) {
      return setError("Default company not loaded yet. Try again in a moment.");
    }
    if (operator !== defaultOperator) await setStoredOperator(operator);

    let succeeded = 0;
    let queued = 0;
    const eventNames: string[] = [];
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
          remarks: remarks || undefined,
        });
        if (r.queued) queued += 1;
        else {
          succeeded += 1;
          if (r.data?.name) eventNames.push(r.data.name);
        }
      } catch (err) {
        setError(
          `${succeeded + queued} of ${selected.length} served. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }

    // One Material Issue for the semen: one straw per inseminated cow, out of
    // the chosen store, attributed to the operator (satisfies the site's
    // Material Issue employee rule).
    let semenIssued = false;
    let semenError = "";
    if (willIssueSemen && company) {
      try {
        await batchMutation.mutateAsync({
          drugRows: [{ itemCode: straw, qty: selected.length, sourceWarehouse: semenWarehouse }],
          eventNames,
          batchId: `service_${Date.now()}`,
          remarks: `Service/AI · ${selected.length} cows · ${todayISO()}`,
          company,
          employee: operator,
        });
        semenIssued = true;
      } catch (err) {
        semenError = extractFrappeError(err);
      }
    }

    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} served`);
    if (queued) parts.push(`${queued} queued (offline)`);
    if (willIssueSemen) {
      parts.push(
        semenIssued
          ? `${selected.length} straw(s) issued from ${semenWarehouse}`
          : `semen issue FAILED: ${semenError}`,
      );
    }
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
      <Field label="Semen straw (Item)" help="Search Frappe Items. 1 straw issued per cow on submit.">
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
      {type === "A.I." && straw ? (
        <Field
          label="Semen store"
          help={`One straw per cow (${selected.length || 0}) is issued from here as a Material Issue.`}
        >
          <FrappeSearchPicker
            doctype="Warehouse"
            value={semenWarehouse || null}
            onChange={(name) => setSemenWarehouse(name)}
            fields={["name", "warehouse_name"]}
            displayField="warehouse_name"
            searchField="warehouse_name"
            filters={[["disabled", "=", 0]]}
            icon="warehouse"
          />
        </Field>
      ) : null}
      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Heat signs, technician notes..." />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending || batchMutation.isPending ? "Submitting…" : "Submit service"}
        disabled={mutation.isPending || batchMutation.isPending || selected.length === 0}
        loading={mutation.isPending || batchMutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
