import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { APP, COLORS, RADIUS } from "@/constants/theme";

type FieldType = "picker" | "picker_single" | "birth_dam" | "weight_bcs" | "drugs" | "method" | "activity_cost" | "feet" | "reason" | "heat_signs" | "plan" | "calf";

const SPECS: Record<string, { title: string; fields: FieldType[] }> = {
  birth: { title: "Birth", fields: ["birth_dam", "calf", "activity_cost"] },
  weight: { title: "Weight recording", fields: ["picker", "weight_bcs"] },
  vaccination: { title: "Vaccination", fields: ["picker", "drugs"] },
  deworming: { title: "Deworming", fields: ["picker", "drugs"] },
  dehorning: { title: "Dehorning", fields: ["picker", "method", "activity_cost"] },
  hoof: { title: "Hoof trimming", fields: ["picker", "feet", "reason", "activity_cost"] },
  heat: { title: "Heat detection", fields: ["picker_single", "heat_signs", "plan"] },
};

export default function GenericEvent() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const spec = SPECS[type || ""];

  if (!spec) {
    return (
      <Screen title="Unknown event" back>
        <Banner tone="warning">No form configured for &quot;{type}&quot;.</Banner>
      </Screen>
    );
  }

  return (
    <Screen title={spec.title} subtitle="New event" back>
      <Field label="Date"><Input value={APP.today} /></Field>
      {spec.fields.map((f) => <FieldBlock key={f} kind={f} />)}
      <Field label="Remarks"><Textarea placeholder="Optional notes" /></Field>
      <Button
        label={`Submit ${spec.title.toLowerCase()}`}
        onPress={() => router.replace(`/(tabs)/record/success?name=${encodeURIComponent(spec.title)}`)}
      />
    </Screen>
  );
}

function FieldBlock({ kind }: { kind: FieldType }) {
  const [feet, setFeet] = useState("All four");
  const [reason, setReason] = useState("Routine");
  const [method, setMethod] = useState("Hot iron");
  const [plan, setPlan] = useState("Next 12-18h");
  const [sex, setSex] = useState<"Female" | "Male">("Female");

  switch (kind) {
    case "picker":
      return <Field label="Animal(s)"><AnimalPickerButton mode="multi" placeholder="Single animal or many..." /></Field>;
    case "picker_single":
      return <Field label="Animal"><AnimalPickerButton mode="single" /></Field>;
    case "birth_dam":
      return (
        <Field label="Dam (mother)">
          <AnimalPickerButton title="Select dam" include={(a) => a.sex === "F" && a.parity > 0} placeholder="Search dam..." />
        </Field>
      );
    case "weight_bcs":
      return (
        <FieldRow>
          <Field label="Weight (kg)" style={{ flex: 1 }}><Input keyboardType="numeric" placeholder="480" /></Field>
          <Field label="BCS (1-5)" style={{ flex: 1 }}><Input keyboardType="numeric" placeholder="3.5" /></Field>
        </FieldRow>
      );
    case "drugs":
      return (
        <Field label="Drugs administered (Items)">
          <View style={s.drugBox}>
            <View style={s.drugTop}>
              <Text style={s.drugName}>FMD Vaccine (Quadrivalent)</Text>
              <Text style={s.drugPrice}>320 KES</Text>
            </View>
            <Text style={s.drugMeta}>2 ml SC · Batch FMD-26-B201 · 0d wd</Text>
          </View>
          <View style={s.drugBox}>
            <View style={s.drugTop}>
              <Text style={s.drugName}>LSD Vaccine</Text>
              <Text style={s.drugPrice}>280 KES</Text>
            </View>
            <Text style={s.drugMeta}>3 ml SC · Batch LSD-26-A012 · 0d wd</Text>
          </View>
          <Button label="Add drug" icon="plus" variant="link" />
        </Field>
      );
    case "method":
      return (
        <Field label="Method">
          <Chips>
            {["Hot iron", "Caustic paste", "Surgical"].map((m) => (
              <Chip key={m} label={m} active={method === m} onPress={() => setMethod(m)} />
            ))}
          </Chips>
        </Field>
      );
    case "activity_cost":
      return <Field label="Activity cost (KES)"><Input keyboardType="numeric" placeholder="0" /></Field>;
    case "feet":
      return (
        <Field label="Feet">
          <Chips>
            {["Front-L", "Front-R", "Hind-L", "Hind-R", "All four"].map((f) => (
              <Chip key={f} label={f} active={feet === f} onPress={() => setFeet(f)} />
            ))}
          </Chips>
        </Field>
      );
    case "reason":
      return (
        <Field label="Reason">
          <Chips>
            {["Routine", "Lameness", "Overgrowth"].map((r) => (
              <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} />
            ))}
          </Chips>
        </Field>
      );
    case "heat_signs":
      return <Field label="Heat signs"><Textarea placeholder="Mounting, mucus, restless, vulva swelling..." /></Field>;
    case "plan":
      return (
        <Field label="Plan">
          <Chips>
            {["Now", "Next 12-18h", "Skip cycle"].map((p) => (
              <Chip key={p} label={p} active={plan === p} onPress={() => setPlan(p)} />
            ))}
          </Chips>
        </Field>
      );
    case "calf":
      return (
        <>
          <Field label="Calf book number"><Input placeholder="e.g. A001/26" /></Field>
          <FieldRow>
            <Field label="Calf burn name" style={{ flex: 1 }}><Input placeholder="e.g. BLOSSOM" /></Field>
            <Field label="Sex" style={{ flex: 1 }}>
              <Chips>
                <Chip label="Female" active={sex === "Female"} onPress={() => setSex("Female")} />
                <Chip label="Male" active={sex === "Male"} onPress={() => setSex("Male")} />
              </Chips>
            </Field>
          </FieldRow>
          <Field label="Birth weight (kg)"><Input keyboardType="numeric" placeholder="36" /></Field>
        </>
      );
  }
}

const s = StyleSheet.create({
  drugBox: {
    backgroundColor: COLORS.bgMuted,
    padding: 11,
    borderRadius: RADIUS.md,
    marginBottom: 7,
  },
  drugTop: { flexDirection: "row", justifyContent: "space-between" },
  drugName: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  drugPrice: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  drugMeta: { fontSize: 10, color: COLORS.textMuted, marginTop: 4 },
});
