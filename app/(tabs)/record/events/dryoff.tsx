import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { appAlert } from "@/src/ui/appAlert";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useAuthStore } from "@/src/auth/authStore";
import type { AnimalDrugIssueInput } from "@/src/frappe/animalEvent";
import { findStoreShortage } from "@/src/frappe/stock";
import { storeQtyKey, useStoreQtyMap } from "@/src/hooks/useStoreQty";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useHerds } from "@/src/hooks/useHerds";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

type DCTRow = {
  id: number;
  itemCode: string;
  qty: string;
  uom: string;
  sourceWarehouse: string;
  withdrawalDays: string;
};

export default function Dryoff() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);
  const { data: herds = [] } = useHerds();
  const { data: settings } = useLivestockSettings();
  const defaultDrugWarehouse = settings?.custom_drug_warehouse || "";

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [selected, setSelected] = useState<Animal[]>([]);
  const [toHerd, setToHerd] = useState<string>("");
  const [dctRows, setDctRows] = useState<DCTRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Default destination: a dry-flagged herd if one exists (per Livestock Settings).
  useEffect(() => {
    if (!toHerd && herds.length) {
      const dry = herds.find((h) => h.isDry);
      setToHerd(dry?.n ?? herds.find((h) => /steamer|dry/i.test(h.n))?.n ?? herds[0].n);
    }
  }, [herds, toHerd]);

  const addDct = () =>
    setDctRows((prev) => [
      ...prev,
      {
        id: Date.now() + prev.length,
        itemCode: "",
        qty: "1",
        uom: "",
        sourceWarehouse: defaultDrugWarehouse,
        withdrawalDays: "",
      },
    ]);
  const updateDct = (id: number, patch: Partial<DCTRow>) =>
    setDctRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeDct = (id: number) =>
    setDctRows((prev) => prev.filter((r) => r.id !== id));

  const mutation = useCreateAnimalEvent();

  // Live on-hand stock per DCT row, so the operator sees the store level.
  const availQuery = useStoreQtyMap(
    dctRows.map((r) => ({
      itemCode: r.itemCode.trim(),
      warehouse: r.sourceWarehouse || defaultDrugWarehouse,
    })),
  );

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (selected.length === 0) return setError("Pick at least one cow to dry off.");
    if (!toHerd) return setError("Pick a destination herd.");

    const drugIssues: AnimalDrugIssueInput[] = dctRows
      .filter((d) => d.itemCode.trim() && Number(d.qty) > 0)
      .map((d) => ({
        itemCode: d.itemCode.trim(),
        qty: Number(d.qty),
        uom: d.uom || undefined,
        sourceWarehouse: d.sourceWarehouse || defaultDrugWarehouse || undefined,
        withdrawalDays: d.withdrawalDays ? Number(d.withdrawalDays) : undefined,
      }));
    const missingWh = drugIssues.find((d) => !d.sourceWarehouse);
    if (missingWh) {
      return setError(
        "Pick a source warehouse on every DCT row (or set Drug warehouse in Livestock Settings).",
      );
    }

    // Block over-issue before creating the Material Issue.
    const shortage = await findStoreShortage(
      drugIssues.map((d) => ({
        itemCode: d.itemCode,
        warehouse: d.sourceWarehouse as string,
        qtyNeeded: d.qty,
      })),
    );
    if (shortage) return setError(shortage);

    if (operator !== defaultOperator) await setStoredOperator(operator);

    let succeeded = 0;
    let queued = 0;
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          eventType: "Drying Off",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          eventDate: todayISO(),
          toHerd,
          drugIssues: drugIssues.length ? drugIssues : undefined,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
      } catch (err) {
        setError(
          `${succeeded} of ${selected.length} dried off. Stopped at ${a.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }
    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} moved to ${toHerd}`);
    if (queued) parts.push(`${queued} queued (offline)`);
    appAlert("Drying off recorded", parts.join(" · "));
    router.replace("/(tabs)/record/success?name=Drying off");
  };

  return (
    <Screen title="Drying off" subtitle="From a milking herd" back>
      <Banner tone="info">
        The destination herd defaults to the dry / steamers herd; you can override below. Add DCT
        drugs to apply the same treatment to every selected cow.
      </Banner>

      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>

      <Field label="Cow(s) to dry off">
        <AnimalPickerButton
          mode="multi"
          title="Select cows (lactating only)"
          placeholder="Search lactating cows..."
          include={(a) => /lactating|fresh/i.test(a.repro)}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <Field label="To herd">
        <Picker value={toHerd} onChange={setToHerd} options={herds.map((h) => h.n)} />
      </Field>
      <Field label="Date"><Input value={todayISO()} editable={false} /></Field>

      <Field
        label="DCT drugs (applied to every selected cow)"
        help={
          defaultDrugWarehouse
            ? `Each row issues stock and posts a vet expense JE per cow. Source warehouse defaults to ${defaultDrugWarehouse}.`
            : "Each row issues stock and posts a vet expense JE per cow. Pick a source warehouse per row."
        }
      >
        {dctRows.length === 0 ? (
          <Text style={s.empty}>No DCT drugs. Tap “Add drug” if you administered any.</Text>
        ) : null}
        {dctRows.map((r) => (
          <View key={r.id} style={s.row}>
            <Field label="Item">
              <FrappeSearchPicker
                doctype="Item"
                value={r.itemCode || null}
                onChange={(name, row) =>
                  updateDct(r.id, { itemCode: name, uom: row?.stock_uom || "" })
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
                onChange={(name) => updateDct(r.id, { sourceWarehouse: name })}
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
                  onChangeText={(t) => updateDct(r.id, { qty: t })}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </Field>
              <Field label="UOM" style={{ flex: 1 }}>
                <Input value={r.uom} editable={false} placeholder="—" />
              </Field>
            </FieldRow>
            {r.itemCode.trim() && (r.sourceWarehouse || defaultDrugWarehouse)
              ? (() => {
                  const wh = r.sourceWarehouse || defaultDrugWarehouse;
                  const avail = availQuery.data?.[storeQtyKey(r.itemCode.trim(), wh)];
                  const short = avail != null && Number(r.qty) > avail;
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
                        : `Available in ${wh}: ${avail}${r.uom ? " " + r.uom : ""}${short ? " — not enough" : ""}`}
                    </Text>
                  );
                })()
              : null}
            <Field label="Withdrawal days">
              <Input
                value={r.withdrawalDays}
                onChangeText={(t) => updateDct(r.id, { withdrawalDays: t })}
                keyboardType="numeric"
                placeholder="0"
              />
            </Field>
            <Button label="Remove row" variant="link" onPress={() => removeDct(r.id)} />
          </View>
        ))}
        <Button label="Add drug" icon="plus" variant="outline" onPress={addDct} />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit dry-off"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    row: {
      backgroundColor: c.bgMuted,
      padding: 11,
      borderRadius: RADIUS.md,
      marginBottom: 7,
    },
    empty: {
      color: c.textSubtle,
      fontSize: 12,
      paddingVertical: 4,
    },
  });
