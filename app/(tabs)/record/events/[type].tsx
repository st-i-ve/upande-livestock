import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Button } from "@/components/Button";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { VetPicker } from "@/components/VetPicker";
import { AvailableStockButton } from "@/components/AvailableStockButton";
import { StockItemFields } from "@/components/StockItemFields";
import { RADIUS } from "@/constants/theme";
import {
  AnimalEventInput,
  AnimalEventType,
  previewRound,
  type SkippedAnimal,
} from "@/src/frappe/animalEvent";
import { findShortage, stockOutcomeText, stockWarningsOf, type StockChoice } from "@/src/frappe/eventItems";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useColors } from "@/src/hooks/useColors";
import { useEventItems } from "@/src/hooks/useEventItems";
import { useOperator } from "@/src/hooks/useOperator";
import { usePullToRefresh, useRefreshOnFocus } from "@/src/hooks/useServerLists";
import { titleFor, useFinishRecording, usePresetAnimal, useSeedAnimal } from "@/src/hooks/useRecordContext";
import { useVetChoice } from "@/src/hooks/useVets";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";

type Spec = {
  title: string;
  eventType: AnimalEventType;
  /** A routine round (Vaccination, Deworming, Hoof Trimming, Dehorning): one
   *  call books an event per animal and one drug issue for the batch. */
  isRound?: boolean;
};

const SPECS: Record<string, Spec> = {
  vaccination: { title: "Vaccination",       eventType: "Vaccination",       isRound: true },
  deworming:   { title: "Deworming",         eventType: "Deworming",         isRound: true },
  dehorning:   { title: "Dehorning",         eventType: "Dehorning",         isRound: true },
  hoof:        { title: "Hoof trimming",     eventType: "Hoof Trimming",     isRound: true },
  heat:        { title: "Heat detection",    eventType: "Heat Detection" },
};

/**
 * The routine health and husbandry events. For the rounds the fields are the web
 * Husbandry page's: the job, the date, the animals, what each animal got (item,
 * store, quantity per animal, batch) and notes — plus the two things the server
 * also records for a round, the vet fee and each drug's withdrawal days. The vet is
 * picked from the farm's vets; the dehorning method or which feet were trimmed are not fields on the
 * record, so they are not asked for; put them in Notes if they matter.
 */
