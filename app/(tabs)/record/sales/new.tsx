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
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [price, setPrice] = useState("");
  const [buyer, setBuyer] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateAnimalDisposal();

  // Book value comes from the Animal record server-side; we surface the
  // sale price impact for the operator's confidence. The script computes
  // the actual gain_loss after pulling current_book_value.
  const p = Number(price) || 0;

  const handleSubmit = async () => {
    setError(null);
    if (!animal) return setError("Pick an animal to sell.");
    if (!buyer.trim()) return setError("Enter a buyer name.");
    if (p <= 0) return setError("Enter a sale price.");

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
      Alert.alert(
        r.queued ? "Queued offline" : "Sale recorded",
        r.queued
          ? `Sale saved locally. Will sync when online — Sales Invoice, Payment Entry and write-off JE will post then.`
          : `${animal.name} sold to ${buyer.trim()} for ${p.toLocaleString()} KES.\n\nFrappe will post the Sales Invoice, Payment Entry, and write-off JE.`,
      );
      router.replace("/(tabs)/record/success?name=Sale");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="Record sale" subtitle="Posts gain/loss to GL" back>
      <Field label="Animal to sell">
        <AnimalPickerButton value={animal} onPickSingle={setAnimal} />
      </Field>
      <FieldRow>
        <Field label="Date" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
        <Field label="Sale price (KES)" style={{ flex: 1 }}>
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
        <KV k="Sale price" v={`${p.toLocaleString()} KES`} />
        <KV k="Book value" v="(pulled from Animal record on submit)" />
        <KV k="Gain / loss" v="(computed by Frappe)" />
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit sale"}
        disabled={mutation.isPending || !animal}
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
