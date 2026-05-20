import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { KV } from "@/components/KV";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { APP, COLORS, RADIUS } from "@/constants/theme";
import { herds } from "@/data/mock";

const SESSIONS = ["AM", "PM", "Full day"];

export default function AnimalFeed() {
  const [herdName, setHerdName] = useState(herds[0].n);
  const [session, setSession] = useState(SESSIONS[0]);

  const h = useMemo(() => herds.find((x) => x.n === herdName)!, [herdName]);

  // Default total feed delivered scales with the work order: herd headcount ×
  // BOM kg/head/day. Recompute whenever the user picks a different herd.
  const recommended = useMemo(() => Math.round(h.cnt * h.kgPerHeadPerDay), [h]);
  const [kg, setKg] = useState(String(recommended));
  useEffect(() => { setKg(String(recommended)); }, [recommended]);

  const kgNum = Number(kg) || 0;
  const perHead = h.cnt > 0 ? (kgNum / h.cnt).toFixed(1) : "0";

  return (
    <Screen title="Animal feeding" subtitle="Per herd · TMR / BOM" back>
      <Banner tone="info">
        Records the daily feed delivered to a herd. The ration breakdown comes from the herd's BOM —
        each herd has its own ratio.
      </Banner>
      <Field label="Herd"><Picker value={herdName} onChange={setHerdName} options={herds.map((x) => x.n)} /></Field>
      <View style={s.bom}>
        <Text style={s.bomLbl}>BOM / TMR</Text>
        <Text style={s.bomTitle}>{h.bom}</Text>
        <Text style={s.bomSub}>Cost centre: {h.cc}</Text>
        <Text style={s.bomSub}>Work order: {h.cnt} head × {h.kgPerHeadPerDay} kg/head = {recommended} kg/day</Text>
      </View>
      <FieldRow>
        <Field label="Date" style={{ flex: 1 }}><Input value={APP.today} /></Field>
        <Field label="Session" style={{ flex: 1 }}><Picker value={session} onChange={setSession} options={SESSIONS} /></Field>
      </FieldRow>
      <Field label="Total feed delivered (kg)" help={`~${perHead} kg per head · default from work order`}>
        <Input value={kg} onChangeText={setKg} keyboardType="numeric" />
      </Field>

      <SectionTitle>Ration breakdown · from {h.bom}</SectionTitle>
      <View style={s.box}>
        {h.ration.map((r) => (
          <KV
            key={r.name}
            k={`${r.name} ${r.pct}%`}
            v={`${Math.round(kgNum * r.pct / 100)} kg`}
          />
        ))}
      </View>
      <Field label="Remarks"><Textarea placeholder="Optional notes (silage quality, leftovers, etc.)" /></Field>
      <Button label="Submit feeding" onPress={() => router.replace("/(tabs)/record/success?name=Animal feeding")} />
    </Screen>
  );
}

const s = StyleSheet.create({
  bom: { backgroundColor: COLORS.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
  bomLbl: { fontSize: 11, color: COLORS.textMuted },
  bomTitle: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 3 },
  bomSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 5 },
  box: { backgroundColor: COLORS.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
});
