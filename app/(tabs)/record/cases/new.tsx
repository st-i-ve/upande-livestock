import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { appAlert } from "@/src/ui/appAlert";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useAuthStore } from "@/src/auth/authStore";
import type {
  CaseSeverity,
  HealthTreatmentInput,
} from "@/src/frappe/animalHealthCase";
import { getItemSnapshot } from "@/src/frappe/item";
import { findStoreShortage } from "@/src/frappe/stock";
import { storeQtyKey, useStoreQtyMap } from "@/src/hooks/useStoreQty";
import { useCreateAnimalHealthCase } from "@/src/hooks/mutations";
import { useDefaultCompany } from "@/src/hooks/useDefaultCompany";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

const SEVERITIES: CaseSeverity[] = ["Mild", "Moderate", "Severe", "Critical"];

type TreatmentRow = {
  id: number;
  itemCode: string;
  itemName: string;
  qty: string;
  uom: string;
  rate: string;
  rateSource: "last_purchase" | "valuation" | "none" | "manual" | "";
  sourceWarehouse: string;
  withdrawalDays: string;
  description: string;
};

export default function CaseNew() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);
  const { data: company } = useDefaultCompany();
  const { data: settings } = useLivestockSettings();
  const defaultDrugWarehouse = settings?.custom_drug_warehouse || "";

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [selected, setSelected] = useState<Animal[]>([]);
  const [condition, setCondition] = useState("");
  const [severity, setSeverity] = useState<CaseSeverity>("Moderate");
  const [notes, setNotes] = useState("");
  const [treatments, setTreatments] = useState<TreatmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalHealthCase();

  // Sum cost for the form summary tile.
  const totalCost = useMemo(
    () =>
      treatments.reduce((acc, t) => {
        const q = Number(t.qty) || 0;
        const r = Number(t.rate) || 0;
        return acc + q * r;
      }, 0),
    [treatments],
  );

  // Live on-hand stock per treatment row, so the operator sees the store level.
  const availQuery = useStoreQtyMap(
    treatments.map((t) => ({
      itemCode: t.itemCode,
      warehouse: t.sourceWarehouse || defaultDrugWarehouse,
    })),
  );

  const addTreatment = () =>
    setTreatments((prev) => [
      ...prev,
      {
        id: Date.now() + prev.length,
        itemCode: "",
        itemName: "",
        qty: "1",
        uom: "",
        rate: "",
        rateSource: "",
        sourceWarehouse: defaultDrugWarehouse,
        withdrawalDays: "",
        description: "",
      },
    ]);

  const updateTreatment = (id: number, patch: Partial<TreatmentRow>) =>
    setTreatments((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeTreatment = (id: number) =>
    setTreatments((prev) => prev.filter((r) => r.id !== id));

  // When the user picks an Item, look up its name + UOM + last_purchase_rate
  // (falling back to valuation_rate). Operator can still override the rate.
  const handlePickItem = async (id: number, itemCode: string) => {
    updateTreatment(id, { itemCode });
    try {
      const snap = await getItemSnapshot(itemCode);
      if (snap) {
        updateTreatment(id, {
          itemName: snap.itemName,
          uom: snap.stockUom,
          rate: snap.rate ? String(snap.rate) : "",
          rateSource: snap.rateSource,
        });
      }
    } catch (e) {
      console.warn("[case] Item snapshot lookup failed", e);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (selected.length === 0) return setError("Pick at least one animal.");
    if (!company) return setError("Default company not loaded yet. Try again in a moment.");
    if (!condition.trim() && !notes.trim()) {
      return setError("Describe the condition or symptoms before opening a case.");
    }

    // Validate any treatment rows the user actually filled in.
    const builtTreatments: HealthTreatmentInput[] = [];
    for (const t of treatments) {
      if (!t.itemCode && !t.qty && !t.description) continue; // empty row, skip
      if (!t.itemCode) return setError("Pick an item on every treatment row (or remove the row).");
      const qty = Number(t.qty) || 0;
      if (qty <= 0) return setError(`Treatment ${t.itemName || t.itemCode}: enter a quantity > 0.`);
      if (!t.sourceWarehouse) {
        return setError(
          `Treatment ${t.itemName || t.itemCode}: pick a source warehouse (or set Drug warehouse in Livestock Settings for a default).`,
        );
      }
      builtTreatments.push({
        itemCode: t.itemCode,
        itemName: t.itemName || undefined,
        qty,
        uom: t.uom || undefined,
        rate: Number(t.rate) || 0,
        sourceWarehouse: t.sourceWarehouse,
        withdrawalDays: t.withdrawalDays ? Number(t.withdrawalDays) : undefined,
        description: t.description.trim() || undefined,
        administeredBy: operator,
        treatmentDate: todayISO(),
      });
    }

    // Block over-issue: every treatment row issues stock on submit.
    const shortage = await findStoreShortage(
      builtTreatments.map((t) => ({
        itemCode: t.itemCode,
        warehouse: t.sourceWarehouse,
        qtyNeeded: t.qty,
        label: t.itemName,
      })),
    );
    if (shortage) return setError(shortage);

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
          treatments: builtTreatments.length ? builtTreatments : undefined,
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
    appAlert(
      "Health cases opened",
      `${parts.join(" · ")}${builtTreatments.length ? `\n${builtTreatments.length} treatment${builtTreatments.length === 1 ? "" : "s"} per case.` : ""}`,
    );
    router.replace("/(tabs)/record/success?name=Health case");
  };

  return (
    <Screen title="New health case" subtitle="Opens cases in the action queue" back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field label="Animal(s)" help="One or many — same condition opens a case per animal.">
        <AnimalPickerButton
          mode="multi"
          title="Select animals"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search by tag or name…"}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <Field label="Date"><Input value={todayISO()} editable={false} /></Field>
      <Field label="Condition">
        <Input value={condition} onChangeText={setCondition} placeholder="Mastitis, lameness, ..." />
      </Field>
      <Field label="Severity">
        <Picker value={severity} onChange={(v) => setSeverity(v as CaseSeverity)} options={SEVERITIES} />
      </Field>
      <Field label="Presenting symptoms / notes">
        <Textarea value={notes} onChangeText={setNotes} placeholder="Observations, treatment plan, ..." />
      </Field>

      <SectionTitle>Treatment log</SectionTitle>
      <Banner tone="info">
        Each treatment row issues stock and contributes to the case's total cost. Rate is auto-picked
        from the item's last purchase price (fallback: valuation rate); override per row if needed.
      </Banner>
      {treatments.length === 0 ? (
        <Text style={s.empty}>No treatments yet. Tap “Add treatment” to log drugs administered.</Text>
      ) : null}
      {treatments.map((t) => {
        const qty = Number(t.qty) || 0;
        const rate = Number(t.rate) || 0;
        return (
          <View key={t.id} style={s.txBox}>
            <Field label="Item">
              <FrappeSearchPicker
                doctype="Item"
                value={t.itemCode || null}
                onChange={(name) => handlePickItem(t.id, name)}
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
                value={t.sourceWarehouse || null}
                onChange={(name) => updateTreatment(t.id, { sourceWarehouse: name })}
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
                  value={t.qty}
                  onChangeText={(v) => updateTreatment(t.id, { qty: v })}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </Field>
              <Field label="UOM" style={{ flex: 1 }}>
                <Input value={t.uom} editable={false} placeholder="—" />
              </Field>
            </FieldRow>
            {t.itemCode && (t.sourceWarehouse || defaultDrugWarehouse)
              ? (() => {
                  const wh = t.sourceWarehouse || defaultDrugWarehouse;
                  const avail = availQuery.data?.[storeQtyKey(t.itemCode, wh)];
                  const short = avail != null && Number(t.qty) > avail;
                  return (
                    <Text
                      style={{
                        fontSize: 11,
                        marginBottom: 8,
                        color: short ? c.danger : c.textMuted,
                      }}
                    >
                      {availQuery.isLoading || avail == null
                        ? `Checking stock in ${wh}…`
                        : `Available in ${wh}: ${avail}${t.uom ? " " + t.uom : ""}${short ? " — not enough" : ""}`}
                    </Text>
                  );
                })()
              : null}
            <FieldRow>
              <Field
                label="Rate (KES)"
                help={
                  t.rateSource === "last_purchase"
                    ? "Last purchase price"
                    : t.rateSource === "valuation"
                      ? "Current valuation rate (no purchase history)"
                      : t.rateSource === "manual"
                        ? "Manual override"
                        : t.rateSource === "none"
                          ? "No rate on the item — enter manually"
                          : ""
                }
                style={{ flex: 1 }}
              >
                <Input
                  value={t.rate}
                  onChangeText={(v) =>
                    updateTreatment(t.id, { rate: v, rateSource: "manual" })
                  }
                  keyboardType="numeric"
                  placeholder="0"
                />
              </Field>
              <Field label="Amount (KES)" style={{ flex: 1 }}>
                <Input
                  value={(qty * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  editable={false}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Withdrawal days" style={{ flex: 1 }}>
                <Input
                  value={t.withdrawalDays}
                  onChangeText={(v) => updateTreatment(t.id, { withdrawalDays: v })}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </Field>
            </FieldRow>
            <Field label="Description / dosage">
              <Input
                value={t.description}
                onChangeText={(v) => updateTreatment(t.id, { description: v })}
                placeholder="e.g. Procaine Penicillin 20 ml IM"
              />
            </Field>
            <Button label="Remove treatment" variant="link" onPress={() => removeTreatment(t.id)} />
          </View>
        );
      })}
      <Button label="Add treatment" icon="plus" variant="outline" onPress={addTreatment} />

      {treatments.length > 0 ? (
        <View style={s.summary}>
          <Text style={s.summaryLabel}>Total treatment cost (per case)</Text>
          <Text style={s.summaryValue}>
            {totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} KES
          </Text>
        </View>
      ) : null}

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

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    empty: {
      color: c.textSubtle,
      fontSize: 12,
      paddingVertical: 6,
    },
    txBox: {
      backgroundColor: c.bgMuted,
      padding: 11,
      borderRadius: RADIUS.md,
      marginBottom: 8,
    },
    summary: {
      backgroundColor: c.bgMuted,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      marginTop: 4,
      marginBottom: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: FONT_FAMILY.medium,
    },
    summaryValue: {
      fontSize: 14,
      color: c.text,
      fontFamily: FONT_FAMILY.semibold,
      fontVariant: ["tabular-nums"],
    },
  });
