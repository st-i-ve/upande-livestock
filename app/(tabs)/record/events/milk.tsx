import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Calc } from "@/components/Calc";
import { Field, FieldRow, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { APP, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useAuthStore } from "@/src/auth/authStore";
import type { MilkSession } from "@/src/frappe/milkRecording";
import { useCreateMilkRecording } from "@/src/hooks/mutations";
import { useHerds } from "@/src/hooks/useHerds";
import {
  extractFrappeError,
  todayISO,
} from "@/src/services/api";
import type { Animal } from "@/types";

const SESSIONS: MilkSession[] = ["AM — Morning", "PM — Afternoon", "Evening"];

type PerHerd = { total: string; discard: string; colostrum: string };
const EMPTY: PerHerd = { total: "", discard: "", colostrum: "" };

export default function Milk() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const employeeName = useAuthStore((s) => s.employeeName);
  const { data: herds = [] } = useHerds();

  // Eligible animals for milking: female, in a herd flagged `custom_is_milking`,
  // and not in withdrawal today. We look up the milking-herd set once.
  const milkingHerdNames = useMemo(
    () => new Set(herds.filter((h) => h.isMilking).map((h) => h.n)),
    [herds],
  );
  const today = todayISO();
  const eligibleFilter = (a: Animal) =>
    a.sex === "F" &&
    milkingHerdNames.has(a.herd) &&
    (!a.milkSafe || a.milkSafe < today);

  const [selected, setSelected] = useState<Animal[]>([]);
  const [session, setSession] = useState<MilkSession>(SESSIONS[0]);
  // Per-herd yields, keyed by herd name. Cleared when an animal from that
  // herd is unselected and no others remain.
  const [yields, setYields] = useState<Record<string, PerHerd>>({});
  const [allCol, setAllCol] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group selected animals by herd for per-herd entry sections.
  const grouped = useMemo(() => {
    const m: Record<string, Animal[]> = {};
    for (const a of selected) (m[a.herd] ||= []).push(a);
    return m;
  }, [selected]);
  const herdsInPlay = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const onPickMulti = (list: Animal[]) => {
    setSelected(list);
    // Prune yield entries for herds no longer represented in the picker.
    const stillIn = new Set(list.map((a) => a.herd));
    setYields((prev) => {
      const next: Record<string, PerHerd> = {};
      for (const k of Object.keys(prev)) if (stillIn.has(k)) next[k] = prev[k];
      return next;
    });
  };

  const setYield = (herd: string, patch: Partial<PerHerd>) =>
    setYields((prev) => ({ ...prev, [herd]: { ...(prev[herd] ?? EMPTY), ...patch } }));

  // Aggregate totals across herds, for the summary tile.
  const totals = useMemo(() => {
    let total = 0;
    let discard = 0;
    let colostrum = 0;
    for (const h of herdsInPlay) {
      const v = yields[h] ?? EMPTY;
      const t = Number(v.total) || 0;
      const d = Number(v.discard) || 0;
      const c = allCol ? Math.max(t - d, 0) : Number(v.colostrum) || 0;
      total += t;
      discard += d;
      colostrum += c;
    }
    const net = Math.max(total - discard - colostrum, 0);
    return { total, discard, colostrum, net, revenue: Math.round(net * APP.milkPriceKES) };
  }, [yields, herdsInPlay, allCol]);

  const mutation = useCreateMilkRecording();

  const handleSubmit = async () => {
    setError(null);
    if (selected.length === 0) return setError("Pick at least one cow.");
    if (herdsInPlay.length === 0) return setError("No herds represented in the selection.");
    // Every represented herd must have a total entered (so we don't post
    // empty Milk Recording rows).
    for (const h of herdsInPlay) {
      const t = Number(yields[h]?.total || 0);
      if (t <= 0) return setError(`Enter total yield for ${h}.`);
    }

    let succeeded = 0;
    let queued = 0;
    const submitted: string[] = [];

    for (const herdName of herdsInPlay) {
      const cowsMilked = grouped[herdName].length;
      const v = yields[herdName] ?? EMPTY;
      const t = Number(v.total) || 0;
      const d = Number(v.discard) || 0;
      const c = allCol ? Math.max(t - d, 0) : Number(v.colostrum) || 0;
      // Look up the Herds doc and submit its `herd_name` as the Link value.
      // The Animal's current_herd stores the herd's Frappe name, which in
      // this schema equals herd_name — but we resolve explicitly so the
      // intent matches the field semantics.
      const herdDoc = herds.find((h) => h.n === herdName);
      const herdLink = herdDoc?.herdName ?? herdName;

      try {
        const r = await mutation.mutateAsync({
          herd: herdLink,
          session,
          recordingDate: todayISO(),
          totalYieldKg: t,
          discardedKg: d || undefined,
          colostrumYieldKg: !allCol && c > 0 ? c : undefined,
          isColostrum: allCol,
          pricePerKg: APP.milkPriceKES,
          cowsMilked,                      // <-- count of selected animals from this herd
          operator: employeeName || undefined,
        });
        if (r.queued) queued += 1;
        else succeeded += 1;
        submitted.push(`${herdLink} (${cowsMilked} cows · ${t} kg)`);
      } catch (err) {
        setError(
          `Stopped at ${herdName}: ${extractFrappeError(err)}. ${submitted.length} recording${submitted.length === 1 ? "" : "s"} already submitted.`,
        );
        return;
      }
    }

    const parts: string[] = [];
    if (succeeded) parts.push(`${succeeded} recording${succeeded === 1 ? "" : "s"} submitted`);
    if (queued) parts.push(`${queued} queued offline`);
    Alert.alert("Milk recording done", `${parts.join(" · ")}\n${submitted.join("\n")}`);
    router.replace("/(tabs)/record/success?name=Milk recording");
  };

  return (
    <Screen
      title="Milk recording"
      subtitle={
        selected.length
          ? `${selected.length} cow${selected.length === 1 ? "" : "s"} · ${herdsInPlay.length} herd${herdsInPlay.length === 1 ? "" : "s"} · ${session}`
          : `Pick cows · ${session}`
      }
      back
    >
      {!employeeName ? (
        <Banner tone="warning">
          Your Employee record isn't set. Open Profile → My employee to pick one — submissions will
          still post, but with no operator on the doc.
        </Banner>
      ) : null}

      <Field
        label="Cows milked"
        help="Pick individual cows, or use the By herd tab to take a whole herd. Mixed-herd selections submit one Milk Recording per herd."
      >
        <AnimalPickerButton
          mode="multi"
          title="Select cows (milking herds only)"
          placeholder="Search lactating cows..."
          include={eligibleFilter}
          value={selected}
          onPickMulti={onPickMulti}
        />
      </Field>

      <FieldRow>
        <Field label="Session" style={{ flex: 1 }}>
          <Picker value={session} onChange={(v) => setSession(v as MilkSession)} options={SESSIONS} />
        </Field>
        <Field label="Date" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
      </FieldRow>

      <View style={s.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.toggleTitle}>Entire session is colostrum</Text>
          <Text style={s.toggleSub}>Posts the whole net yield to the Colostrum item</Text>
        </View>
        <Pressable
          onPress={() => setAllCol((v) => !v)}
          style={[s.toggle, allCol && { backgroundColor: c.text }]}
        >
          <View style={[s.knob, allCol && { transform: [{ translateX: 16 }] }]} />
        </Pressable>
      </View>

      {herdsInPlay.length === 0 ? (
        <Banner tone="info">Pick cows above. You can take a whole herd from the By herd tab.</Banner>
      ) : (
        <>
          <SectionTitle>Per-herd yields</SectionTitle>
          {herdsInPlay.map((herd) => {
            const cnt = grouped[herd].length;
            const v = yields[herd] ?? EMPTY;
            const label = herds.find((h) => h.n === herd)?.herdName ?? herd;
            return (
              <View key={herd} style={s.herdCard}>
                <View style={s.herdCardHeader}>
                  <Text style={s.herdName} numberOfLines={1}>{label}</Text>
                  <Text style={s.herdMeta}>{cnt} cow{cnt === 1 ? "" : "s"}</Text>
                </View>
                <FieldRow>
                  <Field label="Total yield (kg)" style={{ flex: 1 }}>
                    <Input
                      value={v.total}
                      onChangeText={(t) => setYield(herd, { total: t })}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Discard (kg)" style={{ flex: 1 }}>
                    <Input
                      value={v.discard}
                      onChangeText={(d) => setYield(herd, { discard: d })}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </Field>
                </FieldRow>
                {!allCol ? (
                  <Field
                    label="Colostrum portion (kg)"
                    help="If part of this herd's yield is colostrum (e.g. one fresh cow). Leave blank if none."
                  >
                    <Input
                      value={v.colostrum}
                      onChangeText={(c) => setYield(herd, { colostrum: c })}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </Field>
                ) : null}
              </View>
            );
          })}

          <Calc
            label={`Net sellable across ${herdsInPlay.length} herd${herdsInPlay.length === 1 ? "" : "s"}`}
            value={
              allCol
                ? `${(totals.total - totals.discard).toFixed(1)} kg → Colostrum bank`
                : `${totals.net.toFixed(1)} kg → ${totals.revenue.toLocaleString()} KES`
            }
            footer={
              allCol
                ? "All yield posted to colostrum · 0 KES revenue"
                : `${totals.total} − ${totals.discard} discard${totals.colostrum ? ` − ${totals.colostrum} colostrum` : ""}`
            }
          />
        </>
      )}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit recording"}
        disabled={mutation.isPending || selected.length === 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    toggleRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 12, paddingVertical: 10,
      backgroundColor: c.bgMuted, borderRadius: RADIUS.md, marginBottom: 8,
    },
    toggleTitle: { fontSize: 12, fontWeight: "600", color: c.text },
    toggleSub: { fontSize: 10, color: c.textMuted, marginTop: 2 },
    toggle: { width: 36, height: 20, borderRadius: 999, backgroundColor: c.border, justifyContent: "center" },
    knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: c.bg, marginLeft: 2 },
    herdCard: {
      backgroundColor: c.bgMuted,
      borderRadius: RADIUS.md,
      padding: 12,
      marginBottom: 10,
    },
    herdCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 8,
    },
    herdName: { fontSize: 13, color: c.text, fontFamily: FONT_FAMILY.semibold, flex: 1, minWidth: 0 },
    herdMeta: { fontSize: 11, color: c.textMuted, fontVariant: ["tabular-nums"] },
  });
