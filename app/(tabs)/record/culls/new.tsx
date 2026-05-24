import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { KV } from "@/components/KV";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { COLORS, RADIUS } from "@/constants/theme";
import type { DisposalType } from "@/src/frappe/animalDisposal";
import { useCreateAnimalDisposal } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

const TYPES: DisposalType[] = [
  "Culled (Farm Use)",
  "Died — Natural Causes",
  "Died — Disease",
  "Died — Accident",
  "Condemned",
  "Slaughtered",
];

export default function CullNew() {
  const [selected, setSelected] = useState<Animal[]>([]);
  const [type, setType] = useState<DisposalType>(TYPES[0]);
  const [salvage, setSalvage] = useState("");
  const [reason, setReason] = useState("");
  const [witness, setWitness] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalDisposal();
  const sVal = Number(salvage) || 0;

  const handleSubmit = async () => {
    setError(null);
    if (selected.length === 0) return setError("Pick at least one animal.");

    let succeeded = 0;
    let queued = 0;
    const completed: string[] = [];

    for (const animal of selected) {
      try {
        const r = await mutation.mutateAsync({
          animal: animal.id,
          animalName: animal.name,
          disposalType: type,
          disposalDate: todayISO(),
          salePrice: sVal > 0 ? sVal : undefined,
          reasonDetails: reason.trim() || undefined,
          witness: witness.trim() || undefined,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
        completed.push(animal.name);
      } catch (err) {
        setError(
          `${completed.length} of ${selected.length} disposed. Stopped at ${animal.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }

    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} marked ${type}`);
    if (queued) parts.push(`${queued} queued (offline)`);
    Alert.alert(
      "Disposal recorded",
      `${parts.join(" · ")}\n${succeeded > 0 ? "Write-off JE posted per animal; insurance JE for any covered animals." : ""}`,
    );
    router.replace("/(tabs)/record/success?name=Cull / death");
  };

  return (
    <Screen title="Record cull / death" subtitle="Write-off to expense" back>
      <Banner tone="warning">
        Submitting removes the animals from active herds and writes off their book values. If
        insurance is on the animal, Frappe also posts the insurance receivable JE.
      </Banner>
      <Field
        label="Animals"
        help="Pick one, several, or a whole herd via the By-herd tab. Same disposal type applied to each."
      >
        <AnimalPickerButton
          mode="multi"
          title="Select animals"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search by tag or name…"}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <Field label="Type">
        <Picker value={type} onChange={(v) => setType(v as DisposalType)} options={TYPES} />
      </Field>
      <FieldRow>
        <Field label="Date" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
        <Field label="Salvage value per animal (KES)" style={{ flex: 1 }}>
          <Input value={salvage} onChangeText={setSalvage} keyboardType="numeric" placeholder="0" />
        </Field>
      </FieldRow>
      <Field label="Reason / cause">
        <Textarea
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Chronic mastitis, low yield, BCS critical..."
        />
      </Field>
      <Field label="Witness / authorised by">
        <Input value={witness} onChangeText={setWitness} placeholder="Manager or vet name" />
      </Field>
      <View style={styles.box}>
        <KV k="Animals" v={String(selected.length)} />
        <KV k="Salvage per animal" v={`${sVal.toLocaleString()} KES`} />
        <KV k="Total salvage" v={`${(sVal * selected.length).toLocaleString()} KES`} />
        <KV k="Book values" v="(pulled per animal on submit)" />
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        variant="danger"
        onPress={handleSubmit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: COLORS.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
});
