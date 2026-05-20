import { router } from "expo-router";
import React, { useState } from "react";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Button } from "@/components/Button";
import { Field, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { APP } from "@/constants/theme";

const SEVERITIES = ["Mild", "Moderate", "Severe"] as const;

export default function CaseNew() {
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("Moderate");

  return (
    <Screen title="New health case" subtitle="Opens an active case in the action queue" back>
      <Field label="Animal">
        <AnimalPickerButton />
      </Field>
      <Field label="Date">
        <Input value={APP.today} />
      </Field>
      <Field label="Condition">
        <Input placeholder="Mastitis, lameness, ..." />
      </Field>
      <Field label="Severity">
        <Picker value={severity} onChange={setSeverity} options={[...SEVERITIES]} />
      </Field>
      <Field label="Notes">
        <Textarea placeholder="Observations, treatment plan, ..." />
      </Field>
      <Button label="Open case" onPress={() => router.replace("/(tabs)/record/success?name=Health case")} />
    </Screen>
  );
}
