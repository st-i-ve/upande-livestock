import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Screen } from "@/components/Screen";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { COLORS, RADIUS } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import {
  AnimalDrugIssueInput,
  AnimalEventType,
} from "@/src/frappe/animalEvent";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

type Spec = {
  title: string;
  eventType: AnimalEventType;
  // Which fields this screen should show beyond the universal ones.
  needsWeight?: boolean;
  needsDrugs?: boolean;
  needsActivityCost?: boolean;
  needsMethod?: boolean;
  needsFeet?: boolean;
  needsHeatSigns?: boolean;
  multi?: boolean;
};

const SPECS: Record<string, Spec> = {
  weight:      { title: "Weight recording",  eventType: "Weight Recording",  needsWeight: true },
  vaccination: { title: "Vaccination",       eventType: "Vaccination",       needsDrugs: true, needsActivityCost: true },
  deworming:   { title: "Deworming",         eventType: "Deworming",         needsDrugs: true, needsActivityCost: true },
  dehorning:   { title: "Dehorning",         eventType: "Dehorning",         needsMethod: true, needsActivityCost: true },
  hoof:        { title: "Hoof trimming",     eventType: "Hoof Trimming",     needsFeet: true, needsActivityCost: true },
  heat:        { title: "Heat detection",    eventType: "Heat Detection",    needsHeatSigns: true },
};

