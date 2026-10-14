import { router } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Button } from "@/components/Button";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { VetPicker } from "@/components/VetPicker";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useCreateCheckUp } from "@/src/hooks/mutations";
import { useHealthOptions } from "@/src/hooks/useHealthOptions";
import { useOperator } from "@/src/hooks/useOperator";
import { useVetChoice } from "@/src/hooks/useVets";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";

const num = (v: string): number | undefined => {
  const t = v.trim();
  return t === "" || Number.isNaN(Number(t)) ? undefined : Number(t);
};

/**
 * A check up: one look at one animal. The same fields, in the same order, as the
 * web Check up page, saved through the same endpoint (create_check_up).
 *
 * Not recorded here, on purpose: the doctype has no eyes / nose / dung /
 * disease-flag fields, so the old head-to-tail form kept them only as sentences
 * in the notes. What was a drug given at the check goes through Treatment, which
 * puts it in her health file.
 */
export default function CheckUp() {
  const { operator, missingMessage } = useOperator();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  const offline = useOffline();
  const options = useHealthOptions();
  const o = options.data;
  const mutation = useCreateCheckUp();
  const { vets, vet, setVet } = useVetChoice();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [reason, setReason] = useState("");
  const [temp, setTemp] = useState("");
  const [hr, setHr] = useState("");
  const [resp, setResp] = useState("");
  const [bcs, setBcs] = useState("");
  const [lameness, setLameness] = useState("");
  const [appearance, setAppearance] = useState("");
  const [hydration, setHydration] = useState("");
  const [disease, setDisease] = useState("");
  const [differential, setDifferential] = useState("");
  const [action, setAction] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const today = new Date();

  const submit = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    if (!animal) return setError("Pick the animal.");
    if (!reason.trim()) return setError("Say why she was looked at.");
    if (!action) return setError("Say what was done.");
    const b = num(bcs);
    if (b != null && (b < 1 || b > 5)) return setError("Body condition is 1 to 5.");
    const l = num(lameness);
    if (l != null && (l < 0 || l > 3 || !Number.isInteger(l))) return setError("Lameness is 0 to 3.");

    try {
      const r = await mutation.mutateAsync({
        animal: animal.id,
        operator,
        vet: vet || undefined,
        diagnosisDate: isBackdating ? backdateDate : serverToday,
        reasonForCheck: reason.trim(),
        temperatureC: num(temp),
        heartRate: num(hr),
        respirationRate: num(resp),
        bcs: b,
        lamenessScore: l,
        appearance: appearance || undefined,
        hydration: hydration || undefined,
        suggestedDisease: disease || undefined,
        differentialNotes: differential.trim() || undefined,
        actionTaken: action,
        followUpDate: followUp || undefined,
        actionNotes: notes.trim() || undefined,
      });
      const d = r;
      const said = d?.case_opened
          ? `${animal.name} seen — ${d.name}. A health file is open for her: ${d.case}.`
          : d?.case
            ? `${animal.name} seen — ${d.name}. Added to her open file ${d.case}.`
            : `${animal.name} seen — ${d?.name}.`;
      Alert.alert("Check up recorded", said);
      router.replace("/(tabs)/record/success?name=Check up");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen
      title="Check up"
      subtitle="One look at one animal"
      back
      headerRight={isBackdating ? undefined : <BackdateButton type="diagnosis" />}
    >
      {isBackdating ? <BackdateBanner /> : null}
      {options.error ? (
        <Banner tone="warning">
          The choices could not be loaded ({extractFrappeError(options.error)}). Pull to retry
          from the previous screen.
        </Banner>
      ) : null}

      <Field label="Which animal">
        <AnimalPickerButton
          mode="single"
          placeholder={animal ? `${animal.name} · ${animal.id}` : "Search by tag or name…"}
          value={animal}
          onPickSingle={setAnimal}
        />
      </Field>

      <Field label="Seen on">
        {isBackdating ? (
          <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={fromISODate(serverToday)} />
        ) : (
          <Input value={serverToday} editable={false} />
        )}
      </Field>

      <VetPicker vets={vets} value={vet} onChange={setVet} />

      <Field label="Why she was looked at">
        <Input value={reason} onChangeText={setReason} placeholder="Off her feed since yesterday" />
      </Field>

      <FieldRow>
        <Field label="Temperature (°C)" style={{ flex: 1 }}>
          <Input value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="38.7" />
        </Field>
        <Field label="Heart rate" style={{ flex: 1 }}>
          <Input value={hr} onChangeText={setHr} keyboardType="number-pad" placeholder="60" />
        </Field>
        <Field label="Respiration" style={{ flex: 1 }}>
          <Input value={resp} onChangeText={setResp} keyboardType="number-pad" placeholder="20" />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Body condition" help="1 to 5, in quarters." style={{ flex: 1 }}>
          <Input value={bcs} onChangeText={setBcs} keyboardType="decimal-pad" placeholder="3.25" />
        </Field>
        <Field label="Lameness" help="0 sound, 1 mild, 2 obvious limp, 3 will not bear weight." style={{ flex: 1 }}>
          <Input value={lameness} onChangeText={setLameness} keyboardType="number-pad" placeholder="0" />
        </Field>
      </FieldRow>

      <Field label="Appearance">
        <Picker value={appearance} onChange={setAppearance} options={o?.appearances ?? []} placeholder="—" clearable />
      </Field>
      <Field label="Hydration">
        <Picker value={hydration} onChange={setHydration} options={o?.hydrations ?? []} placeholder="—" clearable />
      </Field>
      <Field label="Suspected">
        <Picker value={disease} onChange={setDisease} options={o?.diseases ?? []} placeholder="—" clearable />
      </Field>
      <Field label="Differential / notes">
        <Textarea
          value={differential}
          onChangeText={setDifferential}
          placeholder="Could be ketosis; check urine before treating."
        />
      </Field>

      <Field label="What was done">
        <Picker value={action} onChange={setAction} options={o?.actions ?? []} placeholder="Choose…" />
      </Field>
      <Field label="Look again on">
        <DateField value={followUp} onChange={setFollowUp} minimumDate={today} placeholder="—" />
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChangeText={setNotes} />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      <OnlineOnlyNotice />
      <Button
        label={mutation.isPending ? "Recording…" : "Record the check up"}
        loading={mutation.isPending}
        disabled={offline || mutation.isPending || !animal}
        onPress={submit}
      />
    </Screen>
  );
}
