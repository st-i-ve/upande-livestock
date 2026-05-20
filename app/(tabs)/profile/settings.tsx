import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Divider } from "@/components/Divider";
import { Screen } from "@/components/Screen";
import { COLORS, FONT_FAMILY } from "@/constants/theme";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric";
  hint?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={COLORS.textSubtle}
        style={s.input}
      />
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.stepper}>
        <Pressable onPress={dec} hitSlop={6} style={({ pressed }) => [s.stepBtn, pressed && { backgroundColor: COLORS.border }]}>
          <MaterialCommunityIcons name="minus" size={18} color={COLORS.text} />
        </Pressable>
        <View style={s.stepValueWrap}>
          <Text style={s.stepValue}>{value}</Text>
          {suffix ? <Text style={s.stepSuffix}>{suffix}</Text> : null}
        </View>
        <Pressable onPress={inc} hitSlop={6} style={({ pressed }) => [s.stepBtn, pressed && { backgroundColor: COLORS.border }]}>
          <MaterialCommunityIcons name="plus" size={18} color={COLORS.text} />
        </Pressable>
      </View>
    </View>
  );
}

function RangeStepper({
  label,
  start,
  end,
  onChangeStart,
  onChangeEnd,
  suffix,
}: {
  label: string;
  start: number;
  end: number;
  onChangeStart: (n: number) => void;
  onChangeEnd: (n: number) => void;
  suffix?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.rangeRow}>
        <View style={[s.stepper, { flex: 1 }]}>
          <Pressable onPress={() => onChangeStart(Math.max(1, start - 1))} hitSlop={6} style={s.stepBtn}>
            <MaterialCommunityIcons name="minus" size={18} color={COLORS.text} />
          </Pressable>
          <View style={s.stepValueWrap}>
            <Text style={s.stepValue}>{start}</Text>
          </View>
          <Pressable onPress={() => onChangeStart(Math.min(end - 1, start + 1))} hitSlop={6} style={s.stepBtn}>
            <MaterialCommunityIcons name="plus" size={18} color={COLORS.text} />
          </Pressable>
        </View>
        <Text style={s.rangeSep}>→</Text>
        <View style={[s.stepper, { flex: 1 }]}>
          <Pressable onPress={() => onChangeEnd(Math.max(start + 1, end - 1))} hitSlop={6} style={s.stepBtn}>
            <MaterialCommunityIcons name="minus" size={18} color={COLORS.text} />
          </Pressable>
          <View style={s.stepValueWrap}>
            <Text style={s.stepValue}>{end}</Text>
          </View>
          <Pressable onPress={() => onChangeEnd(Math.min(180, end + 1))} hitSlop={6} style={s.stepBtn}>
            <MaterialCommunityIcons name="plus" size={18} color={COLORS.text} />
          </Pressable>
        </View>
      </View>
      {suffix ? <Text style={s.fieldHint}>{suffix}</Text> : null}
    </View>
  );
}

export default function Settings() {
  const [calfHerd, setCalfHerd] = useState("0-2");
  const [bullHerd, setBullHerd] = useState("BULLS");
  const [dryHerd, setDryHerd] = useState("STEAMERS");

  const [colostrumPct, setColostrumPct] = useState("10");
  const [transitionalPct, setTransitionalPct] = useState("5");
  const [milkPct, setMilkPct] = useState("10");
  const [weanStart, setWeanStart] = useState(60);
  const [weanEnd, setWeanEnd] = useState(90);

  const [minServiceAge, setMinServiceAge] = useState(15);
  const [minCalvingAge, setMinCalvingAge] = useState(24);

  const [milkSales, setMilkSales] = useState("404001");
  const [vetExpense, setVetExpense] = useState("50101906");
  const [feedExpense, setFeedExpense] = useState("50101905");
  const [milkPrice, setMilkPrice] = useState("60");

  return (
    <Screen title="Livestock settings" subtitle="Tap any field to edit" back>
      <SectionHeader title="Default herds" subtitle="Where new animals land by default" />
      <LabeledInput label="Calf herd" value={calfHerd} onChangeText={setCalfHerd} />
      <LabeledInput label="Bull herd" value={bullHerd} onChangeText={setBullHerd} />
      <LabeledInput label="Dry herd" value={dryHerd} onChangeText={setDryHerd} />

      <Divider />

      <SectionHeader title="Calf feeding plan" subtitle="Percentages of body weight per day" />
      <LabeledInput
        label="Day 1 colostrum"
        value={colostrumPct}
        onChangeText={setColostrumPct}
        keyboardType="numeric"
        hint="% of birth weight"
      />
      <LabeledInput
        label="Days 2–5 transitional"
        value={transitionalPct}
        onChangeText={setTransitionalPct}
        keyboardType="numeric"
        hint="% body weight / day"
      />
      <LabeledInput
        label="Day 6+ whole milk"
        value={milkPct}
        onChangeText={setMilkPct}
        keyboardType="numeric"
        hint="% body weight / day"
      />
      <RangeStepper
        label="Weaning window"
        start={weanStart}
        end={weanEnd}
        onChangeStart={setWeanStart}
        onChangeEnd={setWeanEnd}
        suffix="days from birth"
      />

      <Divider />

      <SectionHeader title="Reproduction" subtitle="Earliest acceptable ages" />
      <Stepper label="Minimum service age" value={minServiceAge} onChange={setMinServiceAge} min={6} max={36} suffix="months" />
      <Stepper label="Minimum calving age" value={minCalvingAge} onChange={setMinCalvingAge} min={18} max={48} suffix="months" />

      <Divider />

      <SectionHeader title="Accounting" subtitle="ERPNext account numbers and pricing" />
      <LabeledInput label="Milk sales account" value={milkSales} onChangeText={setMilkSales} keyboardType="numeric" />
      <LabeledInput label="Vet expense account" value={vetExpense} onChangeText={setVetExpense} keyboardType="numeric" />
      <LabeledInput label="Feed expense account" value={feedExpense} onChangeText={setFeedExpense} keyboardType="numeric" />
      <LabeledInput label="Milk price" value={milkPrice} onChangeText={setMilkPrice} keyboardType="numeric" hint="KES per kilogram" />
    </Screen>
  );
}

const s = StyleSheet.create({
  sectionHeader: {
    marginTop: 4,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
    marginTop: 3,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.medium,
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  fieldHint: {
    fontSize: 11,
    color: COLORS.textSubtle,
    fontFamily: FONT_FAMILY.regular,
    marginTop: 6,
  },
  input: {
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 14,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.medium,
    backgroundColor: COLORS.bg,
  },
  stepper: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 50,
    backgroundColor: COLORS.bg,
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValueWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
  },
  stepValue: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
    fontVariant: ["tabular-nums"],
  },
  stepSuffix: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rangeSep: {
    fontSize: 16,
    color: COLORS.textSubtle,
  },
});
