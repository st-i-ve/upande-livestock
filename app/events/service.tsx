import { router } from "expo-router";
import React, { useState } from "react";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Button } from "@/components/Button";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { APP } from "@/constants/theme";
import { semenItems } from "@/data/mock";

export default function Service() {
  const [type, setType] = useState("A.I.");
  const [straw, setStraw] = useState(semenItems[0]);
  const [sire, setSire] = useState("(none)");
  return (
    <Screen title="Service / AI" subtitle="Issue semen straw" back>
      <Field label="Cow">
        <AnimalPickerButton
          title="Select cow (eligible only)"
          placeholder="Search cow on heat..."
          include={(a) => a.sex === "F" && !a.pregnant && a.repro !== "Calf"}
        />
      </Field>
      <FieldRow>
        <Field label="Service date" style={{ flex: 1 }}><Input value={APP.today} /></Field>
        <Field label="Type" style={{ flex: 1 }}><Picker value={type} onChange={setType} options={["A.I.", "Natural"]} /></Field>
      </FieldRow>
      <Field label="Semen straw (Item)" help="Link to Item master · stock-managed · 1 straw issued from Stores - WDL on submit.">
        <Picker value={straw} onChange={setStraw} options={semenItems} />
      </Field>
      <Field label="Sire (catalog · optional)">
        <Picker value={sire} onChange={setSire} options={["(none)", "Delta Stormer (Holstein)", "Delta Keen (Holstein)"]} />
      </Field>
      <Field label="Remarks"><Textarea placeholder="Heat signs, technician notes..." /></Field>
      <Button label="Submit service" onPress={() => router.replace("/event-success?name=Service")} />
    </Screen>
  );
}
