import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { KV } from "@/components/KV";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { APP, COLORS, RADIUS } from "@/constants/theme";

const TYPES = ["Culled (Farm Use)", "Died — Natural Causes", "Died — Disease", "Died — Accident", "Condemned", "Slaughtered"];

export default function CullNew() {
  const [type, setType] = useState<string>(TYPES[0]);

  return (
    <Screen title="Record cull / death" subtitle="Write-off to expense" back>
      <Banner tone="warning">
        This removes the animal from the active herd and writes off its book value. No proceeds; cannot be undone except by amend/cancel.
      </Banner>
      <Field label="Animal">
        <AnimalPickerButton />
      </Field>
      <Field label="Type">
        <Picker value={type} onChange={setType} options={TYPES} />
      </Field>
      <FieldRow>
        <Field label="Date" style={{ flex: 1 }}><Input value={APP.today} /></Field>
        <Field label="Salvage value" style={{ flex: 1 }}><Input keyboardType="numeric" placeholder="0" /></Field>
      </FieldRow>
      <Field label="Reason / cause">
        <Textarea placeholder="e.g. Chronic mastitis, low yield, BCS critical..." />
      </Field>
      <Field label="Witness / authorised by">
        <Input placeholder="Manager or vet name" />
      </Field>
      <View style={s.box}>
        <KV k="Book value" v="120,000 KES" />
        <KV k="Salvage" v="0 KES" />
        <KV k="Loss to expense" v="−120,000 KES" vColor={COLORS.danger} />
      </View>
      <Button label="Submit" variant="danger" onPress={() => router.replace("/(tabs)/record/success?name=Cull / death")} />
    </Screen>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: COLORS.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
});
