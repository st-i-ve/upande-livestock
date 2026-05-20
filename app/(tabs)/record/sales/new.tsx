import { router } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Button } from "@/components/Button";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { KV } from "@/components/KV";
import { Screen } from "@/components/Screen";
import { APP, COLORS, RADIUS } from "@/constants/theme";

export default function SaleNew() {
  const [price, setPrice] = useState("95000");
  const book = 120000;
  const p = Number(price) || 0;
  const gl = p - book;

  return (
    <Screen title="Record sale" subtitle="Posts gain/loss to GL" back>
      <Field label="Animal to sell">
        <AnimalPickerButton />
      </Field>
      <FieldRow>
        <Field label="Date" style={{ flex: 1 }}>
          <Input value={APP.today} />
        </Field>
        <Field label="Sale price (KES)" style={{ flex: 1 }}>
          <Input value={price} onChangeText={setPrice} keyboardType="numeric" />
        </Field>
      </FieldRow>
      <Field label="Buyer name">
        <Input placeholder="Buyer / butchery / co-op" />
      </Field>
      <Field label="Buyer phone">
        <Input placeholder="+254..." keyboardType="phone-pad" />
      </Field>
      <Field label="Reason / notes">
        <Textarea placeholder="End of productive life, surplus, etc." />
      </Field>
      <View style={s.box}>
        <KV k="Book value" v="120,000 KES" />
        <KV k="Sale price" v={`${p.toLocaleString()} KES`} />
        <KV
          k="Gain / loss"
          v={`${gl >= 0 ? "+" : ""}${gl.toLocaleString()} KES`}
          vColor={gl < 0 ? COLORS.danger : undefined}
        />
      </View>
      <Button label="Submit sale" onPress={() => router.replace("/(tabs)/record/success?name=Sale")} />
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
