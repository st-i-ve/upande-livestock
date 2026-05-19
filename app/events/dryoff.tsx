import { router } from "expo-router";
import React, { useState } from "react";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { APP } from "@/constants/theme";

export default function Dryoff() {
  const [from, setFrom] = useState("Lactating group 1");
  const [therapy, setTherapy] = useState("Cloxacillin LA · all 4 quarters");
  return (
    <Screen title="Drying off" subtitle="From a milking herd" back>
      <Banner tone="info">The destination herd is automatic — STEAMERS, set in Livestock Settings.</Banner>
      <Field label="Cow(s) to dry off">
        <AnimalPickerButton
          mode="multi"
          title="Select cows (lactating only)"
          placeholder="Search lactating cows..."
          include={(a) => a.repro === "Lactating" || a.repro === "Fresh / Lactating"}
        />
      </Field>
      <Field label="From herd"><Picker value={from} onChange={setFrom} options={["Lactating group 1", "LACTATION GROUP 2", "Super high yielders"]} /></Field>
      <Field label="Date"><Input value={APP.today} /></Field>
      <Field label="Dry-cow therapy">
        <Picker value={therapy} onChange={setTherapy} options={["Cloxacillin LA · all 4 quarters", "Cefquinome LA · all 4 quarters", "None — natural dry-off"]} />
      </Field>
      <Button label="Submit dry-off" onPress={() => router.replace("/event-success?name=Drying off")} />
    </Screen>
  );
}
