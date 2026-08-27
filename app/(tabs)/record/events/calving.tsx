import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { captureAndAttachCalfPhoto } from "@/src/frappe/calfPhoto";
import { useAnimals } from "@/src/hooks/useAnimals";
import { useOperator } from "@/src/hooks/useOperator";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useHerds } from "@/src/hooks/useHerds";
import { useLivestockSettings } from "@/src/hooks/useLivestockSettings";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

export default function Calving() {
  const { data: animals = [] } = useAnimals();
  const { data: herds = [] } = useHerds();
  const { data: settings } = useLivestockSettings();

  const { operator, missingMessage } = useOperator();
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
  const [toHerd, setToHerd] = useState<string>("");
  const [calfTargetHerd, setCalfTargetHerd] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const pregnantCount = animals.filter((a) => a.pregnant).length;

  // Default dam destination: Livestock Settings → custom_lactating_herd if set,
  // otherwise the first milking herd, otherwise the first available herd.
  useEffect(() => {
    if (toHerd || !herds.length) return;
    const fromSettings = settings?.high_yield_herd;
    if (fromSettings && herds.some((h) => h.n === fromSettings)) {
      setToHerd(fromSettings);
      return;
    }
    const milking = herds.find((h) => h.isMilking);
    setToHerd(milking?.n ?? herds[0].n);
  }, [herds, toHerd, settings]);

  // Default calf target herd: Female → custom_default_heifer_herd (the 0-2 group),
  // Male → custom_default_bull_herd. Refreshes when sex flips.
  useEffect(() => {
    if (outcome !== "Live Birth") return;
    const target =
      sex === "Female"
        ? settings?.female_calf_herd
        : settings?.male_calf_herd;
    if (target && herds.some((h) => h.n === target)) setCalfTargetHerd(target);
    else if (!calfTargetHerd && herds.length) setCalfTargetHerd(herds[0].n);
  }, [sex, outcome, settings, herds]); // eslint-disable-line react-hooks/exhaustive-deps

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
          eventDate: todayISO(),
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
        eventDate: todayISO(),
        calvingOutcome: outcome as "Live Birth" | "Still Birth",
        toHerd: toHerd || undefined,
        calfBookNumber: outcome === "Live Birth" ? calfBook.trim() : undefined,
        calfBurnName: outcome === "Live Birth" ? calfName.trim() : undefined,
        calfGender: outcome === "Live Birth" ? sex : undefined,
        calfTargetHerd: outcome === "Live Birth" ? calfTargetHerd || undefined : undefined,
        calfHealthStatus: outcome === "Live Birth" ? health : undefined,
        birthWeightKg: birthWt ? Number(birthWt) : undefined,
        coatColour: coatColour || undefined,
      });

      if (r.queued) {
        Alert.alert("Queued offline", `${dam.name} saved locally. Will sync when online.`);
        router.replace("/(tabs)/record/success?name=Calving");
        return;
      }

      // The calf only exists now, so the photo can only be offered now. The
      // birth is already recorded and submitted — declining, or a camera that
      // fails, costs nothing.
      const calf = r.data?.calves?.[0];
      if (outcome === "Live Birth" && calf?.animal) {
        Alert.alert(
          "Calving recorded",
          `${dam.name} calved. Calf ${calf.tag} created in ${calf.herd || "—"}.\n\nPhotograph the calf for its record?`,
          [
            {
              text: "Not now",
              style: "cancel",
              onPress: () => router.replace("/(tabs)/record/success?name=Calving"),
            },
            {
              text: "Take photo",
              onPress: async () => {
                const outcomePhoto = await captureAndAttachCalfPhoto(calf.animal);
                if (outcomePhoto.status === "attached") {
                  Alert.alert("Photo saved", `Attached to ${calf.tag}.`);
                } else if (outcomePhoto.status === "denied") {
                  Alert.alert(
                    "Camera not allowed",
                    "The birth is recorded. Allow camera access in your phone settings to add the photo later from the animal's page.",
                  );
                } else if (outcomePhoto.status === "failed") {
                  Alert.alert(
                    "Photo not saved",
                    `The birth is recorded. ${outcomePhoto.message}`,
                  );
                }
                router.replace("/(tabs)/record/success?name=Calving");
              },
            },
          ],
        );
        return;
      }

      Alert.alert("Calving recorded", `${dam.name} marked as calved (${outcome}).`);
      router.replace("/(tabs)/record/success?name=Calving");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="Calving" subtitle="Birth event from existing pregnancy" back>
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
          <Input value={todayISO()} editable={false} />
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
          <Banner tone="info">
            After you submit, you can photograph the calf and the picture goes
            straight onto its record.
          </Banner>
        </>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit calving"}
        disabled={mutation.isPending || !dam}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}
