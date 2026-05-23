import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { COLORS, RADIUS } from "@/constants/theme";
import { useCreateAnimal } from "@/src/hooks/mutations";
import { useDefaultCompany } from "@/src/hooks/useDefaultCompany";
import { useHerds } from "@/src/hooks/useHerds";
import { extractFrappeError, todayISO } from "@/src/services/api";

const ORIGINS = ["Purchased", "Transferred In", "Born on Farm"] as const;
const REPRO = ["Heifer", "Calf", "Bull", "Open", "Pregnant", "Dry", "Served"] as const;

export default function NewAnimal() {
  const { data: company } = useDefaultCompany();
  const { data: herds = [] } = useHerds();

  const [tagNumber, setTagNumber] = useState("");
  const [burnName, setBurnName] = useState("");
  const [sex, setSex] = useState<"Female" | "Male">("Female");
  const [origin, setOrigin] = useState<(typeof ORIGINS)[number]>("Purchased");
  const [reproStatus, setReproStatus] = useState<string>("Heifer");
  const [currentHerd, setCurrentHerd] = useState<string>("");
  const [dob, setDob] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState(todayISO());
  const [birthWeight, setBirthWeight] = useState("");
  const [breed, setBreed] = useState<string>("");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [isCapitalised, setIsCapitalised] = useState(true);
  const [insuredValue, setInsuredValue] = useState("");
  const [coatColour, setCoatColour] = useState("");
  const [sireName, setSireName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentHerd && herds.length) setCurrentHerd(herds[0].n);
  }, [herds, currentHerd]);

  const mutation = useCreateAnimal();

  const handleSubmit = async () => {
    setError(null);
    if (!tagNumber.trim()) return setError("Tag / book number is required.");
    if (!burnName.trim()) return setError("Burn name (display name) is required.");
    if (!currentHerd) return setError("Pick a herd.");
    if (!company) return setError("Default company not loaded yet. Try again.");

    try {
      const r = await mutation.mutateAsync({
        tagNumber: tagNumber.trim(),
        burnName: burnName.trim(),
        sex,
        currentHerd,
        company,
        dateOfBirth: dob || undefined,
        origin,
        acquisitionDate: acquisitionDate || undefined,
        birthWeightKg: birthWeight ? Number(birthWeight) : undefined,
        coatColour: coatColour || undefined,
        sireName: sireName || undefined,
        isCapitalised: origin === "Purchased" ? isCapitalised : false,
        purchaseValue: purchaseValue ? Number(purchaseValue) : undefined,
        insuredValue: insuredValue ? Number(insuredValue) : undefined,
        reproStatus,
        remarks: remarks || undefined,
      });
      Alert.alert(
        r.queued ? "Queued offline" : "Animal created",
        r.queued
          ? `Saved locally. Will sync when online.`
          : `${burnName.trim()} (${tagNumber.trim()}) added to ${currentHerd}.${
              origin === "Purchased" && isCapitalised && purchaseValue
                ? "\nCapitalisation JE posted on submit."
                : ""
            }`,
      );
      router.replace(`/(tabs)/record/success?name=New animal`);
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="New animal" subtitle="Purchase, transfer in, or manual entry" back>
      <Banner tone="info">
        Use this for purchased animals or manual additions. Live calving births create their Animal
        record automatically via the Calving event.
      </Banner>

      <SectionTitle>Identity</SectionTitle>
      <FieldRow>
        <Field label="Tag / book number" style={{ flex: 1 }}>
          <Input
            value={tagNumber}
            onChangeText={setTagNumber}
            placeholder="e.g. PURCH-001/26"
            autoCapitalize="characters"
          />
        </Field>
        <Field label="Burn name" style={{ flex: 1 }}>
          <Input
            value={burnName}
            onChangeText={setBurnName}
            placeholder="e.g. EVITA"
            autoCapitalize="characters"
          />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Sex" style={{ flex: 1 }}>
          <Chips>
            <Chip label="Female" active={sex === "Female"} onPress={() => setSex("Female")} />
            <Chip label="Male" active={sex === "Male"} onPress={() => setSex("Male")} />
          </Chips>
        </Field>
        <Field label="Repro status" style={{ flex: 1 }}>
          <Picker value={reproStatus} onChange={setReproStatus} options={[...REPRO]} />
        </Field>
      </FieldRow>
      <Field label="Breed (optional)">
        <FrappeSearchPicker
          doctype="Breed"
          value={breed || null}
          onChange={(name) => setBreed(name)}
          fields={["name"]}
          icon="dna"
        />
      </Field>

      <SectionTitle>Placement</SectionTitle>
      <Field label="Current herd">
        <Picker value={currentHerd} onChange={setCurrentHerd} options={herds.map((h) => h.n)} />
      </Field>

      <SectionTitle>Origin</SectionTitle>
      <Field label="Origin">
        <Picker
          value={origin}
          onChange={(v) => setOrigin(v as (typeof ORIGINS)[number])}
          options={[...ORIGINS]}
        />
      </Field>
      <FieldRow>
        <Field label="Date of birth" style={{ flex: 1 }}>
          <Input value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="Acquisition date" style={{ flex: 1 }}>
          <Input value={acquisitionDate} onChangeText={setAcquisitionDate} placeholder="YYYY-MM-DD" />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Birth weight (kg)" style={{ flex: 1 }}>
          <Input value={birthWeight} onChangeText={setBirthWeight} keyboardType="numeric" placeholder="36" />
        </Field>
        <Field label="Coat colour" style={{ flex: 1 }}>
          <Input value={coatColour} onChangeText={setCoatColour} placeholder="Black & White" />
        </Field>
      </FieldRow>
      <Field label="Sire name (optional)">
        <Input value={sireName} onChangeText={setSireName} placeholder="Free text" />
      </Field>

      {origin === "Purchased" ? (
        <>
          <SectionTitle>Accounting</SectionTitle>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleTitle}>Capitalise on Fixed Asset register</Text>
              <Text style={s.toggleSub}>Posts the capitalisation JE on submit</Text>
            </View>
            <Chip
              label={isCapitalised ? "Yes" : "No"}
              active={isCapitalised}
              onPress={() => setIsCapitalised((v) => !v)}
            />
          </View>
          <FieldRow>
            <Field label="Purchase value (KES)" style={{ flex: 1 }}>
              <Input value={purchaseValue} onChangeText={setPurchaseValue} keyboardType="numeric" placeholder="0" />
            </Field>
            <Field label="Insured value (KES)" style={{ flex: 1 }}>
              <Input value={insuredValue} onChangeText={setInsuredValue} keyboardType="numeric" placeholder="0" />
            </Field>
          </FieldRow>
        </>
      ) : null}

      <SectionTitle>Remarks</SectionTitle>
      <Field>
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Optional notes" />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Creating…" : "Create animal"}
        disabled={mutation.isPending || !tagNumber.trim() || !burnName.trim()}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
  },
  toggleTitle: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  toggleSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
});
