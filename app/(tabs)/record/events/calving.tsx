import { router } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { BackdateBanner } from "@/components/BackdateBanner";
import { BackdateButton } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field, FieldRow, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { CalfPhotoField } from "@/components/CalfPhotoField";
import { syncAnimals } from "@/src/db/sync";
import type { CalfInput } from "@/src/frappe/calves";
import type { FileAsset } from "@/src/frappe/files";
import { useAnimals } from "@/src/hooks/useAnimals";
import { useBackdate } from "@/src/hooks/useBackdate";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useOperator } from "@/src/hooks/useOperator";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useHerds } from "@/src/hooks/useHerds";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { extractFrappeError } from "@/src/services/api";
import type { Animal } from "@/types";

type CalfRow = {
  key: number;
  sex: "Female" | "Male";
  burnName: string;
  birthWt: string;
  coat: string;
  health: "Healthy" | "Weak" | "Needs Attention" | "Critical";
  /** "" = the herd Settings routes this sex to. */
  herdPick: string;
  isStillborn: boolean;
  photo: FileAsset | null;
};

let nextCalfKey = 1;
const blankCalf = (): CalfRow => ({
  key: nextCalfKey++,
  sex: "Female",
  burnName: "",
  birthWt: "",
  coat: "",
  health: "Healthy",
  herdPick: "",
  isStillborn: false,
  photo: null,
});

