import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { HandlersPicker } from "@/components/HandlersPicker";
import { KV } from "@/components/KV";
import { Screen } from "@/components/Screen";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useOperator } from "@/src/hooks/useOperator";
import {
  AnimalEventInput,
  AnimalEventType,
} from "@/src/frappe/animalEvent";
import { BatchDrugRow } from "@/src/frappe/batchDrugIssue";
import { findStoreShortage, getItemValuationRate } from "@/src/frappe/stock";
import { useBatchDrugIssue, useCreateAnimalEvent } from "@/src/hooks/mutations";
import { storeQtyKey, useStoreQtyMap } from "@/src/hooks/useStoreQty";
import { useDefaultCompany } from "@/src/hooks/useDefaultCompany";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

type Spec = {
  title: string;
  eventType: AnimalEventType;
  needsWeight?: boolean;
  needsDrugs?: boolean;
  needsActivityCost?: boolean;
  needsMethod?: boolean;
  needsFeet?: boolean;
  needsHeatSigns?: boolean;
  /** Vet-procedure screens hide the Operator picker, show a Vet text field instead. */
  isVetProcedure?: boolean;
  /** Dehorning also collects Handlers. */
  needsHandlers?: boolean;
};

const SPECS: Record<string, Spec> = {
  weight:      { title: "Weight recording",  eventType: "Weight Recording",  needsWeight: true },
  vaccination: { title: "Vaccination",       eventType: "Vaccination",       needsDrugs: true, needsActivityCost: true, isVetProcedure: true },
  deworming:   { title: "Deworming",         eventType: "Deworming",         needsDrugs: true, needsActivityCost: true, isVetProcedure: true },
  dehorning:   { title: "Dehorning",         eventType: "Dehorning",         needsMethod: true, needsActivityCost: true, isVetProcedure: true, needsHandlers: true },
  hoof:        { title: "Hoof trimming",     eventType: "Hoof Trimming",     needsFeet: true, needsActivityCost: true, isVetProcedure: true },
  heat:        { title: "Heat detection",    eventType: "Heat Detection",    needsHeatSigns: true },
};

