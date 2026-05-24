import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { KV } from "@/components/KV";
import { Loader } from "@/components/Loader";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { COLORS, RADIUS } from "@/constants/theme";
import { useCreateFeedingWorkOrder } from "@/src/hooks/mutations";
import { useDefaultCompany } from "@/src/hooks/useDefaultCompany";
import { useHerds } from "@/src/hooks/useHerds";
import { extractFrappeError, todayISO } from "@/src/services/api";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

const SESSIONS = ["AM", "PM", "Full day"];

export default function AnimalFeed() {
  const { data: herds = [], isLoading, error, refetch } = useHerds();
  const { data: company } = useDefaultCompany();
  const mutation = useCreateFeedingWorkOrder();

  // Only herds with a BOM can produce a Work Order — exclude the rest.
  const feedable = useMemo(() => herds.filter((h) => !!h.bom), [herds]);

  const [herdName, setHerdName] = useState<string>("");
  const [session, setSession] = useState(SESSIONS[0]);
  const [wipWarehouse, setWipWarehouse] = useState<string>("");
  const [kg, setKg] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Restore the last-used WIP warehouse + default the herd once data is in.
  useEffect(() => {
    storage.getItem(STORAGE_KEYS.FEED_WIP_WAREHOUSE).then((v) => {
      if (v) setWipWarehouse(v);
    });
  }, []);
  useEffect(() => {
    if (!herdName && feedable.length) setHerdName(feedable[0].n);
  }, [feedable, herdName]);

  const herd = useMemo(() => feedable.find((h) => h.n === herdName), [feedable, herdName]);
  const recommended = useMemo(
    () => (herd ? Math.round(herd.cnt * (herd.kgPerHeadPerDay || 0)) : 0),
    [herd],
  );
  // Default the kg input from the recommended only on first land for this herd.
  useEffect(() => {
    if (recommended && !kg) setKg(String(recommended));
  }, [recommended]); // eslint-disable-line react-hooks/exhaustive-deps

  const kgNum = Number(kg) || 0;
  const perHead = herd && herd.cnt > 0 ? (kgNum / herd.cnt).toFixed(1) : "0";

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!company) return setSubmitError("Default company isn't loaded yet. Try again.");
    if (!herd) return setSubmitError("Pick a herd.");
    if (!herd.bom) return setSubmitError(`${herd.n} has no BOM linked. Set one in Livestock Settings.`);
    if (!wipWarehouse) return setSubmitError("Pick a manufacturing warehouse.");
    if (kgNum <= 0) return setSubmitError("Enter the total feed delivered in kg.");

    // Persist the warehouse so the next feeding session pre-fills it.
    await storage.setItem(STORAGE_KEYS.FEED_WIP_WAREHOUSE, wipWarehouse);

    try {
      const r = await mutation.mutateAsync({
        herd: herd.n,
        bomNo: herd.bom,
        qty: kgNum,
        noOfCows: herd.cnt,
        company,
        wipWarehouse,
        description: remarks.trim() ? remarks.trim() : `TMR ${herd.n} · ${session}`,
      });
      Alert.alert(
        r.queued ? "Queued offline" : "Feeding Work Order submitted",
        r.queued
          ? `Saved locally. Will sync when online.`
          : `Work Order created for ${herd.n}: ${kgNum} kg from BOM ${herd.bom}.`,
      );
      router.replace(`/(tabs)/record/success?name=Animal feeding`);
    } catch (err) {
      setSubmitError(extractFrappeError(err));
    }
  };

  if (isLoading) {
    return (
      <Screen title="Animal feeding" back>
        <Loader />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen title="Animal feeding" back>
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen title="Animal feeding" subtitle="TMR Work Order" back>
      <Banner tone="info">
        Submitting creates an ERPNext Work Order from the herd's BOM. Required raw materials pull
        from the manufacturing warehouse on completion.
      </Banner>

      <Field label="Herd">
        <Picker
          value={herdName}
          onChange={setHerdName}
          options={feedable.map((h) => h.n)}
        />
      </Field>

      {herd ? (
        <View style={s.bom}>
          <Text style={s.bomLbl}>BOM / TMR</Text>
          <Text style={s.bomTitle}>{herd.bom || "(no BOM linked)"}</Text>
          <Text style={s.bomSub}>Cost centre: {herd.cc || "—"}</Text>
          <Text style={s.bomSub}>
            {herd.cnt} head{herd.kgPerHeadPerDay ? ` × ${herd.kgPerHeadPerDay} kg/head = ${recommended} kg/day` : ""}
          </Text>
        </View>
      ) : null}

      <Field
        label="Manufacturing warehouse"
        help="WIP + FG warehouse for the Work Order. Defaults to your last choice."
      >
        <FrappeSearchPicker
          doctype="Warehouse"
          value={wipWarehouse || null}
          onChange={(name) => setWipWarehouse(name)}
          fields={["name", "warehouse_name"]}
          displayField="warehouse_name"
          searchField="warehouse_name"
          filters={[["disabled", "=", 0]]}
          icon="warehouse"
        />
      </Field>

      <FieldRow>
        <Field label="Date" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
        <Field label="Session" style={{ flex: 1 }}>
          <Picker value={session} onChange={setSession} options={SESSIONS} />
        </Field>
      </FieldRow>

      <Field
        label="Total feed delivered (kg)"
        help={herd ? `~${perHead} kg per head` : ""}
      >
        <Input value={kg} onChangeText={setKg} keyboardType="numeric" />
      </Field>

      {herd && herd.ration.length > 0 ? (
        <>
          <SectionTitle>Ration breakdown · from {herd.bom}</SectionTitle>
          <View style={s.box}>
            {herd.ration.map((r) => (
              <KV
                key={r.name}
                k={`${r.name}${r.pct ? ` ${r.pct}%` : ""}`}
                v={r.pct ? `${Math.round((kgNum * r.pct) / 100)} kg` : "—"}
              />
            ))}
          </View>
        </>
      ) : null}

      <Field label="Remarks">
        <Textarea
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Optional notes (silage quality, leftovers, etc.)"
        />
      </Field>

      {submitError ? <Banner tone="danger">{submitError}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit feeding"}
        disabled={mutation.isPending || !herd || !wipWarehouse || kgNum <= 0}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
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
