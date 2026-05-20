import { router } from "expo-router";
import React, { useState } from "react";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { APP } from "@/constants/theme";

export default function PD() {
  const [result, setResult] = useState<"Confirmed" | "Not pregnant" | "Aborted">("Confirmed");
  const [related, setRelated] = useState("(auto-populated from cow's last unconfirmed service)");

  return (
    <Screen title="Pregnancy diagnosis" subtitle="Confirm or rule out" back>
      <Field label="Cow">
        <AnimalPickerButton
          title="Select served cow"
          placeholder="Search served cow..."
          include={(a) => a.sex === "F"}
        />
      </Field>
      <Field label="Related service event">
        <Picker
          value={related}
          onChange={setRelated}
          options={["(auto-populated from cow's last unconfirmed service)", "TESTHF-001/24-Service-160113 · 9 Jul 2025"]}
        />
      </Field>
      <Field label="Diagnosis date"><Input value={APP.today} /></Field>
      <Field label="Result">
        <Chips>
          {(["Confirmed", "Not pregnant", "Aborted"] as const).map((r) => (
            <Chip key={r} label={r} active={result === r} onPress={() => setResult(r)} />
          ))}
        </Chips>
      </Field>
      <Field label="Remarks"><Textarea placeholder="Vet observations..." /></Field>
      <Button label="Submit PD" onPress={() => router.replace("/(tabs)/record/success?name=Pregnancy diagnosis")} />
    </Screen>
  );
}
