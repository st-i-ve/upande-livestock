import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { DateField } from "@/components/DateTimeField";
import { Field, FieldRow, Input } from "@/components/Field";
import { Loader } from "@/components/Loader";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { VetPicker } from "@/components/VetPicker";
import { StockItemFields, type StockPick } from "@/components/StockItemFields";
import { RADIUS } from "@/constants/theme";
import { findShortage, stockOutcomeText } from "@/src/frappe/eventItems";
import { getAnimalCase } from "@/src/frappe/treatment";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useColors } from "@/src/hooks/useColors";
import { useEventItems } from "@/src/hooks/useEventItems";
import { useHealthOptions } from "@/src/hooks/useHealthOptions";
import { useTreatAnimal } from "@/src/hooks/mutations";
import { useOperator } from "@/src/hooks/useOperator";
import { useVetChoice } from "@/src/hooks/useVets";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

type Dose = {
  id: number;
  pick: StockPick;
  qty: string;
  dosage: string;
  route: string;
  withdrawal: string;
  response: string;
};

const blankDose = (id: number): Dose => ({
  id,
  pick: { itemCode: "", uom: "", warehouse: "", batch: "" },
  qty: "1",
  dosage: "",
  route: "",
  withdrawal: "",
  response: "",
});

/**
 * Treating an animal, which is also how a health file gets opened. The same
 * fields as the web Treatment page, through the same endpoint (treat_animal).
 *
 * It asks for the COW and then says what she already has: a file open eleven
 * days with four treatments in it, or nothing. Writing into the file she has is
 * the default, because a second file for an illness already being treated is
 * what scatters one bout of mastitis across three records. Starting a new one is
 * a deliberate answer with a complaint attached.
 *
 * The phone records what was given; the store, the cost and the withdrawal date
 * are the server's.
 */
