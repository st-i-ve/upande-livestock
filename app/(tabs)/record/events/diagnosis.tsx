import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { appAlert } from "@/src/ui/appAlert";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { ScoreRow } from "@/components/ScoreRow";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { APP, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import type { DiagnosisAction } from "@/src/frappe/animalDiagnosis";
import { useAuthStore } from "@/src/auth/authStore";
import { useCreateAnimalDiagnosis } from "@/src/hooks/mutations";
import { useDefaultCompany } from "@/src/hooks/useDefaultCompany";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

const APPETITE = ["Normal", "Reduced", "Not eating"] as const;
const BEHAVIOR = ["Active", "Dull", "Aggressive", "Isolated"] as const;
const EYES = ["Clear", "Red", "Discharge", "Cloudy"] as const;
const NOSE = ["Moist (normal)", "Dry", "Discharge"] as const;
const MOUTH = ["Normal", "Lesions", "Excess saliva"] as const;
const SKIN = ["Healthy", "Rough coat", "Hair loss", "Wounds", "Parasites (ticks, fleas)"] as const;
const DUNG = ["Normal", "Diarrhoea", "Constipation", "Blood present"] as const;
const LOCO = ["Normal movement", "Limping", "Stiff joints", "Unable to stand"] as const;
const REPRO_DISCHARGE = ["None", "Abnormal"] as const;
const DIAGNOSIS = ["Healthy", "Suspected illness", "Confirmed disease"] as const;
const CONDITIONS = [
  "(specify)", "Mastitis (Clinical)", "Mastitis (Subclinical)", "Foot Rot", "Lameness",
  "Pneumonia", "Calf Scours", "Bloat", "Pinkeye", "Udder Oedema", "ECF / East Coast Fever",
  "Anaplasmosis", "Babesiosis", "Trypanosomiasis", "Other",
];

type CustomField = { id: number; label: string; value: string };

export default function Diagnosis() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);
  const { data: company } = useDefaultCompany();

  // Live picked animals + operator (replacing the stub picker that never lifted).
  const [selected, setSelected] = useState<Animal[]>([]);
  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useCreateAnimalDiagnosis();

  // Free-text fields that map directly into Animal Diagnosis.
  const [examiner, setExaminer] = useState<string>(APP.user);
  const [weight, setWeight] = useState("");
  const [temp, setTemp] = useState("");
  const [hr, setHr] = useState("");
  const [resp, setResp] = useState("");
  const [bcs, setBcs] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [vetName, setVetName] = useState("");
  const [vetConfirmed, setVetConfirmed] = useState(false);
  const [freeRemarks, setFreeRemarks] = useState("");

  // Single-select chip groups
  const [appetite, setAppetite] = useState<string>("Normal");
  const [behavior, setBehavior] = useState<string>("Active");
  const [eyes, setEyes] = useState<string>("Clear");
  const [nose, setNose] = useState<string>("Moist (normal)");
  const [mouth, setMouth] = useState<string>("Normal");
  const [dung, setDung] = useState<string>("Normal");
  const [loco, setLoco] = useState<string>("Normal movement");
  const [reproDischarge, setReproDischarge] = useState<string>("None");
  const [heatSigns, setHeatSigns] = useState<"Yes" | "No">("No");
  const [diagnosis, setDiagnosis] = useState<string>("Healthy");
  const [condition, setCondition] = useState<string>("(specify)");
  const [isolation, setIsolation] = useState<"Yes" | "No">("No");

  // Multi-select chip groups
  const [skin, setSkin] = useState<Set<string>>(new Set(["Healthy"]));
  const toggleSkin = (s: string) =>
    setSkin((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });

  // Disease yes/no flags
  const [flags, setFlags] = useState<Record<string, boolean>>({
    Fever: false, Coughing: false, Sneezing: false, Swelling: false, "Wounds/Injuries": false,
  });
  const toggleFlag = (k: string) => setFlags((prev) => ({ ...prev, [k]: !prev[k] }));

  // Custom fields — operator can add anything not covered above.
  const [customs, setCustoms] = useState<CustomField[]>([]);
  const addCustom = () =>
    setCustoms((prev) => [...prev, { id: Date.now(), label: "", value: "" }]);
  const updateCustom = (id: number, patch: Partial<CustomField>) =>
    setCustoms((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCustom = (id: number) =>
    setCustoms((prev) => prev.filter((c) => c.id !== id));

  return (
    <Screen title="Animal diagnosis" subtitle="Full health examination" back>
      <Banner tone="info">
        Walk through the cow head-to-tail. Anything not covered by the standard sections, add as a
        custom field at the bottom. Escalate to a Health Case from the Diagnosis section if needed.
      </Banner>

      {/* 1. BASIC INFORMATION */}
      <SectionTitle>1 · Basic information</SectionTitle>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field
        label="Animal(s)"
        help="Pick one or many. Same vitals + diagnosis applied per animal — one record each."
      >
        <AnimalPickerButton
          mode="multi"
          placeholder={selected.length ? `${selected.length} selected — tap to change` : "Search by tag or name…"}
          value={selected}
          onPickMulti={setSelected}
        />
      </Field>
      <FieldRow>
        <Field label="Date of examination" style={{ flex: 1 }}>
          <Input value={todayISO()} editable={false} />
        </Field>
        <Field label="Examiner name" style={{ flex: 1 }}>
          <Input value={examiner} onChangeText={setExaminer} />
        </Field>
      </FieldRow>

      {/* 2. GENERAL CONDITION */}
      <SectionTitle>2 · General condition</SectionTitle>
      <ScoreRow
        label="BCS (1-5)"
        defaultIndex={2}
        options={[
          { label: "1", tone: "danger" },
          { label: "2", tone: "warning" },
          { label: "3" },
          { label: "4", tone: "warning" },
          { label: "5", tone: "danger" },
        ]}
      />
      <Field label="Weight (kg)">
        <Input value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="e.g. 480" />
      </Field>
      <Field label="Appetite">
        <Chips>
          {APPETITE.map((o) => (
            <Chip key={o} label={o} active={appetite === o} onPress={() => setAppetite(o)} />
          ))}
        </Chips>
      </Field>
      <Field label="Behavior">
        <Chips>
          {BEHAVIOR.map((o) => (
            <Chip key={o} label={o} active={behavior === o} onPress={() => setBehavior(o)} />
          ))}
        </Chips>
      </Field>

      {/* 3. VITAL SIGNS */}
      <SectionTitle>3 · Vital signs</SectionTitle>
      <Field label="Temperature (°C)" help="Cattle 38.0–39.3 · Goat / sheep 38.5–40.0">
        <Input value={temp} onChangeText={setTemp} keyboardType="numeric" placeholder="38.7" />
      </Field>
      <FieldRow>
        <Field label="Heart rate (bpm)" style={{ flex: 1 }}>
          <Input value={hr} onChangeText={setHr} keyboardType="numeric" placeholder="60" />
        </Field>
        <Field label="Respiratory rate" style={{ flex: 1 }}>
          <Input value={resp} onChangeText={setResp} keyboardType="numeric" placeholder="20" />
        </Field>
      </FieldRow>

      {/* 4. PHYSICAL EXAMINATION */}
      <SectionTitle>4 · Physical examination</SectionTitle>
      <Field label="Eyes">
        <Chips>{EYES.map((o) => <Chip key={o} label={o} active={eyes === o} onPress={() => setEyes(o)} />)}</Chips>
      </Field>
      <Field label="Nose">
        <Chips>{NOSE.map((o) => <Chip key={o} label={o} active={nose === o} onPress={() => setNose(o)} />)}</Chips>
      </Field>
      <Field label="Mouth & teeth">
        <Chips>{MOUTH.map((o) => <Chip key={o} label={o} active={mouth === o} onPress={() => setMouth(o)} />)}</Chips>
      </Field>
      <Field label="Skin & coat (tap any)">
        <Chips>
          {SKIN.map((o) => <Chip key={o} label={o} active={skin.has(o)} onPress={() => toggleSkin(o)} />)}
        </Chips>
      </Field>

      {/* 5. DIGESTIVE */}
      <SectionTitle>5 · Digestive system</SectionTitle>
      <Field label="Rumen movements / minute" help="Healthy adult cattle: 1–3 per minute.">
        <Input keyboardType="numeric" placeholder="2" />
      </Field>
      <Field label="Dung">
        <Chips>{DUNG.map((o) => <Chip key={o} label={o} active={dung === o} onPress={() => setDung(o)} />)}</Chips>
      </Field>

      {/* 6. LOCOMOTION */}
      <SectionTitle>6 · Locomotion</SectionTitle>
      <Chips>{LOCO.map((o) => <Chip key={o} label={o} active={loco === o} onPress={() => setLoco(o)} />)}</Chips>

      {/* 7. REPRODUCTIVE HEALTH */}
      <SectionTitle>7 · Reproductive health (if applicable)</SectionTitle>
      <Field label="Pregnancy status"><Input placeholder="e.g. Confirmed 5 mo · or N/A" /></Field>
      <Field label="Discharge">
        <Chips>
          {REPRO_DISCHARGE.map((o) => (
            <Chip key={o} label={o} active={reproDischarge === o} onPress={() => setReproDischarge(o)} />
          ))}
        </Chips>
      </Field>
      <Field label="Heat signs observed">
        <Chips>
          <Chip label="Yes" active={heatSigns === "Yes"} onPress={() => setHeatSigns("Yes")} />
          <Chip label="No" active={heatSigns === "No"} onPress={() => setHeatSigns("No")} />
        </Chips>
      </Field>

      {/* 8. DISEASE INDICATORS */}
      <SectionTitle>8 · Disease indicators</SectionTitle>
      {Object.keys(flags).map((k) => (
        <View key={k} style={s.flagRow}>
          <Text style={s.flagLabel}>{k}</Text>
          <Chips>
            <Chip label="Yes" active={flags[k]} onPress={() => flags[k] || toggleFlag(k)} />
            <Chip label="No"  active={!flags[k]} onPress={() => flags[k] && toggleFlag(k)} />
          </Chips>
        </View>
      ))}

      {/* 9. DIAGNOSIS */}
      <SectionTitle>9 · Diagnosis</SectionTitle>
      <Chips>
        {DIAGNOSIS.map((o) => (
          <Chip
            key={o}
            label={o}
            tone={o === "Confirmed disease" ? "danger" : o === "Suspected illness" ? "warning" : "default"}
            active={diagnosis === o}
            onPress={() => setDiagnosis(o)}
          />
        ))}
      </Chips>
      {diagnosis !== "Healthy" ? (
        <Field label="Specific condition">
          <Picker value={condition} onChange={setCondition} options={CONDITIONS} />
        </Field>
      ) : null}

      {/* 10. TREATMENT / ACTION */}
      <SectionTitle>10 · Treatment / action</SectionTitle>
      <Field label="Medication given">
        <Input value={vetName} onChangeText={setVetName} placeholder="e.g. Procaine Penicillin G" />
      </Field>
      <FieldRow>
        <Field label="BCS (for diagnosis record)" style={{ flex: 1 }}>
          <Input value={bcs} onChangeText={setBcs} keyboardType="numeric" placeholder="3.0" />
        </Field>
        <Field label="Follow-up date" style={{ flex: 1 }}>
          <Input value={followUp} onChangeText={setFollowUp} placeholder="YYYY-MM-DD" />
        </Field>
      </FieldRow>
      <Field label="Isolation required">
        <Chips>
          <Chip label="Yes" tone="danger" active={isolation === "Yes"} onPress={() => setIsolation("Yes")} />
          <Chip label="No"  active={isolation === "No"}  onPress={() => setIsolation("No")} />
        </Chips>
      </Field>

      {/* 11. REMARKS */}
      <SectionTitle>11 · Remarks</SectionTitle>
      <Field>
        <Textarea
          value={freeRemarks}
          onChangeText={setFreeRemarks}
          placeholder="Free-text notes — what did you see, hear, smell?"
        />
      </Field>

      {/* CUSTOM FIELDS */}
      <SectionTitle>Custom fields</SectionTitle>
      {customs.length === 0 ? (
        <Text style={s.customHint}>
          Anything not covered above? Add a custom field — it will be stored on this exam record.
        </Text>
      ) : null}
      {customs.map((cf) => (
        <View key={cf.id} style={s.customRow}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Field name (e.g. Vulva temperature)"
              value={cf.label}
              onChangeText={(label) => updateCustom(cf.id, { label })}
            />
            <View style={{ height: 6 }} />
            <Input
              placeholder="Value or observation"
              value={cf.value}
              onChangeText={(value) => updateCustom(cf.id, { value })}
            />
          </View>
          <Pressable onPress={() => removeCustom(cf.id)} hitSlop={8} style={s.customRemove}>
            <MaterialCommunityIcons name="close" size={16} color={c.textMuted} />
          </Pressable>
        </View>
      ))}
      <Button label="Add custom field" icon="plus" variant="outline" onPress={addCustom} />

      {submitError ? <Banner tone="danger">{submitError}</Banner> : null}

      <View style={{ height: 12 }} />
      <Button
        label={mutation.isPending ? "Submitting…" : "Submit diagnosis"}
        loading={mutation.isPending}
        disabled={mutation.isPending || selected.length === 0}
        onPress={async () => {
          setSubmitError(null);
          if (!operator) return setSubmitError("Pick the operator before submitting.");
          if (selected.length === 0) return setSubmitError("Pick at least one animal.");
          if (!company) return setSubmitError("Default company not loaded yet. Try again in a moment.");
          if (operator !== defaultOperator) await setStoredOperator(operator);

          const action: DiagnosisAction =
            diagnosis === "Confirmed disease"
              ? "Escalated to Case"
              : diagnosis === "Suspected illness"
              ? "Logged — monitor"
              : "No action — normal";

          // Pack the rich UI state into Frappe's narrative fields so nothing
          // collected is lost. The DocType doesn't model every chip group.
          const differential = [
            `Appetite: ${appetite}`,
            `Behavior: ${behavior}`,
            `Eyes: ${eyes}`,
            `Nose: ${nose}`,
            `Mouth: ${mouth}`,
            `Skin: ${Array.from(skin).join(", ")}`,
            `Dung: ${dung}`,
            `Locomotion: ${loco}`,
            `Repro discharge: ${reproDischarge}`,
            `Heat signs: ${heatSigns}`,
            ...Object.entries(flags)
              .filter(([, v]) => v)
              .map(([k]) => `Flag: ${k}`),
            ...customs
              .filter((c) => c.label.trim() || c.value.trim())
              .map((c) => `${c.label.trim() || "Custom"}: ${c.value.trim()}`),
            weight ? `Weight: ${weight} kg` : null,
            examiner !== APP.user ? `Examiner: ${examiner}` : null,
            condition !== "(specify)" ? `Specific condition: ${condition}` : null,
            isolation === "Yes" ? "Isolation required: Yes" : null,
          ]
            .filter(Boolean)
            .join(" · ");

          // Structured system checks — one row per abnormal finding, mapped to
          // the Animal Diagnosis System Check body systems. Normal readings are
          // omitted so the child table only records what stood out.
          const systemChecks: { bodySystem: string; finding: string }[] = [];
          const addCheck = (bodySystem: string, finding: string) =>
            systemChecks.push({ bodySystem, finding });
          if (behavior !== "Active") addCheck("Nervous / Behaviour", `Behavior: ${behavior}`);
          if (eyes !== "Clear") addCheck("Eyes / Ocular", eyes);
          if (nose !== "Moist (normal)") addCheck("Nose / Nasal", nose);
          if (mouth !== "Normal") addCheck("Mouth / Oral", mouth);
          Array.from(skin)
            .filter((v) => v !== "Healthy")
            .forEach((v) => addCheck("Skin / Coat", v));
          if (dung !== "Normal") addCheck("Digestive / Rumen", `Dung: ${dung}`);
          if (loco !== "Normal movement") addCheck("Feet / Hooves", loco);
          if (reproDischarge !== "None") addCheck("Urogenital", `Discharge: ${reproDischarge}`);
          if (flags.Coughing) addCheck("Respiratory", "Coughing");
          if (flags.Sneezing) addCheck("Respiratory", "Sneezing");
          if (flags.Swelling) addCheck("Lymph nodes", "Swelling");
          if (flags["Wounds/Injuries"]) addCheck("Skin / Coat", "Wounds / injuries");

          let succeeded = 0;
          let queued = 0;
          for (const a of selected) {
            try {
              const r = await mutation.mutateAsync({
                animal: a.id,
                operator,
                company,
                diagnosisDate: todayISO(),
                actionTaken: action,
                systemChecks: systemChecks.length ? systemChecks : undefined,
                bcs: bcs ? Number(bcs) : undefined,
                temperatureC: temp ? Number(temp) : undefined,
                heartRate: hr ? Number(hr) : undefined,
                respirationRate: resp ? Number(resp) : undefined,
                differentialNotes: [differential, freeRemarks].filter(Boolean).join("\n\n") || undefined,
                followUpDate: followUp || undefined,
                vetName: vetName || undefined,
                confirmedByVet: vetConfirmed,
              });
              if (r.queued) queued += 1;
              else succeeded += 1;
            } catch (err) {
              setSubmitError(
                `${succeeded + queued} of ${selected.length} submitted. Stopped at ${a.name}: ${extractFrappeError(err)}`,
              );
              return;
            }
          }
          const parts: string[] = [];
          if (succeeded) parts.push(`${succeeded} diagnosed`);
          if (queued) parts.push(`${queued} queued (offline)`);
          appAlert(
            "Diagnosis submitted",
            `${parts.join(" · ")}${action === "Escalated to Case" && succeeded > 0 ? "\nA draft Animal Health Case has been created per animal." : ""}`,
          );
          router.replace(
            action === "Escalated to Case"
              ? "/(tabs)/record/success?name=Diagnosis (escalated to case)"
              : "/(tabs)/record/success?name=Animal diagnosis",
          );
        }}
      />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    flagRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    flagLabel: { flex: 1, fontSize: 13, color: c.text },
    customHint: {
      backgroundColor: c.bgMuted,
      color: c.textMuted,
      fontSize: 12,
      padding: 12,
      borderRadius: RADIUS.md,
      marginBottom: 8,
      lineHeight: 17,
    },
    customRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 10,
    },
    customRemove: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 6,
    },
  });
