import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Calc } from "@/components/Calc";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { APP, COLORS, RADIUS } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { useCreateMilkRecording } from "@/src/hooks/mutations";
import { useHerds } from "@/src/hooks/useHerds";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { MilkSession } from "@/src/frappe/milkRecording";

const SESSIONS: MilkSession[] = ["AM — Morning", "PM — Afternoon", "Evening"];

export default function Milk() {
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);
  const { data: herds = [] } = useHerds();
  const milkingHerds = herds.filter((h) => h.isMilking);

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [herd, setHerd] = useState<string>("");
  const [session, setSession] = useState<MilkSession>(SESSIONS[0]);
  const [total, setTotal] = useState("");
  const [discard, setDiscard] = useState("");
  const [colostrum, setColostrum] = useState("");
  const [allCol, setAllCol] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!herd) {
      const first = milkingHerds[0] ?? herds[0];
      if (first) setHerd(first.n);
    }
  }, [herds, milkingHerds, herd]);

  const t = Number(total) || 0;
  const d = Number(discard) || 0;
  const ck = allCol ? Math.max(t - d, 0) : Number(colostrum) || 0;
  const m = Math.max(t - d - ck, 0);
  const rev = Math.round(m * APP.milkPriceKES);
  const hasInput = total !== "" || discard !== "" || colostrum !== "" || allCol;

  const mutation = useCreateMilkRecording();

  const selectedHerd = herds.find((h) => h.n === herd);
  const cowsMilked = selectedHerd?.cnt ?? undefined;

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (!herd) return setError("Pick a herd.");
    if (t <= 0) return setError("Enter the total yield (kg).");
    if (operator !== defaultOperator) await setStoredOperator(operator);

    try {
      await mutation.mutateAsync({
        herd,
        session,
        recordingDate: todayISO(),
        totalYieldKg: t,
        discardedKg: d || undefined,
        colostrumYieldKg: !allCol && ck > 0 ? ck : undefined,
        isColostrum: allCol,
        pricePerKg: APP.milkPriceKES,
        cowsMilked,
        operator,
      });
      Alert.alert(
        "Milk recording submitted",
        allCol
          ? `${(t - d).toFixed(1)} kg → Colostrum bank.`
          : `${m.toFixed(1)} kg sellable · ${rev.toLocaleString()} KES revenue.`,
      );
      router.replace("/(tabs)/record/success?name=Milk recording");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="Milk recording" subtitle={`${herd || "—"} · ${session}`} back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field label="Herd">
        <Picker value={herd} onChange={setHerd} options={(milkingHerds.length ? milkingHerds : herds).map((h) => h.n)} />
      </Field>
      <FieldRow>
        <Field label="Session" style={{ flex: 1 }}>
          <Picker value={session} onChange={(v) => setSession(v as MilkSession)} options={SESSIONS} />
        </Field>
        <Field label="Date" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
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

      {hasInput ? (
        allCol ? (
          <Calc
            label="All yield → Colostrum bank"
            value={`${(t - d).toFixed(1)} kg`}
            footer="Not sellable · 0 KES revenue"
          />
        ) : (
          <Calc
            label={`Net sellable milk · ${herd || "—"} · ${session}`}
            value={`${m.toFixed(1)} kg → ${rev.toLocaleString()} KES`}
            footer={`${t} − ${d} discard${ck ? ` − ${ck} colostrum` : ""}`}
          />
        )
      ) : (
        <Calc
          label={`Net sellable milk · ${herd || "—"} · ${session}`}
          value="0 kg → 0 KES"
          footer="Enter the day's collection above"
        />
      )}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit recording"}
        disabled={mutation.isPending}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
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