export default function GenericEvent() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { type } = useLocalSearchParams<{ type: string }>();
  const spec = SPECS[type || ""];


  const { operator, missingMessage } = useOperator();
  const [vetName, setVetName] = useState("");
  const [handlerIds, setHandlerIds] = useState<string[]>([]);
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
  const { data: company } = useDefaultCompany();
  const defaultDrugWarehouse = settings?.drug_warehouse || "";

  const eventMutation = useCreateAnimalEvent();
  const batchMutation = useBatchDrugIssue();

  const submitting = eventMutation.isPending || batchMutation.isPending;

  if (!spec) {
    return (
      <Screen title="Unknown event" back>
        <Banner tone="warning">No form configured for &quot;{type}&quot;.</Banner>
      </Screen>
    );
  }

  const filledDrugRows = useMemo(
    () => drugs.filter((d) => d.itemCode.trim() && Number(d.qty) > 0),
    [drugs],
  );

  // FIFO cost preview — valuation rate per drug × qty, so the operator sees
  // what the vaccination/deworming will cost before submitting.
  const drugCostQuery = useQuery({
    queryKey: [
      "drugCost",
      filledDrugRows
        .map((d) => `${d.itemCode.trim()}@${d.sourceWarehouse || defaultDrugWarehouse}:${d.qty}`)
        .join("|"),
      // Per-animal rows x headcount: without this the cached total survives a
      // change in the selection and quotes the wrong figure.
      selected.length,
    ],
    enabled: !!spec?.needsDrugs && filledDrugRows.length > 0,
    queryFn: async () => {
      let total = 0;
      for (const d of filledDrugRows) {
        const rate = await getItemValuationRate(
          d.itemCode.trim(),
          d.sourceWarehouse || defaultDrugWarehouse,
        );
        total += rate * Number(d.qty) * selected.length;
      }
      return total;
    },
  });

  const handleSubmit = async () => {
    setError(null);

    // ----- validation --------------------------------------------------------
    if (selected.length === 0) return setError("Pick at least one animal.");

    if (spec.isVetProcedure) {
      if (!vetName.trim()) return setError("Enter the vet's name.");
      if (!operator) return setError(missingMessage);
      if (!company) return setError("Default company not loaded yet. Try again in a moment.");
    } else {
      if (!operator) return setError(missingMessage);
    }

    if (spec.needsWeight) {
      if (!weight) return setError("Enter the weight (kg).");
      if (selected.length > 1) {
        return setError("Weight recording takes one animal at a time. Unselect the others.");
      }
    }

    if (spec.needsDrugs && filledDrugRows.length > 0) {
      const missing = filledDrugRows.find((d) => !d.sourceWarehouse);
      if (missing) {
        return setError(
          "Pick a source warehouse on every drug row (or set Drug warehouse in Livestock Settings to apply a default).",
        );
      }
      // Block over-issue before anything is recorded. The rows are per animal,
      // so what actually leaves the store is qty x headcount — checking the
      // per-animal figure would wave through a round 20x the shelf.
      const shortage = await findStoreShortage(
        filledDrugRows.map((d) => ({
          itemCode: d.itemCode.trim(),
          warehouse: d.sourceWarehouse || defaultDrugWarehouse,
          qtyNeeded: Number(d.qty) * selected.length,
        })),
      );
      if (shortage) return setError(shortage);
    }


    // ----- compose per-cow events -------------------------------------------
    const remarksBits: string[] = [];
    if (spec.needsMethod) remarksBits.push(`Method: ${method}`);
    if (spec.needsFeet) remarksBits.push(`Feet: ${feet}`);
    if (spec.needsHeatSigns && heatSigns) remarksBits.push(`Heat signs: ${heatSigns}`);
    if (remarks) remarksBits.push(remarks);
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const baseRemarks = [remarksBits.join(" · ") || null, `Batch ${batchId}`]
      .filter(Boolean)
      .join(" · ");

    // ----- submit ------------------------------------------------------------
    // Husbandry rounds go over in ONE call. create_husbandry_event books an
    // event per animal and posts a single drug issue for the batch, stamped
    // with the named Stock Entry Type — "Vaccination", "Deworming" — instead of
    // the bare "Material Issue" this screen used to build client-side. Drug
    // quantities below are therefore PER ANIMAL; the server multiplies them.
    // A narrowed value rather than a boolean, so the payload below is typed as
    // the husbandry variant of AnimalEventInput.
    const husbandryType =
      spec.eventType === "Vaccination" ||
      spec.eventType === "Deworming" ||
      spec.eventType === "Hoof Trimming" ||
      spec.eventType === "Dehorning"
        ? spec.eventType
        : null;

    const eventNames: string[] = [];
    let succeededEvents = 0;
    let queuedEvents = 0;

    if (husbandryType) {
      try {
        const r = await eventMutation.mutateAsync({
          eventType: husbandryType,
          animal: selected[0].id,
          animals: selected.map((a) => a.id),
          currentHerd: selected[0].herd,
          operator: operator!,
          eventDate: todayISO(),
          remarks: baseRemarks,
          vetName: vetName.trim(),
          handlerIds: handlerIds.length ? handlerIds : undefined,
          drugIssues: filledDrugRows.map((d) => ({
            itemCode: d.itemCode.trim(),
            qty: Number(d.qty),
            uom: d.uom || undefined,
            sourceWarehouse: d.sourceWarehouse || defaultDrugWarehouse,
            withdrawalDays: d.withdrawalDays ? Number(d.withdrawalDays) : undefined,
          })),
          sourceWarehouse: defaultDrugWarehouse || undefined,
        });
        if (r.queued) queuedEvents = selected.length;
        else {
          succeededEvents = r.data?.animals ?? selected.length;
          if (r.data?.names?.length) eventNames.push(...r.data.names);
        }
      } catch (err) {
        setError(`Nothing was recorded. ${extractFrappeError(err)}`);
        return;
      }
    } else {
      for (const a of selected) {
        const common = {
          animal: a.id,
          currentHerd: a.herd,
          operator: operator!, // checked above
          eventDate: todayISO(),
          remarks: baseRemarks,
        } as const;

        const payload: AnimalEventInput = (() => {
          switch (spec.eventType) {
            case "Weight Recording":
              return {
                ...common,
                eventType: "Weight Recording",
                weightKg: Number(weight),
                bcs: bcs ? Number(bcs) : undefined,
              };
            case "Heat Detection":
              return { ...common, eventType: "Heat Detection" };
            default:
              throw new Error(`Unhandled event type ${spec.eventType}`);
          }
        })();

        try {
          const r = await eventMutation.mutateAsync(payload);
          if (r.queued) queuedEvents += 1;
          else {
            succeededEvents += 1;
            if (r.data?.name) eventNames.push(r.data.name);
          }
        } catch (err) {
          setError(
            `${succeededEvents + queuedEvents} of ${selected.length} submitted. Stopped at ${a.name}: ${extractFrappeError(err)}`,
          );
          return;
        }
      }
    }

    // ----- vet fee -----------------------------------------------------------
    // The drug issue is the server's job now; only the vet fee is left here,
    // because Livestock Event has no column for it and it posts as its own
    // Journal Entry. drugRows is deliberately empty.
    let batchOutcome: "ok" | "skipped" | "failed" = "skipped";
    let batchError = "";

    if (spec.isVetProcedure && activityCost && Number(activityCost) > 0 && company) {
      try {
        await batchMutation.mutateAsync({
          drugRows: [],
          activityCost: Number(activityCost),
          eventNames,
          batchId,
          remarks: `${spec.title} · ${selected.length} animals · ${todayISO()}`,
          company,
          employee: operator || undefined,
        });
        batchOutcome = "ok";
      } catch (err) {
        batchOutcome = "failed";
        batchError = extractFrappeError(err);
      }
    }

    // ----- success / partial messaging --------------------------------------
    const eventParts: string[] = [];
    if (succeededEvents) eventParts.push(`${succeededEvents} submitted`);
    if (queuedEvents) eventParts.push(`${queuedEvents} queued (offline)`);

    if (batchOutcome === "failed") {
      Alert.alert(
        `${spec.title} — partial`,
        `${eventParts.join(" · ") || "Events recorded"}, and the drugs were issued, but the vet fee did not post: ${batchError}\n\nEnter the fee as a Journal Entry from desktop.`,
      );
    } else {
      const extra = batchOutcome === "ok" ? "\nVet fee posted." : "";
      Alert.alert(`${spec.title} recorded`, `${eventParts.join(" · ")}${extra}`);
    }
    router.replace(`/(tabs)/record/success?name=${encodeURIComponent(spec.title)}`);
  };

  return (
    <Screen title={spec.title} subtitle="New event" back>
      {spec.isVetProcedure ? (
        <Field label="Vet" help="Free-text — the vet who performed the procedure.">
          <Input value={vetName} onChangeText={setVetName} placeholder="Dr. Mwangi" />
        </Field>
      ) : null}

      <Field
        label={spec.needsWeight ? "Animal" : "Animal(s)"}
        help={
          spec.needsWeight
            ? "Pick one animal — weight is per-animal."
            : spec.isVetProcedure
              ? "Pick one cow, several, or a whole herd. Drug quantities below are per animal."
              : "Pick one cow, several, or a whole herd. Same details applied per animal."
        }
      >
        {spec.needsWeight ? (
          <AnimalPickerButton
            mode="single"
            placeholder={selected[0] ? `${selected[0].name} · ${selected[0].id}` : "Search by tag or name…"}
            value={selected[0] ?? null}
            onPickSingle={(a) => setSelected([a])}
          />
        ) : (
          <AnimalPickerButton
            mode="multi"
            placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search by tag or name…"}
            value={selected}
            onPickMulti={setSelected}
          />
        )}
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

      {spec.needsHandlers ? (
        <Field label="Handlers" help="Farmhands assisting the vet.">
          <HandlersPicker value={handlerIds} onChange={setHandlerIds} />
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
        <Field label="Activity cost (KES)" help="Total vet fee for the batch.">
          <Input
            value={activityCost}
            onChangeText={setActivityCost}
            keyboardType="numeric"
            placeholder="0"
          />
        </Field>
      ) : null}

      {spec.isVetProcedure && (filledDrugRows.length > 0 || (activityCost && Number(activityCost) > 0)) ? (
        <View style={s.summary}>
          <KV
            k="Stock Entry"
            v={
              filledDrugRows.length > 0
                ? `1 ${spec.eventType} issue for ${selected.length || "—"} animals`
                : "—"
            }
          />
          <KV
            k="Est. drug cost (FIFO)"
            v={
              filledDrugRows.length === 0
                ? "—"
                : drugCostQuery.isLoading
                  ? "…"
                  : `KES ${Math.round(drugCostQuery.data ?? 0).toLocaleString()}`
            }
          />
          <KV
            k="Vet Expense JE"
            v={activityCost && Number(activityCost) > 0 ? `1 entry · KES ${Number(activityCost).toLocaleString()}` : "—"}
          />
        </View>
      ) : null}

      <Field label="Remarks">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Optional notes" />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={submitting ? "Submitting…" : `Submit ${spec.title.toLowerCase()}`}
        disabled={submitting || selected.length === 0}
        loading={submitting}
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
  defaultWarehouse: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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

  // Live on-hand stock per row, so the operator sees what's in the store.
  const availQuery = useStoreQtyMap(
    rows.map((r) => ({
      itemCode: r.itemCode.trim(),
      warehouse: r.sourceWarehouse || defaultWarehouse,
    })),
  );

  return (
    <Field
      label="Drugs / vaccines (optional)"
      help={
        defaultWarehouse
          ? `Quantities are per animal — 2 ml a cow across 20 cows leaves the store as one 40 ml line. Source warehouse defaults to ${defaultWarehouse}.`
          : "Quantities are per animal. Pick a source warehouse for each row — set a default via Livestock Settings → Drug warehouse."
      }
    >
      {rows.length === 0 ? (
        <Text style={s.drugEmpty}>No drug rows. Tap "Add drug" if any drug was used.</Text>
      ) : null}
      {rows.map((r) => (
        <View key={r.id} style={s.drugBox}>
          <Field label="Item">
            <FrappeSearchPicker
              doctype="Item"
              value={r.itemCode || null}
              onChange={(name, row) =>
                update(r.id, { itemCode: name, uom: row?.stock_uom || "" })
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
            <Field label="Qty per animal" style={{ flex: 1 }}>
              <Input
                value={r.qty}
                onChangeText={(t) => update(r.id, { qty: t })}
                keyboardType="numeric"
                placeholder="1"
              />
            </Field>
            <Field label="UOM" style={{ flex: 1 }}>
              <Input value={r.uom} editable={false} placeholder="—" />
            </Field>
          </FieldRow>
          {r.itemCode.trim() && (r.sourceWarehouse || defaultWarehouse)
            ? (() => {
                const wh = r.sourceWarehouse || defaultWarehouse;
                const avail = availQuery.data?.[storeQtyKey(r.itemCode.trim(), wh)];
                const short = avail != null && Number(r.qty) > avail;
                return (
                  <Text
                    style={{
                      fontSize: 11,
                      marginTop: -4,
                      marginBottom: 8,
                      color: short ? c.danger : c.textMuted,
                    }}
                  >
                    {availQuery.isLoading || avail == null
                      ? `Checking stock in ${wh}…`
                      : `Available in ${wh}: ${avail}${r.uom ? " " + r.uom : ""}${short ? " — not enough" : ""}`}
                  </Text>
                );
              })()
            : null}
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

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    drugBox: {
      backgroundColor: c.bgMuted,
      padding: 11,
      borderRadius: RADIUS.md,
      marginBottom: 7,
    },
    drugEmpty: {
      color: c.textSubtle,
      fontSize: 12,
      paddingVertical: 4,
    },
    summary: {
      backgroundColor: c.bgMuted,
      padding: 11,
      borderRadius: RADIUS.md,
      marginBottom: 10,
      gap: 4,
    },
  });
