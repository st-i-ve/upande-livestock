import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { ScoreRow } from "@/components/ScoreRow";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { APP, COLORS, RADIUS } from "@/constants/theme";

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
      <Field label="Animal"><AnimalPickerButton /></Field>
      <FieldRow>
        <Field label="Date of examination" style={{ flex: 1 }}><Input value={APP.today} /></Field>
        <Field label="Examiner name" style={{ flex: 1 }}><Input defaultValue={APP.user} /></Field>
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
      <Field label="Weight (kg)"><Input keyboardType="numeric" placeholder="e.g. 480" /></Field>
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
        <Input keyboardType="numeric" placeholder="38.7" />
      </Field>
      <FieldRow>
        <Field label="Heart rate (bpm)" style={{ flex: 1 }}>
          <Input keyboardType="numeric" placeholder="60" />
        </Field>
        <Field label="Respiratory rate" style={{ flex: 1 }}>
          <Input keyboardType="numeric" placeholder="20" />
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
      <Field label="Medication given"><Input placeholder="e.g. Procaine Penicillin G" /></Field>
      <FieldRow>
        <Field label="Dosage" style={{ flex: 1 }}><Input placeholder="e.g. 20 ml IM" /></Field>
        <Field label="Follow-up date" style={{ flex: 1 }}><Input placeholder="YYYY-MM-DD" /></Field>
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
        <Textarea placeholder="Free-text notes — what did you see, hear, smell?" />
      </Field>

      {/* CUSTOM FIELDS */}
      <SectionTitle>Custom fields</SectionTitle>
      {customs.length === 0 ? (
        <Text style={s.customHint}>
          Anything not covered above? Add a custom field — it will be stored on this exam record.
        </Text>
      ) : null}
      {customs.map((c) => (
        <View key={c.id} style={s.customRow}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Field name (e.g. Vulva temperature)"
              value={c.label}
              onChangeText={(label) => updateCustom(c.id, { label })}
            />
            <View style={{ height: 6 }} />
            <Input
              placeholder="Value or observation"
              value={c.value}
              onChangeText={(value) => updateCustom(c.id, { value })}
            />
          </View>
          <Pressable onPress={() => removeCustom(c.id)} hitSlop={8} style={s.customRemove}>
            <MaterialCommunityIcons name="close" size={16} color={COLORS.textMuted} />
          </Pressable>
        </View>
      ))}
      <Button label="Add custom field" icon="plus" variant="outline" onPress={addCustom} />

      <View style={{ height: 12 }} />
      <Button
        label="Submit diagnosis"
        onPress={() => router.replace(
          diagnosis === "Confirmed disease"
            ? "/event-success?name=Diagnosis (escalated to case)"
            : "/event-success?name=Animal diagnosis",
        )}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  flagRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  flagLabel: { flex: 1, fontSize: 13, color: COLORS.text },
  customHint: {
    backgroundColor: COLORS.bgMuted,
    color: COLORS.textMuted,
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