export default function GenericEvent() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const spec = SPECS[type || ""];

  const { operator, missingMessage } = useOperator();
  const { vets, vet, setVet, isInternal } = useVetChoice();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  const offline = useOffline();
  const [selected, setSelected] = useState<Animal[]>([]);
  const preset = usePresetAnimal();
  useSeedAnimal(preset, selected, (a) => setSelected([a]));
  const finish = useFinishRecording();
  const [vetFee, setVetFee] = useState("");
  const [drugs, setDrugs] = useState<DrugRow[]>([]);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // The drugs come from the event type's own stock rule (items_by_event). A type
  // the farm has not set to issue stock shows no drug section at all.
  const { choices: stockChoices, consumes } = useEventItems(spec?.eventType ?? "");
  const takesDrugs = !!spec?.isRound && consumes;
  const { refreshing, onRefresh } = usePullToRefresh();
  useRefreshOnFocus();

  const eventMutation = useCreateAnimalEvent();
  const submitting = eventMutation.isPending;

  // Animals the server's rules would refuse for this round (deworming too soon,
  // too old to dehorn, ...), asked before saving so they can be marked and left
  // out. Advice only: the server decides again, and reports what it skipped.
  const [previewed, setIneligible] = useState<SkippedAnimal[]>([]);
  const previewDate = isBackdating ? backdateDate : serverToday;
  const selectedKey = selected.map((a) => a.id).join("|");
  useEffect(() => {
    if (!spec?.isRound || selected.length === 0) return;
    let live = true;
    previewRound(spec.eventType, selected.map((a) => a.id), previewDate).then((s) => {
      if (live) setIneligible(s);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, previewDate, spec?.eventType]);
  const ineligible = useMemo(
    () => (spec?.isRound ? previewed.filter((s) => selected.some((a) => a.id === s.animal)) : []),
    [previewed, selected, spec?.isRound],
  );
  const ineligibleIds = useMemo(() => new Set(ineligible.map((s) => s.animal)), [ineligible]);
  const eligible = useMemo(() => selected.filter((a) => !ineligibleIds.has(a.id)), [selected, ineligibleIds]);
  const roundAnimals = spec?.isRound ? eligible : selected;

  const filledDrugRows = useMemo(
    () => drugs.filter((d) => d.itemCode.trim() && Number(d.qty) > 0),
    [drugs],
  );

  // Guard below every hook, never between them. This one screen serves several
  // event types off a single `[type]` route, so expo-router keeps the same
  // component mounted when only the param changes, and a deep link can arrive
  // with a type that has no spec.
  if (!spec) {
    return (
      <Screen title="Unknown event" back>
        <Banner tone="warning">No form configured for &quot;{type}&quot;.</Banner>
      </Screen>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    setWarning(null);

    if (selected.length === 0) return setError("Pick at least one animal.");
    if (roundAnimals.length === 0) return setError("None of the selected animals can have this recorded.");
    if (!operator) return setError(missingMessage);

    if (takesDrugs && filledDrugRows.length > 0) {
      // A heads-up, never a block: the server decides what the store can bear
      // (today's short round is saved with a draft issue; a backdated one is
      // refused with its own message). The rows are per animal, so what leaves
      // the store is qty x headcount.
      const shortage = await findShortage(
        stockChoices,
        filledDrugRows.map((d) => ({
          itemCode: d.itemCode.trim(),
          warehouse: d.sourceWarehouse,
          qtyNeeded: Number(d.qty) * roundAnimals.length,
        })),
      );
      if (shortage) setWarning(shortage);
    }

    const eventDate = isBackdating ? backdateDate : serverToday;
    const note = remarks.trim() || undefined;

    const replies: any[] = [];
    let succeededEvents = 0;
    // Skipped by the server on save: the preview's marks plus anything that
    // changed since. Shown with their reasons after the save.
    let skippedRows: SkippedAnimal[] = [];

    if (spec.isRound) {
      // One call for the whole round: the server books an event per animal and
      // posts a single drug issue for the batch, stamped with the named Stock
      // Entry Type. Drug quantities are PER ANIMAL; the server multiplies.
      const husbandryType = spec.eventType as "Vaccination" | "Deworming" | "Hoof Trimming" | "Dehorning";
      try {
        const r = await eventMutation.mutateAsync({
          eventType: husbandryType,
          animal: roundAnimals[0].id,
          animals: roundAnimals.map((a) => a.id),
          currentHerd: roundAnimals[0].herd,
          operator,
          vet: vet || undefined,
          eventDate,
          remarks: note,
          // An employee-vet is paid by payroll; the server refuses a fee for one.
          vetFee: !isInternal && Number(vetFee) > 0 ? Number(vetFee) : undefined,
          drugIssues: takesDrugs
            ? filledDrugRows.map((d) => ({
                itemCode: d.itemCode.trim(),
                qty: Number(d.qty),
                uom: d.uom || undefined,
                sourceWarehouse: d.sourceWarehouse || undefined,
                batchNo: d.batchNo || undefined,
                withdrawalDays: d.withdrawalDays ? Number(d.withdrawalDays) : undefined,
              }))
            : undefined,
        });
        succeededEvents = r?.animals ?? roundAnimals.length;
        skippedRows = Array.isArray(r?.skipped) ? r.skipped : [];
        replies.push(r);
      } catch (err) {
        setError(`Nothing was recorded. ${extractFrappeError(err)}`);
        return;
      }
    } else {
      for (const a of selected) {
        const common = {
          animal: a.id,
          currentHerd: a.herd,
          operator,
          eventDate,
          remarks: note,
        } as const;
        const payload: AnimalEventInput = { ...common, eventType: "Heat Detection" };
        try {
          const r = await eventMutation.mutateAsync(payload);
          succeededEvents += 1;
          replies.push(r);
        } catch (err) {
          setError(
            `${succeededEvents} of ${selected.length} submitted. Stopped at ${a.name}: ${extractFrappeError(err)}`,
          );
          return;
        }
      }
    }

    // What the server did, not what the phone assumes: drugs posted, or saved
    // with the stock issue pending, and what became of the vet fee.
    const eventParts: string[] = [];
    if (spec.isRound) {
      // Left out before saving (marked on the screen) plus skipped by the server.
      const all = [...ineligible.filter((i) => !skippedRows.some((k) => k.animal === i.animal)), ...skippedRows];
      eventParts.push(`Recorded ${succeededEvents} · Skipped ${all.length}`);
      for (const k of all) eventParts.push(`${k.animal}: ${k.reason}`);
    } else if (succeededEvents) {
      eventParts.push(`${succeededEvents} submitted`);
    }

    const notes: string[] = [];
    const stockNote = stockOutcomeText(replies);
    if (stockNote) notes.push(stockNote);
    notes.push(...stockWarningsOf(replies));
    const fee = replies.map((r) => r?.vet_fee).find(Boolean);
    if (fee) {
      notes.push(
        fee.posted
          ? `Vet fee KES ${Number(fee.amount).toLocaleString()} posted.`
          : `Vet fee KES ${Number(fee.amount).toLocaleString()} noted on the record; ${fee.reason}`,
      );
    }
    Alert.alert(
      stockNote ? `${spec.title} saved — stock issue pending` : `${spec.title} recorded`,
      [spec.isRound ? eventParts.join("\n") : eventParts.join(" · "), ...notes].filter(Boolean).join("\n\n"),
    );
    finish(spec.title);
  };

  return (
    <Screen
      title={titleFor(spec.title, preset)}
      subtitle="New event"
      back
      onRefresh={onRefresh}
      refreshing={refreshing}
      headerRight={isBackdating ? undefined : <BackdateButton type={type ?? ""} />}
    >
      {isBackdating ? <BackdateBanner /> : null}

      <Field
        label="Animal(s)"
        help={
          spec.isRound
            ? "Pick one cow, several, or a whole herd. Drug quantities below are per animal."
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

      {spec.isRound && ineligible.length > 0 ? (
        <Banner tone="warning">
          {`Left out (${ineligible.length}) — the server's rules refuse these:\n` +
            ineligible
              .map((s) => `${selected.find((a) => a.id === s.animal)?.name ?? s.animal}: ${s.reason}`)
              .join("\n")}
        </Banner>
      ) : null}

      {isBackdating ? (
        <Field label="Done on">
          <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={fromISODate(serverToday)} />
        </Field>
      ) : (
        <Field label="Done on"><Input value={serverToday} editable={false} /></Field>
      )}

      {takesDrugs ? (
        <>
          <AvailableStockButton eventType={spec.eventType} />
          <DrugRows rows={drugs} onChange={setDrugs} choices={stockChoices} headcount={roundAnimals.length} />
        </>
      ) : null}

      {spec.isRound ? <VetPicker vets={vets} value={vet} onChange={setVet} /> : null}

      {spec.isRound && !isInternal ? (
        <Field label="Vet fee for the round (KES)" help="The whole round's fee, once — the server records it.">
          <Input value={vetFee} onChangeText={setVetFee} keyboardType="decimal-pad" placeholder="0" />
        </Field>
      ) : null}

      <Field label="Notes">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Optional" />
      </Field>

      {warning ? <Banner tone="warning">{warning} It will still be saved; the store issue waits as a draft.</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <OnlineOnlyNotice />
      <Button
        label={submitting ? "Submitting…" : `Submit ${spec.title.toLowerCase()}`}
        disabled={offline || submitting || roundAnimals.length === 0}
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
  batchNo: string;
  withdrawalDays: string;
};

function DrugRows({
  rows,
  onChange,
  choices,
  headcount,
}: {
  rows: DrugRow[];
  onChange: (rows: DrugRow[]) => void;
  choices: StockChoice[] | undefined;
  headcount: number;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const add = () =>
    onChange([
      ...rows,
      { id: Date.now() + rows.length, itemCode: "", qty: "", uom: "", sourceWarehouse: "", batchNo: "", withdrawalDays: "" },
    ]);
  const update = (id: number, patch: Partial<DrugRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => onChange(rows.filter((r) => r.id !== id));

  return (
    <Field
      label="What each animal got"
      help="Quantities are per animal — 2 ml a cow across 20 cows leaves the store as one 40 ml line. Picking an item picks the store that holds it."
    >
      {rows.length === 0 ? (
        <Text style={s.drugEmpty}>No drug rows. Tap &quot;Add drug&quot; if any drug was used.</Text>
      ) : null}
      {rows.map((r) => (
        <View key={r.id} style={s.drugBox}>
          <StockItemFields
            choices={choices}
            value={{ itemCode: r.itemCode, uom: r.uom, warehouse: r.sourceWarehouse, batch: r.batchNo }}
            onChange={(v) =>
              update(r.id, { itemCode: v.itemCode, uom: v.uom, sourceWarehouse: v.warehouse, batchNo: v.batch ?? "" })
            }
            qtyNeeded={Number(r.qty) * Math.max(headcount, 1)}
          />
          <FieldRow>
            <Field label="Qty per animal" style={{ flex: 1 }}>
              <Input value={r.qty} onChangeText={(t) => update(r.id, { qty: t })} keyboardType="decimal-pad" />
            </Field>
            <Field label="UOM" style={{ flex: 1 }}>
              <Input value={r.uom} editable={false} placeholder="—" />
            </Field>
          </FieldRow>
          <Field label="Withdrawal (days)">
            <Input
              value={r.withdrawalDays}
              onChangeText={(t) => update(r.id, { withdrawalDays: t })}
              keyboardType="number-pad"
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
  });