export default function GenericEvent() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const spec = SPECS[type || ""];
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [selected, setSelected] = useState<Animal[]>([]);
  const [weight, setWeight] = useState("");
  const [bcs, setBcs] = useState("");
  const [activityCost, setActivityCost] = useState("");
  const [method, setMethod] = useState("Hot iron");
  const [feet, setFeet] = useState("All four");
  const [heatSigns, setHeatSigns] = useState("");
  const [drugs, setDrugs] = useState<DrugRow[]>([]);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: settings } = useLivestockSettings();
  const defaultDrugWarehouse = settings?.custom_drug_warehouse || "";

  const mutation = useCreateAnimalEvent();

  if (!spec) {
    return (
      <Screen title="Unknown event" back>
        <Banner tone="warning">No form configured for &quot;{type}&quot;.</Banner>
      </Screen>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (selected.length === 0) return setError("Pick at least one animal.");
    if (spec.needsWeight && !weight) return setError("Enter the weight (kg).");
    if (spec.needsWeight && selected.length > 1) {
      // Weight is per-animal — applying the same value to many is almost
      // certainly wrong data. Make the user confirm by picking single.
      return setError("Weight recording takes one animal at a time. Unselect the others.");
    }
    if (operator !== defaultOperator) await setStoredOperator(operator);

    const drugIssues: AnimalDrugIssueInput[] = drugs
      .filter((d) => d.itemCode.trim() && Number(d.qty) > 0)
      .map((d) => ({
        itemCode: d.itemCode.trim(),
        qty: Number(d.qty),
        uom: d.uom || undefined,
        // Required by the Animal Drug Issue child table.
        sourceWarehouse: d.sourceWarehouse || defaultDrugWarehouse || undefined,
        withdrawalDays: d.withdrawalDays ? Number(d.withdrawalDays) : undefined,
      }));

    if (spec.needsDrugs && drugs.length > 0) {
      const missing = drugIssues.find((d) => !d.sourceWarehouse);
      if (missing) {
        return setError(
          "Pick a source warehouse on every drug row (or set Drug warehouse in Livestock Settings to apply a default).",
        );
      }
    }

    const remarksBits: string[] = [];
    if (spec.needsMethod) remarksBits.push(`Method: ${method}`);
    if (spec.needsFeet) remarksBits.push(`Feet: ${feet}`);
    if (spec.needsHeatSigns && heatSigns) remarksBits.push(`Heat signs: ${heatSigns}`);
    if (remarks) remarksBits.push(remarks);
    const finalRemarks = remarksBits.join(" · ") || undefined;

    let succeeded = 0;
    let queued = 0;
    for (const a of selected) {
      const common = {
        animal: a.id,
        currentHerd: a.herd,
        operator,
        eventDate: todayISO(),
        remarks: finalRemarks,
      } as const;
      try {
        let r: { queued: boolean; data: any };
        switch (spec.eventType) {
          case "Weight Recording":
            r = await mutation.mutateAsync({
              ...common,
              eventType: "Weight Recording",
              weightKg: Number(weight),
              bcs: bcs ? Number(bcs) : undefined,
            });
            break;
          case "Vaccination":
          case "Deworming":
          case "Dehorning":
          case "Hoof Trimming":
            r = await mutation.mutateAsync({
              ...common,
              eventType: spec.eventType,
              drugIssues: drugIssues.length ? drugIssues : undefined,
              activityCost: activityCost ? Number(activityCost) : undefined,
            });
            break;
          case "Heat Detection":
            r = await mutation.mutateAsync({ ...common, eventType: "Heat Detection" });
            break;
          default:
            throw new Error(`Unhandled event type ${spec.eventType}`);
        }
        if (r.queued) queued += 1;
        else succeeded += 1;
      } catch (err) {
        setError(
          `${succeeded + queued} of ${selected.length} submitted. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }
    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} submitted`);
    if (queued) parts.push(`${queued} queued (offline)`);
    Alert.alert(`${spec.title} recorded`, parts.join(" · "));
    router.replace(`/(tabs)/record/success?name=${encodeURIComponent(spec.title)}`);
  };

  return (
    <Screen title={spec.title} subtitle="New event" back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field
        label={spec.needsWeight ? "Animal" : "Animal(s)"}
        help={
          spec.needsWeight
            ? "Pick one animal — weight is per-animal."
            : "Pick one cow, several, or a whole herd. Same details applied per animal."
        }
      >
        <AnimalPickerButton
          mode="multi"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search by tag or name…"}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <Field label="Date"><Input value={todayISO()} editable={false} /></Field>

      {spec.needsWeight ? (
        <FieldRow>
          <Field label="Weight (kg)" style={{ flex: 1 }}>
            <Input value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="480" />
          </Field>
          <Field label="BCS (1-5)" style={{ flex: 1 }}>
            <Input value={bcs} onChangeText={setBcs} keyboardType="numeric" placeholder="3.5" />
          </Field>
        </FieldRow>
      ) : null}

      {spec.needsMethod ? (
        <Field label="Method">
          <Chips>
            {["Hot iron", "Caustic paste", "Surgical"].map((m) => (
              <Chip key={m} label={m} active={method === m} onPress={() => setMethod(m)} />
            ))}
          </Chips>
        </Field>
      ) : null}

      {spec.needsFeet ? (
        <Field label="Feet">
          <Chips>
            {["Front-L", "Front-R", "Hind-L", "Hind-R", "All four"].map((f) => (
              <Chip key={f} label={f} active={feet === f} onPress={() => setFeet(f)} />
            ))}
          </Chips>
        </Field>
      ) : null}

      {spec.needsHeatSigns ? (
        <Field label="Heat signs">
          <Textarea
            value={heatSigns}
            onChangeText={setHeatSigns}
            placeholder="Mounting, mucus, restless, vulva swelling..."
          />
        </Field>
      ) : null}

      {spec.needsDrugs ? (
        <DrugRows
          rows={drugs}
          onChange={setDrugs}
          defaultWarehouse={defaultDrugWarehouse}
        />
      ) : null}

      {spec.needsActivityCost ? (
        <Field label="Activity cost (KES)">
          <Input
            value={activityCost}
            onChangeText={setActivityCost}
            keyboardType="numeric"
            placeholder="0"
          />
        </Field>
      ) : null}

      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Optional notes" />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : `Submit ${spec.title.toLowerCase()}`}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

type DrugRow = {
  id: number;
  itemCode: string;
  qty: string;
  uom: string;
  /** Required by Animal Drug Issue — Frappe rejects the doc without it. */
  sourceWarehouse: string;
  withdrawalDays: string;
};

function DrugRows({
  rows,
  onChange,
  defaultWarehouse,
}: {
  rows: DrugRow[];
  onChange: (rows: DrugRow[]) => void;
  /** Pre-fills sourceWarehouse on new rows (Livestock Settings drug warehouse). */
  defaultWarehouse: string;
}) {
  const add = () =>
    onChange([
      ...rows,
      {
        id: Date.now() + rows.length,
        itemCode: "",
        qty: "1",
        uom: "",
        sourceWarehouse: defaultWarehouse,
        withdrawalDays: "",
      },
    ]);
  const update = (id: number, patch: Partial<DrugRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => onChange(rows.filter((r) => r.id !== id));

  return (
    <Field
      label="Drugs / vaccines (optional)"
      help={
        defaultWarehouse
          ? `Each row issues stock and posts a vet expense JE on submit. Source warehouse defaults to ${defaultWarehouse}.`
          : "Each row issues stock and posts a vet expense JE on submit. Pick a source warehouse for each row — set a default via Livestock Settings → Drug warehouse."
      }
    >
      {rows.length === 0 ? (
        <Text style={s.drugEmpty}>No drug rows. Tap “Add drug” if any drug was used.</Text>
      ) : null}
      {rows.map((r) => (
        <View key={r.id} style={s.drugBox}>
          <Field label="Item">
            <FrappeSearchPicker
              doctype="Item"
              value={r.itemCode || null}
              onChange={(name, row) =>
                update(r.id, { itemCode: name, uom: r.uom || row?.stock_uom || "" })
              }
              fields={["name", "item_name", "item_code", "stock_uom"]}
              displayField="item_name"
              metaField="item_code"
              searchField="item_name"
              filters={[["disabled", "=", 0], ["is_stock_item", "=", 1]]}
              icon="pill"
            />
          </Field>
          <Field label="Issue from warehouse">
            <FrappeSearchPicker
              doctype="Warehouse"
              value={r.sourceWarehouse || null}
              onChange={(name) => update(r.id, { sourceWarehouse: name })}
              fields={["name", "warehouse_name"]}
              displayField="warehouse_name"
              searchField="warehouse_name"
              filters={[["disabled", "=", 0]]}
              icon="warehouse"
            />
          </Field>
          <FieldRow>
            <Field label="Qty" style={{ flex: 1 }}>
              <Input
                value={r.qty}
                onChangeText={(t) => update(r.id, { qty: t })}
                keyboardType="numeric"
                placeholder="1"
              />
            </Field>
            <Field label="UOM" style={{ flex: 1 }}>
              <Input value={r.uom} onChangeText={(t) => update(r.id, { uom: t })} placeholder="ECH" />
            </Field>
          </FieldRow>
          <Field label="Withdrawal days">
            <Input
              value={r.withdrawalDays}
              onChangeText={(t) => update(r.id, { withdrawalDays: t })}
              keyboardType="numeric"
              placeholder="0"
            />
          </Field>
          <Button label="Remove row" variant="link" onPress={() => remove(r.id)} />
        </View>
      ))}
      <Button label="Add drug" icon="plus" variant="outline" onPress={add} />
    </Field>
  );
}

const s = StyleSheet.create({
  drugBox: {
    backgroundColor: COLORS.bgMuted,
    padding: 11,
    borderRadius: RADIUS.md,
    marginBottom: 7,
  },
  drugEmpty: {
    color: COLORS.textSubtle,
    fontSize: 12,
    paddingVertical: 4,
  },
});
