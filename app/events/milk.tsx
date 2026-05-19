import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Calc } from "@/components/Calc";
import { Field, FieldRow, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { APP, COLORS, RADIUS } from "@/constants/theme";

const HERDS = ["Lactating group 1", "LACTATION GROUP 2", "Super high yielders"];
const SESSIONS = ["Morning", "Evening"];

export default function Milk() {
  const [herd, setHerd] = useState(HERDS[0]);
  const [session, setSession] = useState(SESSIONS[0]);
  // Empty by default — operator enters the day's collection per herd. Only
  // computed values appear once they've typed something in.
  const [total, setTotal] = useState("");
  const [discard, setDiscard] = useState("");
  const [colostrum, setColostrum] = useState("");
  const [allCol, setAllCol] = useState(false);

  const t = Number(total) || 0;
  const d = Number(discard) || 0;
  const ck = allCol ? Math.max(t - d, 0) : Number(colostrum) || 0;
  const m = Math.max(t - d - ck, 0);
  const rev = Math.round(m * APP.milkPriceKES);
  const hasInput = total !== "" || discard !== "" || colostrum !== "" || allCol;

  return (
    <Screen title="Milk recording" subtitle={`${herd} · ${session}`} back>
      <Banner tone="warning">
        <Text style={{ fontWeight: "700" }}>1 cow in withdrawal</Text> · TEST IVY · plan to discard her share
      </Banner>
      <Field label="Herd"><Picker value={herd} onChange={setHerd} options={HERDS} /></Field>
      <FieldRow>
        <Field label="Session" style={{ flex: 1 }}><Picker value={session} onChange={setSession} options={SESSIONS} /></Field>
        <Field label="Date" style={{ flex: 1 }}><Input value={APP.today} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Total yield (kg)" style={{ flex: 1 }}>
          <Input value={total} onChangeText={setTotal} keyboardType="numeric" placeholder="0" />
        </Field>
        <Field label="Discard (kg)" style={{ flex: 1 }}>
          <Input value={discard} onChangeText={setDiscard} keyboardType="numeric" placeholder="0" />
        </Field>
      </FieldRow>

      <View style={s.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.toggleTitle}>Entire session is colostrum</Text>
          <Text style={s.toggleSub}>Posts to Colostrum (kg) item</Text>
        </View>
        <Pressable
          onPress={() => setAllCol((v) => !v)}
          style={[s.toggle, allCol && { backgroundColor: COLORS.text }]}
        >
          <View style={[s.knob, allCol && { transform: [{ translateX: 16 }] }]} />
        </Pressable>
      </View>

      <Field
        label="Colostrum portion (kg) — hybrid"
        help="If part of the herd's yield is colostrum (e.g. one fresh cow joined). Leave blank if none."
      >
        <Input
          value={colostrum}
          onChangeText={setColostrum}
          keyboardType="numeric"
          placeholder="0"
          editable={!allCol}
        />
      </Field>

      {/* Calc only fills in once the operator has put numbers; otherwise the
          collection is the input default of 0 across all fields. */}
      {hasInput ? (
        allCol ? (
          <Calc
            label="All yield → Colostrum bank"
            value={`${(t - d).toFixed(1)} kg`}
            footer="Not sellable · 0 KES revenue"
          />
        ) : (
          <Calc
            label={`Net sellable milk · ${herd} · ${session}`}
            value={`${m.toFixed(1)} kg → ${rev.toLocaleString()} KES`}
            footer={`${t} − ${d} discard${ck ? ` − ${ck} colostrum` : ""}`}
          />
        )
      ) : (
        <Calc
          label={`Net sellable milk · ${herd} · ${session}`}
          value="0 kg → 0 KES"
          footer="Enter the day's collection above"
        />
      )}

      <Button label="Submit recording" onPress={() => router.replace("/event-success?name=Milk recording")} />
    </Screen>
  );
}

const s = StyleSheet.create({
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.bgMuted, borderRadius: RADIUS.md, marginBottom: 8,
  },
  toggleTitle: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  toggleSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  toggle: { width: 36, height: 20, borderRadius: 999, backgroundColor: COLORS.border, justifyContent: "center" },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.bg, marginLeft: 2 },
});
