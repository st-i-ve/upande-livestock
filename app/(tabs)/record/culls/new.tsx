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

// Exact strings the DocType accepts (em-dashes, no hyphens).
const TYPES: DisposalType[] = [
  "Culled (Farm Use)",
  "Died — Natural Causes",
  "Died — Disease",
  "Died — Accident",
  "Condemned",
  "Slaughtered",
];

export default function CullNew() {
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [type, setType] = useState<DisposalType>(TYPES[0]);
  const [salvage, setSalvage] = useState("");
  const [reason, setReason] = useState("");
  const [witness, setWitness] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalDisposal();
  const s = Number(salvage) || 0;

  const handleSubmit = async () => {
    setError(null);
    if (!animal) return setError("Pick an animal.");

    try {
      await mutation.mutateAsync({
        animal: animal.id,
        animalName: animal.name,
        disposalType: type,
        disposalDate: todayISO(),
        salePrice: s > 0 ? s : undefined,
        reasonDetails: reason.trim() || undefined,
        witness: witness.trim() || undefined,
      });
      Alert.alert(
        "Disposal recorded",
        `${animal.name} marked ${type}.\n\nFrappe will post the write-off JE and (if insured) the insurance receivable JE.`,
      );
      router.replace("/(tabs)/record/success?name=Cull / death");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="Record cull / death" subtitle="Write-off to expense" back>
      <Banner tone="warning">
        This removes the animal from the active herd and writes off its book value. If insurance is on
        the animal, Frappe also posts the insurance receivable JE automatically.
      </Banner>
      <Field label="Animal">
        <AnimalPickerButton value={animal} onPickSingle={setAnimal} />
      </Field>
      <Field label="Type">
        <Picker value={type} onChange={(v) => setType(v as DisposalType)} options={TYPES} />
      </Field>
      <FieldRow>
        <Field label="Date" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
        <Field label="Salvage value (KES)" style={{ flex: 1 }}>
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
        <KV k="Salvage value" v={`${s.toLocaleString()} KES`} />
        <KV k="Book value" v="(pulled from Animal record on submit)" />
        <KV k="Net loss" v="(computed by Frappe; insurance JE if covered)" />
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit"}
        disabled={mutation.isPending || !animal}
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
