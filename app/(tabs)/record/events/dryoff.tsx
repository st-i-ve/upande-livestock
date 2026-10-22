import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Button } from "@/components/Button";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { VetPicker } from "@/components/VetPicker";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useOperator } from "@/src/hooks/useOperator";
import { useVetChoice } from "@/src/hooks/useVets";
import type { AnimalDrugIssueInput } from "@/src/frappe/animalEvent";
import { AvailableStockButton } from "@/components/AvailableStockButton";
import { StockItemFields } from "@/components/StockItemFields";
import { findShortage, stockOutcomeText, stockWarningsOf } from "@/src/frappe/eventItems";
import { useEventItems } from "@/src/hooks/useEventItems";
import { usePullToRefresh, useRefreshOnFocus } from "@/src/hooks/useServerLists";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useHerds } from "@/src/hooks/useHerds";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";
import { titleFor, useFinishRecording, usePresetAnimal, useSeedAnimal } from "@/src/hooks/useRecordContext";

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
  const { data: herds = [] } = useHerds();
  // Drugs only where Drying Off posts stock, as the server's rule says.
  const { choices: stockChoices, consumes } = useEventItems("Drying Off");
  const { refreshing, onRefresh } = usePullToRefresh();
  useRefreshOnFocus();

  const { operator, missingMessage } = useOperator();
  const { vets, vet, setVet } = useVetChoice();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  const offline = useOffline();
  const [selected, setSelected] = useState<Animal[]>([]);
  const preset = usePresetAnimal();
  useSeedAnimal(preset, selected, (a) => setSelected([a]));
  const finish = useFinishRecording();
  const [toHerdPick, setToHerd] = useState<string>("");
  const dryHerd = herds.find((h) => h.isDry)?.n ?? herds.find((h) => /steamer|dry/i.test(h.n))?.n ?? herds[0]?.n ?? "";
  const toHerd = toHerdPick || dryHerd;
  const [dctRows, setDctRows] = useState<DCTRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Default destination: a dry-flagged herd if one exists (per Livestock Settings).
  const addDct = () =>
    setDctRows((prev) => [
      ...prev,
      {
        id: Date.now() + prev.length,
        itemCode: "",
        qty: "1",
        uom: "",
        sourceWarehouse: "",
        withdrawalDays: "",
      },
    ]);
  const updateDct = (id: number, patch: Partial<DCTRow>) =>
    setDctRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeDct = (id: number) =>
    setDctRows((prev) => prev.filter((r) => r.id !== id));

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    setWarning(null);
    if (!operator) return setError(missingMessage);
    if (selected.length === 0) return setError("Pick at least one cow to dry off.");
    if (!toHerd) return setError("Pick a destination herd.");

    const drugIssues: AnimalDrugIssueInput[] = (consumes ? dctRows : [])
      .filter((d) => d.itemCode.trim() && Number(d.qty) > 0)
      .map((d) => ({
        itemCode: d.itemCode.trim(),
        qty: Number(d.qty),
        uom: d.uom || undefined,
        sourceWarehouse: d.sourceWarehouse || undefined,
        withdrawalDays: d.withdrawalDays ? Number(d.withdrawalDays) : undefined,
      }));
    // Heads-up only. The server saves a short issue as a draft (today) or
    // refuses it with its own message (backdated); the phone never blocks.
    const shortage = await findShortage(
      stockChoices,
      drugIssues.map((d) => ({
        itemCode: d.itemCode,
        warehouse: d.sourceWarehouse as string,
        qtyNeeded: d.qty * selected.length,
      })),
    );
    if (shortage) setWarning(shortage);


    let succeeded = 0;
    const replies: any[] = [];
    // A cow the server refuses is skipped with its reason; the others still dry off.
    const skipped: { name: string; reason: string }[] = [];
    for (const a of selected) {
      try {
        const r = await mutation.mutateAsync({
          eventType: "Drying Off",
          animal: a.id,
          currentHerd: a.herd,
          operator,
          vet: vet || undefined,
          eventDate: isBackdating ? backdateDate : serverToday,
          toHerd,
          drugIssues: drugIssues.length ? drugIssues : undefined,
        });
        succeeded += 1;
        replies.push(r);
      } catch (err) {
        skipped.push({ name: a.name, reason: extractFrappeError(err) });
      }
    }
    if (succeeded === 0) {
      setError(`Nothing was recorded.\n${skipped.map((k) => `${k.name}: ${k.reason}`).join("\n")}`);
      return;
    }
    const parts: string[] = [];
    parts.push(`Recorded ${succeeded} · Skipped ${skipped.length}${succeeded ? ` (moved to ${toHerd})` : ""}`);
    for (const k of skipped) parts.push(`${k.name}: ${k.reason}`);
    const stockNote = stockOutcomeText(replies);
    Alert.alert(
      stockNote ? "Drying off saved — stock issue pending" : "Drying off recorded",
      [parts.join("\n"), stockNote, ...stockWarningsOf(replies)].filter(Boolean).join("\n\n"),
    );
    finish("Drying off");
  };

  return (
    <Screen
      title={titleFor("Drying off", preset)}
      subtitle="From a milking herd"
      back
      onRefresh={onRefresh}
      refreshing={refreshing}
      headerRight={isBackdating ? undefined : <BackdateButton type="dryoff" />}
    >
      {isBackdating ? <BackdateBanner /> : null}
      <Banner tone="info">
        The destination herd defaults to the dry / steamers herd; you can override below. Add DCT
        drugs to apply the same treatment to every selected cow.
      </Banner>


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
      <VetPicker vets={vets} value={vet} onChange={setVet} />
      {isBackdating ? (
        <Field label="Date it happened">
          <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={fromISODate(serverToday)} />
        </Field>
      ) : (
        <Field label="Date"><Input value={serverToday} editable={false} /></Field>
      )}

      {consumes ? (
        <>
          <AvailableStockButton eventType="Drying Off" />
      <Field
        label="DCT drugs (applied to every selected cow)"
        help="Each row issues stock for every selected cow; the server posts it. Picking an item picks the store that holds it; change it if another has stock."
      >
        {dctRows.length === 0 ? (
          <Text style={s.empty}>No DCT drugs. Tap “Add drug” if you administered any.</Text>
        ) : null}
        {dctRows.map((r) => (
          <View key={r.id} style={s.row}>
            <StockItemFields
              choices={stockChoices}
              value={{ itemCode: r.itemCode, uom: r.uom, warehouse: r.sourceWarehouse }}
              onChange={(v) =>
                updateDct(r.id, { itemCode: v.itemCode, uom: v.uom, sourceWarehouse: v.warehouse })
              }
              qtyNeeded={Number(r.qty) * Math.max(selected.length, 1)}
            />
            <FieldRow>
              <Field label="Qty per cow" style={{ flex: 1 }}>
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
            <Text style={s.total}>
              {selected.length > 0 && Number(r.qty) > 0
                ? `${r.qty} × ${selected.length} cow${selected.length === 1 ? "" : "s"} = ${Math.round(Number(r.qty) * selected.length * 1000) / 1000}${r.uom ? ` ${r.uom}` : ""}`
                : "Pick cows to see the total"}
            </Text>
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
        </>
      ) : null}

      {warning ? <Banner tone="warning">{warning} It will still be saved; the store issue waits as a draft.</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <OnlineOnlyNotice />
      <Button
        label={mutation.isPending ? "Submitting…" : "Submit dry-off"}
        disabled={offline || mutation.isPending || selected.length === 0}
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
    total: {
      color: c.textMuted,
      fontSize: 12,
      marginBottom: 8,
    },
    empty: {
      color: c.textSubtle,
      fontSize: 12,
      paddingVertical: 4,
    },
  });
