import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { useAuthStore } from "@/src/auth/authStore";
import { useAnimals } from "@/src/hooks/useAnimals";
import { useCreateAnimalEvent } from "@/src/hooks/mutations";
import { useHerds } from "@/src/hooks/useHerds";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

export default function Calving() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);
  const { data: animals = [] } = useAnimals();
  const { data: herds = [] } = useHerds();

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [dam, setDam] = useState<Animal | null>(null);
  const [outcome, setOutcome] = useState<"Live Birth" | "Still Birth" | "Abortion">("Live Birth");
  const [sex, setSex] = useState<"Female" | "Male">("Female");
  const [calfBook, setCalfBook] = useState("");
  const [calfName, setCalfName] = useState("");
  const [birthWt, setBirthWt] = useState("");
  const [coatColour, setCoatColour] = useState("");
  const [toHerd, setToHerd] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const pregnantCount = animals.filter((a) => a.pregnant).length;

  // Default dam-destination to a milking herd if there is one.
  useEffect(() => {
    if (!toHerd && herds.length) {
      const milking = herds.find((h) => h.isMilking);
      setToHerd(milking?.n ?? herds[0].n);
    }
  }, [herds, toHerd]);

  const mutation = useCreateAnimalEvent();

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (!dam) return setError("Pick the dam (mother).");
    if (outcome === "Live Birth" && (!calfBook.trim() || !calfName.trim())) {
      return setError("Live births need a calf book number and burn name — the server uses these to create the Animal record.");
    }
    if (operator !== defaultOperator) await setStoredOperator(operator);

    try {
      await mutation.mutateAsync({
        eventType: "Calving",
        animal: dam.id,
        currentHerd: dam.herd,
        operator,
        eventDate: todayISO(),
        calvingOutcome: outcome,
        toHerd: toHerd || undefined,
        calfBookNumber: outcome === "Live Birth" ? calfBook.trim() : undefined,
        calfBurnName: outcome === "Live Birth" ? calfName.trim() : undefined,
        calfGender: outcome === "Live Birth" ? sex : undefined,
        birthWeightKg: birthWt ? Number(birthWt) : undefined,
        coatColour: coatColour || undefined,
      });
      Alert.alert(
        "Calving recorded",
        outcome === "Live Birth"
          ? `${dam.name} calved. Calf ${calfName} (${calfBook}) created.`
          : `${dam.name} marked as calved (${outcome}).`,
      );
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

      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>

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

      <Field label="Dam moves to herd">
        <Picker value={toHerd} onChange={setToHerd} options={herds.map((h) => h.n)} />
      </Field>

      {outcome === "Live Birth" ? (
        <>
          <SectionTitle>Calf details</SectionTitle>
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
