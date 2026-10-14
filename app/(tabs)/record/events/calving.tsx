import { useOnChange } from "@/src/hooks/useOnChange";
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
  const [sex, setSex] = useState<"Female" | "Male">("Female");
  const [calfBook, setCalfBook] = useState("");
  const [calfName, setCalfName] = useState("");
  const [birthWt, setBirthWt] = useState("");
  const [coatColour, setCoatColour] = useState("");
  const [health, setHealth] = useState<"Healthy" | "Weak" | "Needs Attention" | "Critical">(
    "Healthy",
  );
  const [calfPhoto, setCalfPhoto] = useState<FileAsset | null>(null);
  const [toHerdPick, setToHerd] = useState<string>("");
  const [calfHerdPick, setCalfTargetHerd] = useState<string>("");
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

  // Default calf target herd: Female → female_calf_herd,
  // Male → male_calf_herd. Refreshes when sex flips.
  const sexTarget = sex === "Female" ? settings?.female_calf_herd : settings?.male_calf_herd;
  const settingsCalfHerd = sexTarget && herds.some((h) => h.n === sexTarget) ? sexTarget : "";
  // A change of sex or outcome puts the default back, as before.
  useOnChange(`${outcome}|${sex}|${settingsCalfHerd}`, () => setCalfTargetHerd(""));
  const calfTargetHerd = calfHerdPick || settingsCalfHerd || herds[0]?.n || "";

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    if (!dam) return setError("Pick the dam (mother).");
    if (outcome === "Live Birth" && (!calfBook.trim() || !calfName.trim())) {
      return setError("Live births need a calf book number and burn name — the server uses these to create the Animal record.");
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
          abortionNotes: coatColour || undefined,
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
        calfBookNumber: outcome === "Live Birth" ? calfBook.trim() : undefined,
        calfBurnName: outcome === "Live Birth" ? calfName.trim() : undefined,
        calfGender: outcome === "Live Birth" ? sex : undefined,
        calfTargetHerd: outcome === "Live Birth" ? calfTargetHerd || undefined : undefined,
        calfHealthStatus: outcome === "Live Birth" ? health : undefined,
        birthWeightKg: birthWt ? Number(birthWt) : undefined,
        coatColour: coatColour || undefined,
        calfPhoto: outcome === "Live Birth" && calfPhoto ? calfPhoto : undefined,
      });

      // The photo (if any) was uploaded by createAnimalEvent and the server set it
      // as the calf image; a failed upload costs the photo, never the birth.
      const calf = r?.calves?.[0];
      if (outcome === "Live Birth" && calf?.animal) {
        const photoLine =
          r?.photo === "attached"
            ? "\nPhoto saved on the calf's record."
            : r?.photo === "failed"
              ? "\nThe photo could not be uploaded, so the calf has none yet. Add it from the animal's page."
              : "";
        Alert.alert(
          "Calving recorded",
          `${dam.name} calved. Calf ${calf.tag} created in ${calf.herd || "—"}.${photoLine}`,
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
              value={coatColour}
              onChangeText={setCoatColour}
              placeholder="What was observed"
            />
          </Field>
        </>
      ) : null}

      {outcome === "Live Birth" ? (
        <>
          <SectionTitle>Calf details</SectionTitle>
          <Field
            label="Calf moves to herd"
            help={sex === "Female" ? "Default: heifer herd from Livestock Settings." : "Default: bull herd from Livestock Settings."}
          >
            <Picker value={calfTargetHerd} onChange={setCalfTargetHerd} options={herds.map((h) => h.n)} />
          </Field>
          <Field label="Calf book number">
            <Input value={calfBook} onChangeText={setCalfBook} placeholder="e.g. A001/26" autoCapitalize="characters" />
          </Field>
          <FieldRow>
            <Field label="Calf burn name" style={{ flex: 1 }}>
              <Input value={calfName} onChangeText={setCalfName} placeholder="e.g. BLOSSOM" autoCapitalize="characters" />
            </Field>
            <Field label="Sex" style={{ flex: 1 }}>
              <Chips>
                <Chip label="Female" active={sex === "Female"} onPress={() => setSex("Female")} />
                <Chip label="Male" active={sex === "Male"} onPress={() => setSex("Male")} />
              </Chips>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Birth weight (kg)" style={{ flex: 1 }}>
              <Input value={birthWt} onChangeText={setBirthWt} keyboardType="numeric" placeholder="36" />
            </Field>
            <Field label="Coat colour" style={{ flex: 1 }}>
              <Input value={coatColour} onChangeText={setCoatColour} placeholder="Black & White" />
            </Field>
          </FieldRow>
          <Field
            label="Condition at birth"
            help="Goes onto the calf's own record. A weak calf found early is a calf that survives."
          >
            <Picker
              value={health}
              onChange={(v) => setHealth(v as typeof health)}
              options={["Healthy", "Weak", "Needs Attention", "Critical"]}
            />
          </Field>
          <CalfPhotoField value={calfPhoto} onChange={setCalfPhoto} />
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
