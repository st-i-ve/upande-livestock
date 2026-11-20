import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ResultChip } from "@/components/ResultChip";
import { Chip, Chips } from "@/components/Chips";
import { DateField } from "@/components/DateTimeField";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { useOffline } from "@/components/OnlineOnlyNotice";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { RADIUS, font } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { canSeeQuality } from "@/src/auth/roles";
import { pickCalfPhoto } from "@/src/frappe/calfPhoto";
import type { FileAsset } from "@/src/frappe/files";
import { batchFields, batchLabel, pendingFirst } from "@/src/frappe/milkBatchLabel";
import { getMilkBatches } from "@/src/frappe/milkBatches";
import { getQualityTestOptions, getQualityTests } from "@/src/frappe/milkQualityTest";
import {
  CHECK_LABELS,
  DEFAULT_LIMITS,
  emptyForm,
  formProblem,
  payloadFrom,
  previewChecks,
  previewOverall,
  sccOver,
  toggleSensorySign,
  toggleSign,
  type CheckKey,
  type QualityForm,
} from "@/src/frappe/milkQualityRules";
import { useCanRecord } from "@/src/hooks/useCanRecord";
import { useColors } from "@/src/hooks/useColors";
import { useRecordQualityTest } from "@/src/hooks/mutations";
import { useRecordDraft } from "@/src/hooks/useRecordDraft";
import { extractFrappeError, todayISO } from "@/src/services/api";

const SAMPLE_TYPES = ["Bottle sample", "Tanker", "Can"];
const SHIFTS = ["Morning", "Afternoon", "Evening"];
const CHECKS = Object.keys(CHECK_LABELS) as CheckKey[];

/**
 * Milk quality: the buyer's result sheet for a batch, recorded on the phone.
 *
 * Reached from the lab's Quality tab and from the Record menu, for the same
 * roles as the desk's Quality page. Works offline: the sheet is kept on the
 * phone (with its slip photo) and sent when there is signal.
 */
