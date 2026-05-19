import { router } from "expo-router";
import React, { useState } from "react";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { APP } from "@/constants/theme";
import { animals } from "@/data/mock";

export default function Calving() {
  const pregnant = animals.filter((a) => a.pregnant);
  const [outcome, setOutcome] = useState("Live birth");
  const [sex, setSex] = useState<"Female" | "Male">("Female");

  return (
    <Screen title="Calving" subtitle="Birth event from existing pregnancy" back>
      {pregnant.length === 0 ? (
        <Banner tone="warning">No pregnant cows on record.</Banner>
      ) : null}

      <Field label="Dam (mother)" help="If your cow isn't here, she has no pregnancy on record. Use the + button to add a Pregnancy Diagnosis first.">
        <AnimalPickerButton
          title="Select dam (pregnant only)"
          placeholder="Search pregnant cow..."
          include={(a) => a.pregnant === 1}
          emptyAction={{ label: "Add pregnancy", onPress: () => router.push("/events/pd") }}
        />
      </Field>

      <FieldRow>
        <Field label="Calving date" style={{ flex: 1 }}><Input value={APP.today} /></Field>
        <Field label="Outcome" style={{ flex: 1 }}>
          <Picker value={outcome} onChange={setOutcome} options={["Live birth", "Stillbirth", "Abortion"]} />
        </Field>
      </FieldRow>

      <SectionTitle>Calf details</SectionTitle>
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
      <FieldRow>
        <Field label="Birth weight (kg)" style={{ flex: 1 }}><Input keyboardType="numeric" placeholder="36" /></Field>
        <Field label="Coat colour" style={{ flex: 1 }}><Input placeholder="Black & White" /></Field>
      </FieldRow>
      <Field label="Number of calves"><Input keyboardType="numeric" defaultValue="1" /></Field>

      <Button label="Submit calving" onPress={() => router.replace("/event-success?name=Calving")} />
    </Screen>
  );
}
