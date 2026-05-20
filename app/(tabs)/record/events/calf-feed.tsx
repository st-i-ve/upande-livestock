import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Calc } from "@/components/Calc";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { SearchPicker } from "@/components/SearchPicker";
import { Screen } from "@/components/Screen";
import { COLORS } from "@/constants/theme";
import { animals, feedStockItems, warehouses } from "@/data/mock";
import { ageDays, initials } from "@/services/utils";

const FEED_TYPES = ["Colostrum", "Transitional Milk", "Whole Milk", "Milk Replacer", "Starter Feed"];

export default function CalfFeed() {
  const calf = animals.find((a) => a.repro === "Calf")!;
  const days = ageDays(calf.dob);

  const plan = useMemo(() => {
    if (days <= 1) return { rec: (calf.lastWt * 0.10 / 2).toFixed(1), ft: "Colostrum",          phase: "Day 1 — first feed within 6h", formula: "10% birth weight ÷ 2",        item: "Colostrum (kg)",            wh: "Stores - WDL" };
    if (days <= 5) return { rec: (calf.lastWt * 0.05 / 2).toFixed(1), ft: "Transitional Milk",  phase: "Days 2-5",                     formula: "5% body weight ÷ 2",          item: "WestWood Dairy Milk (kg)",  wh: "Finished Goods - WDL" };
    if (days <= 60) return { rec: (calf.lastWt * 0.10 / 2).toFixed(1), ft: "Whole Milk",         phase: "Pre-weaning",                  formula: "10% body weight ÷ 2",         item: "WestWood Dairy Milk (kg)",  wh: "Finished Goods - WDL" };
    if (days <= 90) {
      const tp = 1 - (days - 60) / 30;
      return { rec: (calf.lastWt * 0.10 * tp / 2).toFixed(1), ft: "Whole Milk", phase: "Weaning taper", formula: "Tapering linearly to day 90", item: "WestWood Dairy Milk (kg)", wh: "Finished Goods - WDL" };
    }
    return { rec: "0", ft: "Starter Feed", phase: "Weaned", formula: "Whole milk feeding ended", item: "Calf starter pellets", wh: "Stores - WDL" };
  }, [days, calf.lastWt]);

  const [feedType, setFeedType] = useState(plan.ft);
  const [item, setItem] = useState(plan.item);
  const [wh, setWh] = useState(plan.wh);
  const [qty, setQty] = useState(plan.rec);
  const [session, setSession] = useState<"Morning" | "Evening">("Morning");

  return (
    <Screen title="Calf feeding" subtitle={calf.name} back>
      <View style={s.head}>
        <Avatar text={initials(calf.name)} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{calf.name}</Text>
          <Text style={s.meta}>{days} days · {calf.lastWt} kg · {calf.herd}</Text>
        </View>
      </View>

      <Calc
        label={`Recommended · ${plan.phase}`}
        value={`${plan.rec} kg ${plan.ft}`}
        footer={`${plan.formula} · per Livestock Settings`}
      />

      <Field label="Feed type"><Picker value={feedType} onChange={setFeedType} options={FEED_TYPES} /></Field>
      <Field label="Feed item (stock)" help="Search the stock master. Issued from source warehouse on submit.">
        <SearchPicker
          value={item}
          onChange={setItem}
          options={feedStockItems}
          title="Search stock items"
          searchPlaceholder="Type to filter feed items"
        />
      </Field>
      <FieldRow>
        <Field label="Source warehouse" style={{ flex: 1 }}>
          <SearchPicker value={wh} onChange={setWh} options={warehouses} title="Source warehouse" />
        </Field>
        <Field label="Session" style={{ flex: 1 }}>
          <Chips>
            <Chip label="Morning" active={session === "Morning"} onPress={() => setSession("Morning")} />
            <Chip label="Evening" active={session === "Evening"} onPress={() => setSession("Evening")} />
          </Chips>
        </Field>
      </FieldRow>
      <Field label="Quantity fed (kg)"><Input value={qty} onChangeText={setQty} keyboardType="numeric" /></Field>
      <Field label="Remarks (optional)"><Textarea placeholder="Optional notes" /></Field>

      <Button label="Submit" onPress={() => router.replace("/(tabs)/record/success?name=Calf feeding")} />
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  name: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  meta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
});