export default function MilkQuality() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const offline = useOffline();
  const roles = useAuthStore((st) => st.roles);
  const { canRecord } = useCanRecord();
  const mutation = useRecordQualityTest();

  const options = useQuery({ queryKey: ["quality-test-options"], queryFn: () => getQualityTestOptions(), staleTime: 60_000 });
  const history = useQuery({ queryKey: ["quality-tests"], queryFn: () => getQualityTests({}, 15), enabled: !offline });
  const limits = options.data?.limits ?? DEFAULT_LIMITS;
  // The batches milked lately: a result is recorded against one of them.
  const batchesQ = useQuery({ queryKey: ["milk-batches"], queryFn: () => getMilkBatches(), enabled: !offline, staleTime: 60_000 });
  // Batches awaiting a result first (the server orders them so; sorted again for old servers).
  const batches = useMemo(() => pendingFirst(batchesQ.data ?? []), [batchesQ.data]);
  const { batch: wantedBatch } = useLocalSearchParams<{ batch?: string }>();
  const batchOf = (rec: string) => batches.find((b) => b.milk_recording === rec);
  const ceiling = options.data?.scc_ceiling ?? 0;

  const [form, setForm] = useState<QualityForm>(() => emptyForm(todayISO()));
  const [photo, setPhoto] = useState<FileAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Arriving from the Quality list with a batch tapped: pick it.
  useEffect(() => {
    const b = wantedBatch ? batches.find((x) => x.key === wantedBatch) : undefined;
    if (b) setForm((f) => (f.milk_recording === b.milk_recording ? f : { ...f, milk_recording: b.milk_recording, sample_date: b.date, shift: b.shift }));
  }, [wantedBatch, batches]);

  const buyer = form.buyer || options.data?.default_buyer || "";
  const set = (k: keyof QualityForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const pickedBatch = form.milk_recording ? batchOf(form.milk_recording) : undefined;
  const sccHigh = sccOver(form.bulk_scc, ceiling);
  const checks = useMemo(() => previewChecks(form, limits), [form, limits]);
  const overall = previewOverall(checks);

  // Left by a tab switch with input in it: kept for "Continue recording".
  const blank = useMemo(() => emptyForm(form.sample_date), [form.sample_date]);
  useRecordDraft({
    title: "Milk quality",
    state: { form, photo },
    filled: photo !== null || JSON.stringify({ ...form, buyer: "" }) !== JSON.stringify({ ...blank, buyer: "" }),
    restore: (x) => {
      setForm(x.form);
      setPhoto(x.photo);
    },
  });

  if (!canSeeQuality(roles)) {
    return (
      <Screen title="Milk quality" back>
        <Banner tone="warning">Milk quality is recorded by the lab and the Livestock Manager.</Banner>
      </Screen>
    );
  }

  const takePhoto = async (source: "camera" | "gallery") => {
    const r = await pickCalfPhoto(source);
    if (r.status === "picked") setPhoto({ ...r.asset, name: r.asset.name.replace(/^calf-/, "slip-") });
    else if (r.status === "denied") setError("Camera permission is off. Use the gallery, or allow the camera in Settings.");
    else if (r.status === "failed") setError(r.message);
  };

  const submit = async () => {
    setError(null);
    setDone(null);
    const problem = formProblem(form);
    if (problem) return setError(problem);
    if (batches.length && !form.milk_recording) return setError("Choose the milked batch this sample came from.");
    try {
      await mutation.mutateAsync({
        // Every recording of the batch, so the server writes SCC, fat and protein onto each.
        fields: { ...payloadFrom({ ...form, buyer }), ...(pickedBatch ? { recordings: batchFields(pickedBatch).recordings } : {}) },
        slipPhoto: photo,
      });
      setDone("Saved on this phone. It is sent when there is signal.");
      setForm(emptyForm(form.sample_date, buyer));
      setPhoto(null);
    } catch (e) {
      setError(extractFrappeError(e));
    }
  };

  const num = (label: string, k: keyof QualityForm, extra?: { help?: string; sign?: "decimal" | "sensory" }) => (
    <View style={{ flex: 1 }}>
      <Field label={label} help={extra?.help}>
        <View style={s.signRow}>
          <View style={{ flex: 1 }}>
            <Input
              value={form[k]}
              onChangeText={set(k)}
              // A signed field gets the full keyboard on iOS (its number pad has
              // no minus); the sign button below does the same job everywhere.
              keyboardType={extra?.sign ? "numbers-and-punctuation" : "decimal-pad"}
              accessibilityLabel={label}
            />
          </View>
          {extra?.sign ? (
            <Pressable
              accessibilityLabel={`Flip sign of ${label}`}
              onPress={() => set(k)((extra.sign === "sensory" ? toggleSensorySign : toggleSign)(form[k]))}
              style={s.signBtn}
            >
              <Text style={s.signText}>+/−</Text>
            </Pressable>
          ) : null}
        </View>
      </Field>
    </View>
  );

  const pf = (label: string, k: keyof QualityForm, opts: string[]) => (
    <Field label={label}>
      <Chips>
        {opts.map((o) => (
          <Chip
            key={o}
            label={o}
            active={form[k] === o}
            tone={/^(Fail|Positive|Present)$/.test(o) ? "danger" : "default"}
            onPress={() => set(k)(form[k] === o ? "" : o)}
          />
        ))}
      </Chips>
    </Field>
  );

  const recent = history.data?.tests ?? [];

  return (
    <Screen title="Milk quality" subtitle="Record a buyer's quality result" back>
      {offline ? (
        <Banner tone="info" icon="wifi-off">
          No connection. The result is kept on this phone and sent when you are back online.
        </Banner>
      ) : null}
      {!canRecord ? <Banner tone="warning">You may read these but not record them.</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {done ? <Banner tone="success">{done}</Banner> : null}

      <SectionTitle>Milked batch</SectionTitle>
      {batches.length ? (
        <Field label="Which milking is this sample from?" help="Date and shift are taken from the batch.">
          <Picker
            value={batchOf(form.milk_recording) ? batchLabel(batchOf(form.milk_recording)!) : ""}
            onChange={(label) => {
              const b = batches.find((x) => batchLabel(x) === label);
              setForm((f) => ({ ...f, milk_recording: b?.milk_recording ?? "", sample_date: b?.date ?? f.sample_date, shift: b?.shift ?? f.shift }));
            }}
            options={batches.map(batchLabel)}
            placeholder="Choose the milked batch"
          />
        </Field>
      ) : (
        <Text style={s.empty}>
          {offline ? "Batches need a connection: enter the date and shift below." : batchesQ.isLoading ? "Loading batches…" : "No milkings in the last 14 days: enter the date and shift below."}
        </Text>
      )}

      <SectionTitle>Sample</SectionTitle>
      <FieldRow>
        <View style={{ flex: 1 }}>
          <Field label="Sample date">
            <DateField value={form.sample_date} onChange={set("sample_date")} maximumDate={new Date()} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Sample type">
            <Picker value={form.sample_type} onChange={set("sample_type")} options={options.data?.sample_types ?? SAMPLE_TYPES} />
          </Field>
        </View>
      </FieldRow>
      <FieldRow>
        <View style={{ flex: 1 }}>
          <Field label="Buyer / lab">
            <Input value={buyer} onChangeText={set("buyer")} placeholder="Customer" />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Shift">
            <Picker value={form.shift} onChange={set("shift")} options={options.data?.shifts ?? SHIFTS} placeholder="—" clearable />
          </Field>
        </View>
      </FieldRow>
      <FieldRow>
        {num("Quantity (L)", "quantity_l")}
        {num("Receiving temp (°C)", "receiving_temp_c")}
      </FieldRow>

      <SectionTitle>Composition</SectionTitle>
      <FieldRow>
        {num("pH", "ph")}
        {num("TTA", "tta")}
      </FieldRow>
      <FieldRow>
        {num("SNF %", "snf_percent")}
        {num("Freezing point (°C)", "freezing_point", { sign: "decimal", help: "Below zero" })}
      </FieldRow>
      <FieldRow>
        {num("Specific gravity", "specific_gravity")}
        {num("Protein %", "protein_percent")}
      </FieldRow>
      <FieldRow>
        {num("Butter fat %", "butterfat_percent")}
        {num("Bulk SCC (cells/ml × 1000)", "bulk_scc", { help: ceiling ? `Ceiling ${ceiling}` : undefined })}
      </FieldRow>
      {sccHigh ? (
        <Banner tone="danger">
          {form.bulk_scc} is above the farm&apos;s ceiling of {ceiling}. It will still be recorded and flagged.
        </Banner>
      ) : null}
      <FieldRow>
        {num("Aflatoxin M1 (ppt)", "aflatoxin_ppt", { help: `Fails above ${limits.aflatoxin_limit_ppt || "—"}` })}
      </FieldRow>

      <SectionTitle>Tests</SectionTitle>
      <Field label="Resazurin score (0-6)">
        <Chips>
          {["0", "1", "2", "3", "4", "5", "6"].map((n) => (
            <Chip key={n} label={n} active={form.resazurin_score === n} onPress={() => set("resazurin_score")(form.resazurin_score === n ? "" : n)} />
          ))}
        </Chips>
      </Field>
      {pf("Resazurin result", "resazurin_result", ["Pass", "Fail"])}
      {pf("Antibiotics", "antibiotics", ["Negative", "Positive"])}
      {pf("Hydrogen peroxide", "hydrogen_peroxide", ["Nil", "Present"])}
      {pf("Frothing", "frothing", ["Pass", "Fail"])}
      <FieldRow>
        {num("Sensory score", "sensory_score", { sign: "sensory", help: "Taste and smell, e.g. +1" })}
        <View style={{ flex: 1 }}>
          <Field label="Sensory note">
            <Input value={form.sensory_note} onChangeText={set("sensory_note")} placeholder="Taste / smell" />
          </Field>
        </View>
      </FieldRow>

      <Field label="Remarks" help="Optional.">
        <Textarea value={form.remarks} onChangeText={set("remarks")} />
      </Field>

      <Field label="Lab slip photo" help={photo ? "Attached." : "Optional."}>
        <Chips>
          <Chip label="Camera" onPress={() => void takePhoto("camera")} />
          <Chip label="Gallery" onPress={() => void takePhoto("gallery")} />
          {photo ? <Chip label="Remove" tone="danger" onPress={() => setPhoto(null)} /> : null}
        </Chips>
      </Field>

      <View style={s.preview}>
        <View style={s.chips}>
          {CHECKS.map((k) => (
            <ResultChip key={k} label={CHECK_LABELS[k]} chip={checks[k]} />
          ))}
        </View>
        <Text style={[s.overall, overall === "Fail" && { color: c.danger }]}>Overall: {overall}</Text>
      </View>

      <Button
        label={mutation.isPending ? "Recording…" : "Record batch"}
        onPress={submit}
        loading={mutation.isPending}
        disabled={mutation.isPending || !canRecord}
      />

      <SectionTitle>Recent results</SectionTitle>
      {offline ? (
        <Text style={s.empty}>History needs a connection.</Text>
      ) : !recent.length ? (
        <Text style={s.empty}>{history.isLoading ? "Loading…" : "Nothing recorded yet."}</Text>
      ) : (
        recent.map((t) => (
          <View key={t.name} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>
                {t.sample_date} · {t.sample_type}
              </Text>
              <Text style={s.meta}>
                {t.buyer || "—"} · SCC {t.bulk_scc ?? "—"}{t.scc_over_ceiling ? " (over ceiling)" : ""} · Fat {t.butterfat_percent ?? "—"} · Protein {t.protein_percent ?? "—"} · SNF {t.snf_percent ?? "—"}
              </Text>
              <View style={[s.chips, { marginTop: 4 }]}>
                {CHECKS.map((k) => (
                  <ResultChip key={k} label={CHECK_LABELS[k]} chip={t.checks[k]} />
                ))}
              </View>
            </View>
            <Text style={[s.overallSmall, t.overall_result === "Fail" && { color: c.danger }]}>{t.overall_result}</Text>
          </View>
        ))
      )}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    signRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    signBtn: {
      minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center",
      borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderSubtle,
    },
    signText: { fontSize: 13, color: c.text, ...font("600") },
    preview: {
      marginVertical: 12, padding: 12, borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderSubtle, gap: 8,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    overall: { fontSize: 16, color: c.text, ...font("600") },
    overallSmall: { fontSize: 13, color: c.text, ...font("600") },
    empty: { paddingVertical: 16, textAlign: "center", color: c.textSubtle, fontSize: 12 },
    row: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    name: { fontSize: 13, color: c.text, ...font("500") },
    meta: { fontSize: 11, color: c.textMuted, marginTop: 1 },
  });