export default function Calving() {
  const { data: animals = [] } = useAnimals();
  const { data: herds = [] } = useHerds();
  const { data: settings } = useLivestockSettings();

  const { operator, missingMessage } = useOperator();
  const { isBackdating, eventDate: backdateDate, setEventDate: setBackdateDate } = useBackdate();
  const { today: serverToday } = useBackdatingWindow();
  const offline = useOffline();
  const [dam, setDam] = useState<Animal | null>(null);
  const [outcome, setOutcome] = useState<"Live Birth" | "Still Birth" | "Abortion">("Live Birth");
  const [abortionCause, setAbortionCause] = useState<
    "Infectious" | "Nutritional" | "Traumatic" | "Congenital" | "Unknown" | "Other"
  >("Unknown");
  const [coatNote, setCoatNote] = useState("");
  const [calves, setCalves] = useState<CalfRow[]>(() => [blankCalf()]);
  const [toHerdPick, setToHerd] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const pregnantCount = animals.filter((a) => a.pregnant).length;

  // Default dam destination: Livestock Settings → high_yield_herd if set,
  // otherwise the first milking herd, otherwise the first available herd.
  const fromSettings = settings?.high_yield_herd;
  const defaultToHerd =
    fromSettings && herds.some((h) => h.n === fromSettings)
      ? fromSettings
      : (herds.find((h) => h.isMilking)?.n ?? herds[0]?.n ?? "");
  const toHerd = toHerdPick || defaultToHerd;

  // Default calf herd, per calf: Female -> female_calf_herd, Male -> male_calf_herd.
  const defaultCalfHerd = (sex: "Female" | "Male") => {
    const t = sex === "Female" ? settings?.female_calf_herd : settings?.male_calf_herd;
    return t && herds.some((h) => h.n === t) ? t : (herds[0]?.n ?? "");
  };
  const patchCalf = (key: number, patch: Partial<CalfRow>) =>
    setCalves((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    if (!dam) return setError("Pick the dam (mother).");
    if (outcome === "Live Birth" && calves.some((c) => !c.isStillborn && !c.burnName.trim())) {
      return setError("Give every live calf a name. Its book number is assigned when you save.");
    }

    // A pregnancy loss is not a calving with a bad outcome. It closes the
    // pregnancy and re-opens the cow for service, and the server refuses
    // "Abortion" on a Calving event outright.
    if (outcome === "Abortion") {
      try {
        await mutation.mutateAsync({
          eventType: "Abortion",
          animal: dam.id,
          currentHerd: dam.herd,
          operator,
          eventDate: isBackdating ? backdateDate : serverToday,
          abortionCause,
          abortionNotes: coatNote || undefined,
        });
        Alert.alert(
          "Abortion recorded",
          `${dam.name}'s pregnancy is closed. She becomes servable again once the waiting period is up.`,
        );
        router.replace("/(tabs)/record/success?name=Abortion");
      } catch (err) {
        setError(extractFrappeError(err));
      }
      return;
    }

    try {
      const r = await mutation.mutateAsync({
        eventType: "Calving",
        animal: dam.id,
        currentHerd: dam.herd,
        operator,
        eventDate: isBackdating ? backdateDate : serverToday,
        calvingOutcome: outcome as "Live Birth" | "Still Birth",
        toHerd: toHerd || undefined,
        calves:
          outcome === "Live Birth"
            ? calves.map(
                (c): CalfInput => ({
                  sex: c.sex,
                  burnName: c.burnName.trim(),
                  birthWeightKg: c.birthWt ? Number(c.birthWt) : undefined,
                  coatColour: c.coat || undefined,
                  healthStatus: c.health,
                  herd: c.herdPick || defaultCalfHerd(c.sex) || undefined,
                  isStillborn: c.isStillborn,
                  photo: c.photo,
                }),
              )
            : [{ sex: calves[0]?.sex ?? "Female", isStillborn: true }],
      });

      // The server numbered each calf (A heifers, B bulls). Show them, then pull
      // them into the phone's own animal store now rather than at the next tick.
      const born: { animal: string; tag?: string; herd?: string }[] = r?.calves ?? [];
      void syncAnimals();
      if (outcome === "Live Birth" && born.length) {
        const photoLine =
          r?.photo === "attached"
            ? "\nPhoto saved on the calf's record."
            : r?.photo === "failed"
              ? "\nA photo could not be uploaded, so that calf has none yet. Add it from the animal's page."
              : "";
        const lines = born.map((c) => `${c.animal} in ${c.herd || "—"}`).join("\n");
        Alert.alert(
          "Calving recorded",
          `${dam.name} calved ${born.length === 1 ? "one calf" : `${born.length} calves`}:\n${lines}${photoLine}`,
        );
        router.replace("/(tabs)/record/success?name=Calving");
        return;
      }

      Alert.alert("Calving recorded", `${dam.name} marked as calved (${outcome}).`);
      router.replace("/(tabs)/record/success?name=Calving");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen
      title="Calving"
      subtitle="Birth event from existing pregnancy"
      back
      headerRight={isBackdating ? undefined : <BackdateButton type="calving" />}
    >
      {isBackdating ? <BackdateBanner /> : null}
      {pregnantCount === 0 ? (
        <Banner tone="warning">No pregnant cows on record.</Banner>
      ) : null}


      <Field label="Dam (mother)" help="If your cow isn't here, she has no pregnancy on record. Use the + button to add a Pregnancy Diagnosis first.">
        <AnimalPickerButton
          title="Select dam (pregnant only)"
          placeholder="Search pregnant cow..."
          include={(a) => a.pregnant === 1}
          emptyAction={{ label: "Add pregnancy", onPress: () => router.push("/(tabs)/record/events/pd") }}
          value={dam}
          onPickSingle={setDam}
        />
      </Field>

      <FieldRow>
        <Field label="Calving date" style={{ flex: 1 }}>
          {isBackdating ? (
            <DateField value={backdateDate} onChange={setBackdateDate} maximumDate={fromISODate(serverToday)} />
          ) : (
            <Input value={serverToday} editable={false} />
          )}
        </Field>
        <Field label="Outcome" style={{ flex: 1 }}>
          <Picker
            value={outcome}
            onChange={(v) => setOutcome(v as typeof outcome)}
            options={["Live Birth", "Still Birth", "Abortion"]}
          />
        </Field>
      </FieldRow>

      <Field
        label="Dam moves to herd"
        help={settings?.high_yield_herd ? "Default from Livestock Settings → Lactating herd." : "Pick the milking group the dam will join."}
      >
        <Picker value={toHerd} onChange={setToHerd} options={herds.map((h) => h.n)} />
      </Field>

      {outcome === "Abortion" ? (
        <>
          <SectionTitle>Pregnancy loss</SectionTitle>
          <Field
            label="Cause"
            help="Recorded so a pattern across the herd can be seen. Pick Unknown rather than guessing."
          >
            <Picker
              value={abortionCause}
              onChange={(v) => setAbortionCause(v as typeof abortionCause)}
              options={["Infectious", "Nutritional", "Traumatic", "Congenital", "Unknown", "Other"]}
            />
          </Field>
          <Field label="Notes">
            <Input
              value={coatNote}
              onChangeText={setCoatNote}
              placeholder="What was observed"
            />
          </Field>
        </>
      ) : null}

      {outcome === "Live Birth" ? (
        <>
          {calves.map((c, i) => (
            <React.Fragment key={c.key}>
              <SectionTitle>{calves.length > 1 ? `Calf ${i + 1} of ${calves.length}` : "Calf details"}</SectionTitle>
              <Field label="Sex">
                <Chips>
                  <Chip label="Female" active={c.sex === "Female"} onPress={() => patchCalf(c.key, { sex: "Female", herdPick: "" })} />
                  <Chip label="Male" active={c.sex === "Male"} onPress={() => patchCalf(c.key, { sex: "Male", herdPick: "" })} />
                  <Chip label="Stillborn" active={c.isStillborn} onPress={() => patchCalf(c.key, { isStillborn: !c.isStillborn })} />
                </Chips>
              </Field>
              <Field
                label="Calf book number"
                help={c.sex === "Female" ? "A series (heifer). The next number is given when you save." : "B series (bull). The next number is given when you save."}
              >
                <Input value={c.isStillborn ? "None - stillborn" : "Book no. assigned on save"} editable={false} />
              </Field>
              {c.isStillborn ? null : (
                <>
                  <Field
                    label="Calf moves to herd"
                    help={c.sex === "Female" ? "Default: heifer herd from Livestock Settings." : "Default: bull herd from Livestock Settings."}
                  >
                    <Picker
                      value={c.herdPick || defaultCalfHerd(c.sex)}
                      onChange={(v) => patchCalf(c.key, { herdPick: v })}
                      options={herds.map((h) => h.n)}
                    />
                  </Field>
                  <Field label="Calf name">
                    <Input value={c.burnName} onChangeText={(v) => patchCalf(c.key, { burnName: v })} placeholder="e.g. BLOSSOM" autoCapitalize="characters" />
                  </Field>
                  <FieldRow>
                    <Field label="Birth weight (kg)" style={{ flex: 1 }}>
                      <Input value={c.birthWt} onChangeText={(v) => patchCalf(c.key, { birthWt: v })} keyboardType="numeric" placeholder="36" />
                    </Field>
                    <Field label="Coat colour" style={{ flex: 1 }}>
                      <Input value={c.coat} onChangeText={(v) => patchCalf(c.key, { coat: v })} placeholder="Black & White" />
                    </Field>
                  </FieldRow>
                  <Field
                    label="Condition at birth"
                    help="Goes onto the calf's own record. A weak calf found early is a calf that survives."
                  >
                    <Picker
                      value={c.health}
                      onChange={(v) => patchCalf(c.key, { health: v as CalfRow["health"] })}
                      options={["Healthy", "Weak", "Needs Attention", "Critical"]}
                    />
                  </Field>
                  <CalfPhotoField value={c.photo} onChange={(a) => patchCalf(c.key, { photo: a })} />
                </>
              )}
              {calves.length > 1 ? (
                <Button
                  label={`Remove calf ${i + 1}`}
                  variant="outline"
                  onPress={() => setCalves((cs) => cs.filter((x) => x.key !== c.key))}
                />
              ) : null}
            </React.Fragment>
          ))}
          <Button
            label="Add another calf (twins)"
            variant="outline"
            icon="plus"
            onPress={() => setCalves((cs) => [...cs, blankCalf()])}
          />
        </>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <OnlineOnlyNotice />
      <Button
        label={mutation.isPending ? "Submitting…" : "Submit calving"}
        disabled={offline || mutation.isPending || !dam}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
