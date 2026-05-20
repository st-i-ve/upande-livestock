import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "@/components/Screen";
import { COLORS, FONT_FAMILY, RADIUS } from "@/constants/theme";

type SettingRowProps = {
  label: string;
  children: React.ReactNode;
  suffix?: string;
};

function SettingRow({ label, children, suffix }: SettingRowProps) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowControl}>
        {children}
        {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function FieldInput({
  value,
  onChangeText,
  keyboardType,
  width,
  align,
}: {
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric";
  width?: number;
  align?: "left" | "right";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      style={[
        s.input,
        width ? { width } : { flex: 1 },
        align === "right" ? { textAlign: "right" } : null,
      ]}
      placeholderTextColor={COLORS.textSubtle}
    />
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const inc = () => onChange(Math.min(max, value + step));
  const dec = () => onChange(Math.max(min, value - step));
  return (
    <View style={s.stepper}>
      <Pressable
        onPress={dec}
        style={({ pressed }) => [s.stepBtn, pressed && { backgroundColor: COLORS.border }]}
        hitSlop={6}
      >
        <MaterialCommunityIcons name="minus" size={16} color={COLORS.text} />
      </Pressable>
      <Text style={s.stepValue}>{value}</Text>
      <Pressable
        onPress={inc}
        style={({ pressed }) => [s.stepBtn, pressed && { backgroundColor: COLORS.border }]}
        hitSlop={6}
      >
        <MaterialCommunityIcons name="plus" size={16} color={COLORS.text} />
      </Pressable>
    </View>
  );
}

export default function Settings() {
  // Default herds
  const [calfHerd, setCalfHerd] = useState("0-2");
  const [bullHerd, setBullHerd] = useState("BULLS");
  const [dryHerd, setDryHerd] = useState("STEAMERS");

  // Calf feeding plan
  const [colostrumPct, setColostrumPct] = useState("10");
  const [transitionalPct, setTransitionalPct] = useState("5");
  const [milkPct, setMilkPct] = useState("10");
  const [weanStart, setWeanStart] = useState(60);
  const [weanEnd, setWeanEnd] = useState(90);

  // Reproduction
  const [minServiceAge, setMinServiceAge] = useState(15);
  const [minCalvingAge, setMinCalvingAge] = useState(24);

  // Accounting
  const [milkSales, setMilkSales] = useState("404001");
  const [vetExpense, setVetExpense] = useState("50101906");
  const [feedExpense, setFeedExpense] = useState("50101905");
  const [milkPrice, setMilkPrice] = useState("60");

  return (
    <Screen title="Livestock settings" subtitle="Tap a value to edit" back>
      <Section title="Default herds">
        <SettingRow label="Calf herd">
          <FieldInput value={calfHerd} onChangeText={setCalfHerd} align="right" />
        </SettingRow>
        <SettingRow label="Bull herd">
          <FieldInput value={bullHerd} onChangeText={setBullHerd} align="right" />
        </SettingRow>
        <SettingRow label="Dry herd">
          <FieldInput value={dryHerd} onChangeText={setDryHerd} align="right" />
        </SettingRow>
      </Section>

      <Section title="Calf feeding plan">
        <SettingRow label="Day 1 colostrum" suffix="% of birth wt">
          <FieldInput value={colostrumPct} onChangeText={setColostrumPct} keyboardType="numeric" width={56} align="right" />
        </SettingRow>
        <SettingRow label="Days 2-5 transitional" suffix="% body wt / day">
          <FieldInput value={transitionalPct} onChangeText={setTransitionalPct} keyboardType="numeric" width={56} align="right" />
        </SettingRow>
        <SettingRow label="Day 6+ whole milk" suffix="% body wt / day">
          <FieldInput value={milkPct} onChangeText={setMilkPct} keyboardType="numeric" width={56} align="right" />
        </SettingRow>
        <SettingRow label="Weaning window">
          <View style={s.range}>
            <Stepper value={weanStart} onChange={setWeanStart} min={1} max={weanEnd - 1} />
            <Text style={s.rangeSep}>→</Text>
            <Stepper value={weanEnd} onChange={setWeanEnd} min={weanStart + 1} max={180} />
            <Text style={s.suffix}>days</Text>
          </View>
        </SettingRow>
      </Section>

      <Section title="Reproduction">
        <SettingRow label="Min service age" suffix="months">
          <Stepper value={minServiceAge} onChange={setMinServiceAge} min={6} max={36} />
        </SettingRow>
        <SettingRow label="Min calving age" suffix="months">
          <Stepper value={minCalvingAge} onChange={setMinCalvingAge} min={18} max={48} />
        </SettingRow>
      </Section>

      <Section title="Accounting">
        <SettingRow label="Milk sales">
          <FieldInput value={milkSales} onChangeText={setMilkSales} keyboardType="numeric" align="right" />
        </SettingRow>
        <SettingRow label="Vet expense">
          <FieldInput value={vetExpense} onChangeText={setVetExpense} keyboardType="numeric" align="right" />
        </SettingRow>
        <SettingRow label="Feed expense">
          <FieldInput value={feedExpense} onChangeText={setFeedExpense} keyboardType="numeric" align="right" />
        </SettingRow>
        <SettingRow label="Milk price" suffix="KES/kg">
          <FieldInput value={milkPrice} onChangeText={setMilkPrice} keyboardType="numeric" width={72} align="right" />
        </SettingRow>
      </Section>
    </Screen>
  );
}

const s = StyleSheet.create({
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.regular,
  },
  rowControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.medium,
    backgroundColor: COLORS.bg,
    minWidth: 80,
  },
  suffix: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: COLORS.bg,
  },
  stepBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
    fontVariant: ["tabular-nums"],
  },
  range: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rangeSep: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});