export default function Treatment() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { operator, missingMessage } = useOperator();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const options = useHealthOptions().data;
  const { choices: stock } = useEventItems("Treatment");
  const mutation = useTreatAnimal();
  const { vets, vet, setVet } = useVetChoice();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const standingQ = useQuery({
    queryKey: ["animal-case", animal?.id],
    queryFn: () => getAnimalCase(animal!.id),
    enabled: !!animal,
    staleTime: 0,
  });
  const standing = standingQ.data;
  const openCase = standing?.open_case ?? null;

  // null = follow the default (add to her file if she has one, else open one).
  const [freshPick, setFreshPick] = useState<boolean | null>(null);
  const fresh = freshPick ?? !openCase;
  const [complaint, setComplaint] = useState("");
  const [suspected, setSuspected] = useState("");
  const [severity, setSeverity] = useState("");
  const [doses, setDoses] = useState<Dose[]>(() => [blankDose(1)]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const patch = (id: number, p: Partial<Dose>) =>
    setDoses((rows) => rows.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const pickAnimal = (a: Animal) => {
    setAnimal(a);
    setFreshPick(null);
  };

  const submit = async () => {
    setError(null);
    setWarning(null);
    if (!operator) return setError(missingMessage);
    if (!animal) return setError("Pick the animal.");
    if (standingQ.isLoading) return setError("Looking her file up — try again in a moment.");
    if (standingQ.error) return setError(extractFrappeError(standingQ.error));
    const given = doses.filter((d) => d.pick.itemCode && Number(d.qty) > 0);
    if (!given.length) return setError("Pick a drug and a quantity.");
    if (fresh && !complaint.trim()) return setError("A new file needs a complaint on the front of it.");

    const shortage = await findShortage(
      stock,
      given.map((d) => ({
        itemCode: d.pick.itemCode,
        warehouse: d.pick.warehouse,
        qtyNeeded: Number(d.qty),
      })),
    );
    if (shortage) setWarning(shortage);

    try {
      const r = await mutation.mutateAsync({
        animal: animal.id,
        caseName: !fresh && openCase ? openCase.name : undefined,
        openNew: fresh,
        presentingSymptoms: complaint.trim(),
        provisionalDiagnosis: suspected || undefined,
        severity: severity || undefined,
        operator,
        vet: vet || undefined,
        treatmentDate: isBackdating ? backdateDate : todayISO(),
        doses: given.map((d) => ({
          itemCode: d.pick.itemCode,
          qty: Number(d.qty),
          warehouse: d.pick.warehouse || undefined,
          batch: d.pick.batch || undefined,
          dosage: d.dosage.trim() || undefined,
          route: d.route || undefined,
          withdrawalDays: d.withdrawal ? Number(d.withdrawal) : undefined,
          response: d.response || undefined,
        })),
      });
      const d = r.data;
      const stockNote = r.queued ? "" : stockOutcomeText([d]);
      const said = r.queued
        ? "Queued — it will be sent when the phone is online."
        : d.opened
          ? `A new file is open for ${d.animal} — ${d.case} — with ${d.added} treatment${d.added === 1 ? "" : "s"} in it.`
          : `${d.added} treatment${d.added === 1 ? "" : "s"} added to ${d.case}. ${d.treatments} in the file now.`;
      Alert.alert("Treatment recorded", [said, stockNote].filter(Boolean).join("\n\n"));
      router.replace("/(tabs)/record/success?name=Treatment");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen
      title="Treatment"
      subtitle="Into her health file"
      back
      headerRight={isBackdating ? undefined : <BackdateButton type="treatment" />}
    >
      {isBackdating ? <BackdateBanner /> : null}

      <Field label="Which animal" help="Her file is looked up as you pick her.">
        <AnimalPickerButton
          mode="single"
          placeholder={animal ? `${animal.name} · ${animal.id}` : "Search by tag or name…"}
          value={animal}
          onPickSingle={pickAnimal}
        />
      </Field>

      {animal && standingQ.isLoading ? <Loader /> : null}
      {animal && standingQ.error ? (
        <Banner tone="danger">{extractFrappeError(standingQ.error)}</Banner>
      ) : null}

      {animal && standing ? (
        <>
          {openCase ? (
            <View style={s.file}>
              <Text style={s.fileTitle}>
                Open since {openCase.opened_date} — {openCase.days_open} days, {openCase.treatments}{" "}
                treatment{openCase.treatments === 1 ? "" : "s"}
              </Text>
              <Text style={s.fileBody}>
                {openCase.presenting_symptoms || "No complaint on the file."}
                {openCase.provisional_diagnosis ? ` — thought to be ${openCase.provisional_diagnosis}.` : ""}
              </Text>
            </View>
          ) : (
            <Banner tone="info">
              She has no open file, so this treatment opens one. Say what is wrong with her.
            </Banner>
          )}
          {standing.closed_count ? (
            <Text style={s.small}>
              {standing.closed_count} closed file{standing.closed_count === 1 ? "" : "s"} before this
              {standing.history[0]?.opened_date ? `, the last opened ${standing.history[0].opened_date}` : ""}.
            </Text>
          ) : null}

          {openCase ? (
            <Chips>
              <Chip label="Add to her open file" active={!fresh} onPress={() => setFreshPick(false)} />
              <Chip label="Open a new file" active={fresh} onPress={() => setFreshPick(true)} />
            </Chips>
          ) : null}

          {fresh ? (
            <>
              <Field label="What is wrong">
                <Input
                  value={complaint}
                  onChangeText={setComplaint}
                  placeholder="Swollen left hind quarter, hard"
                />
              </Field>
              <FieldRow>
                <Field label="Thought to be" style={{ flex: 1 }}>
                  <Picker value={suspected} onChange={setSuspected} options={options?.diseases ?? []} placeholder="Not said" clearable />
                </Field>
                <Field label="How bad" style={{ flex: 1 }}>
                  <Picker value={severity} onChange={setSeverity} options={options?.severities ?? []} placeholder="Not said" clearable />
                </Field>
              </FieldRow>
            </>
          ) : null}
        </>
      ) : null}

      <VetPicker vets={vets} value={vet} onChange={setVet} />

      <Field label="Given on">
        {isBackdating ? (
          <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={new Date()} />
        ) : (
          <Input value={todayISO()} editable={false} />
        )}
      </Field>

      {doses.map((d, i) => (
        <View key={d.id} style={s.dose}>
          <Text style={s.fileTitle}>Drug {i + 1}</Text>
          <StockItemFields
            choices={stock}
            value={d.pick}
            onChange={(pick) => patch(d.id, { pick })}
            qtyNeeded={Number(d.qty)}
          />
          <FieldRow>
            <Field label="Qty" style={{ flex: 1 }}>
              <Input value={d.qty} onChangeText={(t) => patch(d.id, { qty: t })} keyboardType="decimal-pad" />
            </Field>
            <Field label="UOM" style={{ flex: 1 }}>
              <Input value={d.pick.uom} editable={false} placeholder="—" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Dose" style={{ flex: 1 }}>
              <Input value={d.dosage} onChangeText={(t) => patch(d.id, { dosage: t })} placeholder="20 ml" />
            </Field>
            <Field label="Withdrawal (days)" style={{ flex: 1 }}>
              <Input
                value={d.withdrawal}
                onChangeText={(t) => patch(d.id, { withdrawal: t })}
                keyboardType="number-pad"
              />
            </Field>
          </FieldRow>
          <Field label="How">
            <Picker value={d.route} onChange={(v) => patch(d.id, { route: v })} options={options?.routes ?? []} placeholder="Route" clearable />
          </Field>
          <Field label="How she is">
            <Picker
              value={d.response}
              onChange={(v) => patch(d.id, { response: v })}
              options={options?.responses ?? []}
              placeholder="Not assessed"
              clearable
            />
          </Field>
          {doses.length > 1 ? (
            <Button label="Remove drug" variant="link" onPress={() => setDoses((r) => r.filter((x) => x.id !== d.id))} />
          ) : null}
        </View>
      ))}
      <Button
        label="Add a drug"
        icon="plus"
        variant="outline"
        onPress={() => setDoses((r) => [...r, blankDose(Date.now())])}
      />

      {warning ? (
        <Banner tone="warning">{warning} It will still be saved; the store issue waits as a draft.</Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button
        label={mutation.isPending ? "Recording…" : fresh ? "Open a file and record it" : "Add it to her file"}
        loading={mutation.isPending}
        disabled={mutation.isPending || !animal}
        onPress={submit}
      />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    file: { backgroundColor: c.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 10, gap: 4 },
    fileTitle: { fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 6 },
    fileBody: { fontSize: 12, color: c.textMuted, lineHeight: 17 },
    small: { fontSize: 11, color: c.textSubtle, marginBottom: 8 },
    dose: { backgroundColor: c.bgMuted, padding: 11, borderRadius: RADIUS.md, marginBottom: 8 },
  });
