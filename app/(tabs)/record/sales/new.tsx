import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { KV } from "@/components/KV";
import { Screen } from "@/components/Screen";
import { COLORS, RADIUS } from "@/constants/theme";
import { useCreateAnimalDisposal } from "@/src/hooks/mutations";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

export default function SaleNew() {
  const [selected, setSelected] = useState<Animal[]>([]);
  const [price, setPrice] = useState("");
  const [buyer, setBuyer] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalDisposal();

  const p = Number(price) || 0;
  const totalProceeds = p * selected.length;

  const handleSubmit = async () => {
    setError(null);
    if (selected.length === 0) return setError("Pick at least one animal to sell.");
    if (!buyer.trim()) return setError("Enter a buyer name.");
    if (p <= 0) return setError("Enter a sale price per animal.");

    let succeeded = 0;
    let queued = 0;
    const completed: string[] = [];

    for (const animal of selected) {
      try {
        const r = await mutation.mutateAsync({
          animal: animal.id,
          animalName: animal.name,
          disposalType: "Sold",
          disposalDate: todayISO(),
          salePrice: p,
          buyerName: buyer.trim(),
          buyerContact: phone.trim() || undefined,
          reasonDetails: reason.trim() || undefined,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
        completed.push(animal.name);
      } catch (err) {
        setError(
          `${completed.length} of ${selected.length} sold. Stopped at ${animal.name}: ${extractFrappeError(err)}`,
        );
        return;
      }
    }

    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} sold to ${buyer.trim()}`);
    if (queued) parts.push(`${queued} queued (offline)`);
    Alert.alert(
      "Sale recorded",
      `${parts.join(" · ")}\n${succeeded > 0 ? `Sales Invoice + Payment Entry + write-off JE posted per animal.` : ""}`,
    );
    router.replace("/(tabs)/record/success?name=Sale");
  };

  return (
    <Screen title="Record sale" subtitle="Posts gain/loss to GL" back>
      <Field
        label="Animals to sell"
        help="Pick one cow, several, or a whole herd via the By-herd tab. Same buyer + price applied to each."
      >
        <AnimalPickerButton
          mode="multi"
          title="Select animals to sell"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search by tag or name…"}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <FieldRow>
        <Field label="Date" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
        <Field label="Price per animal (KES)" style={{ flex: 1 }}>
          <Input value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0" />
        </Field>
      </FieldRow>
      <Field label="Buyer name">
        <Input value={buyer} onChangeText={setBuyer} placeholder="Buyer / butchery / co-op" />
      </Field>
      <Field label="Buyer phone">
        <Input value={phone} onChangeText={setPhone} placeholder="+254..." keyboardType="phone-pad" />
      </Field>
      <Field label="Reason / notes">
        <Textarea value={reason} onChangeText={setReason} placeholder="End of productive life, surplus, etc." />
      </Field>
      <View style={s.box}>
        <KV k="Animals selected" v={String(selected.length)} />
        <KV k="Price per animal" v={`${p.toLocaleString()} KES`} />
        <KV k="Total proceeds" v={`${totalProceeds.toLocaleString()} KES`} />
        <KV k="Book values" v="(pulled per animal on submit)" />
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit sale"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: COLORS.bgMuted,
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 12,
  },
});
