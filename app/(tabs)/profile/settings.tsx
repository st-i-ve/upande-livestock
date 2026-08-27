import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Divider } from "@/components/Divider";
import { ErrorState } from "@/components/ErrorState";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Loader } from "@/components/Loader";
import { Screen } from "@/components/Screen";
import { FONT_FAMILY } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { LivestockSettingsDoc } from "@/src/frappe/livestockSettings";
import {
  useLivestockSettings,
  useUpdateLivestockSettings,
} from "@/src/hooks/useLivestockSettings";
import { extractFrappeError } from "@/src/services/api";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric";
  hint?: string;
  placeholder?: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={c.textSubtle}
        style={s.input}
      />
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function LinkField({
  label,
  hint,
  doctype,
  value,
  onChange,
  fields,
  displayField,
  searchField,
  icon,
}: {
  label: string;
  hint?: string;
  doctype: string;
  value: string;
  onChange: (name: string) => void;
  fields?: string[];
  displayField?: string;
  searchField?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <FrappeSearchPicker
        doctype={doctype}
        value={value || null}
        onChange={(name) => onChange(name)}
        fields={fields}
        displayField={displayField}
        searchField={searchField}
        icon={icon}
      />
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export default function Settings() {
  const { data: settings, isLoading, error, refetch } = useLivestockSettings();
  const mutation = useUpdateLivestockSettings();

  // Local form state — initialised from live settings, allows edits, then we
  // diff against the original on save so we only patch changed fields.
  const [form, setForm] = useState<Partial<LivestockSettingsDoc>>({});
  const [original, setOriginal] = useState<Partial<LivestockSettingsDoc>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (settings && Object.keys(original).length === 0) {
      setForm(settings);
      setOriginal(settings);
    }
  }, [settings, original]);

  const set = <K extends keyof LivestockSettingsDoc>(
    key: K,
    value: LivestockSettingsDoc[K] | string,
  ) => setForm((prev) => ({ ...prev, [key]: value as any }));

  const diff = (): Partial<LivestockSettingsDoc> => {
    const out: Partial<LivestockSettingsDoc> = {};
    (Object.keys(form) as (keyof LivestockSettingsDoc)[]).forEach((k) => {
      if (form[k] !== original[k]) (out as any)[k] = form[k];
    });
    return out;
  };

  const handleSave = async () => {
    setSaveError(null);
    const patch = diff();
    if (Object.keys(patch).length === 0) {
      Alert.alert("No changes", "Nothing to save.");
      return;
    }
    // Coerce the numeric fields — the inputs hand back strings.
    const NUMERIC: (keyof LivestockSettingsDoc)[] = [
      "bull_cull_max_days",
      "bull_cull_warn_percent",
      "gestation_period_days",
      "min_calving_interval_days",
      "min_vaccination_interval_days",
      "min_deworming_interval_days",
      "min_weight_recording_interval_days",
      "min_hoof_trimming_interval_days",
      "max_open_days",
    ];
    for (const k of NUMERIC) {
      if (patch[k] !== undefined) (patch as any)[k] = Number(patch[k]);
    }
    try {
      await mutation.mutateAsync(patch);
      setOriginal({ ...original, ...patch });
      Alert.alert("Saved", `${Object.keys(patch).length} field${Object.keys(patch).length === 1 ? "" : "s"} updated.`);
    } catch (err) {
      setSaveError(extractFrappeError(err));
    }
  };

  if (isLoading) {
    return (
      <Screen title="Livestock settings" back>
        <Loader />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen title="Livestock settings" back>
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      </Screen>
    );
  }

  const dirty = Object.keys(diff()).length > 0;

  return (
    <Screen
      title="Livestock settings"
      subtitle="Edits go to the Frappe single doctype on save"
      back
    >
      <SectionHeader
        title="Company"
        subtitle="Every control here writes to a field this site declares"
      />
      <LinkField
        label="Default company"
        doctype="Company"
        value={form.custom_default_company || ""}
        onChange={(v) => set("custom_default_company", v)}
        icon="domain"
      />
      <LinkField
        label="Default credit / cash account"
        doctype="Account"
        value={form.custom_default_credit_account || ""}
        onChange={(v) => set("custom_default_credit_account", v)}
        icon="cash"
      />

      <Divider />

      <SectionHeader
        title="Calf routing"
        subtitle="Where a newborn lands. Leave blank and the server routes on sex."
      />
      <LinkField
        label="Female calf herd"
        doctype="Herds"
        value={form.female_calf_herd || ""}
        onChange={(v) => set("female_calf_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
      />
      <LinkField
        label="Male calf herd"
        doctype="Herds"
        value={form.male_calf_herd || ""}
        onChange={(v) => set("male_calf_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
        hint="Bull calves — the culling window starts here"
      />
      <LinkField
        label="Fallback calf herd"
        doctype="Herds"
        value={form.default_calf_herd || ""}
        onChange={(v) => set("default_calf_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
        hint="Used when neither sex herd is set"
      />

      <Divider />

      <SectionHeader
        title="Lifecycle herds"
        subtitle="Destinations the growth ladder and breeding rules move animals to"
      />
      <LinkField
        label="In-calf heifer herd"
        doctype="Herds"
        value={form.incalf_heifer_herd || ""}
        onChange={(v) => set("incalf_heifer_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
      />
      <LinkField
        label="High-yield herd"
        doctype="Herds"
        value={form.high_yield_herd || ""}
        onChange={(v) => set("high_yield_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
        hint="Where a fresh cow goes after calving"
      />
      <LinkField
        label="Low-yield herd"
        doctype="Herds"
        value={form.low_yield_herd || ""}
        onChange={(v) => set("low_yield_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
      />
      <LinkField
        label="Steamer herd"
        doctype="Herds"
        value={form.steamer_herd || ""}
        onChange={(v) => set("steamer_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
        hint="Dry cows steaming up to calving"
      />

      <Divider />

      <SectionHeader
        title="Bull culling"
        subtitle="Bull calves are sold young. This is the window and the warning point."
      />
      <LabeledInput
        label="Days to cull a bull calf"
        value={String(form.bull_cull_max_days ?? "")}
        onChangeText={(v) => set("bull_cull_max_days", v)}
        keyboardType="numeric"
        hint="Counted from birth"
      />
      <LabeledInput
        label="Warn at percent of window"
        value={String(form.bull_cull_warn_percent ?? "")}
        onChangeText={(v) => set("bull_cull_warn_percent", v)}
        keyboardType="numeric"
        hint="e.g. 75 — warn three-quarters of the way through"
      />

      <Divider />

      <SectionHeader title="Milking" />
      <LinkField
        label="Milk item"
        doctype="Item"
        value={form.custom_milk_item || ""}
        onChange={(v) => set("custom_milk_item", v)}
        fields={["name", "item_name", "item_code"]}
        displayField="item_name"
        searchField="item_name"
        icon="package-variant"
      />
      <LinkField
        label="Milk target warehouse"
        doctype="Warehouse"
        value={form.custom_milk_target_warehouse || ""}
        onChange={(v) => set("custom_milk_target_warehouse", v)}
        fields={["name", "warehouse_name"]}
        displayField="warehouse_name"
        searchField="warehouse_name"
        icon="warehouse"
      />
      <LinkField
        label="Milk discard warehouse"
        doctype="Warehouse"
        value={form.custom_milk_discard_warehouse || ""}
        onChange={(v) => set("custom_milk_discard_warehouse", v)}
        fields={["name", "warehouse_name"]}
        displayField="warehouse_name"
        searchField="warehouse_name"
        icon="warehouse"
        hint="Discarded milk lands here with its reason"
      />
      <LinkField
        label="Milking stock entry type"
        doctype="Stock Entry Type"
        value={form.custom_milking_stock_entry_type || ""}
        onChange={(v) => set("custom_milking_stock_entry_type", v)}
        icon="clipboard-list-outline"
      />

      <Divider />

      <SectionHeader title="Stores" subtitle="Where drugs, semen and feed leave from" />
      <LinkField
        label="Drug warehouse"
        doctype="Warehouse"
        value={form.drug_warehouse || ""}
        onChange={(v) => set("drug_warehouse", v)}
        fields={["name", "warehouse_name"]}
        displayField="warehouse_name"
        searchField="warehouse_name"
        icon="warehouse"
        hint="Default source for every vaccination, deworming and treatment"
      />
      <LinkField
        label="Semen warehouse"
        doctype="Warehouse"
        value={form.semen_warehouse || ""}
        onChange={(v) => set("semen_warehouse", v)}
        fields={["name", "warehouse_name"]}
        displayField="warehouse_name"
        searchField="warehouse_name"
        icon="warehouse"
      />
      <LinkField
        label="Feed WIP warehouse"
        doctype="Warehouse"
        value={form.custom_feed_wip_warehouse || ""}
        onChange={(v) => set("custom_feed_wip_warehouse", v)}
        fields={["name", "warehouse_name"]}
        displayField="warehouse_name"
        searchField="warehouse_name"
        icon="warehouse"
      />
      <LinkField
        label="Default semen straw item"
        doctype="Item"
        value={form.semen_item || ""}
        onChange={(v) => set("semen_item", v)}
        fields={["name", "item_name", "item_code"]}
        displayField="item_name"
        searchField="item_name"
        icon="package-variant"
      />

      <Divider />

      <SectionHeader
        title="Intervals the guards enforce"
        subtitle="A repeat inside one of these windows is refused, not warned about"
      />
      <LabeledInput
        label="Gestation period (days)"
        value={String(form.gestation_period_days ?? "")}
        onChangeText={(v) => set("gestation_period_days", v)}
        keyboardType="numeric"
        hint="Drives the expected calving date"
      />
      <LabeledInput
        label="Minimum calving interval (days)"
        value={String(form.min_calving_interval_days ?? "")}
        onChangeText={(v) => set("min_calving_interval_days", v)}
        keyboardType="numeric"
      />
      <LabeledInput
        label="Minimum days between vaccinations"
        value={String(form.min_vaccination_interval_days ?? "")}
        onChangeText={(v) => set("min_vaccination_interval_days", v)}
        keyboardType="numeric"
      />
      <LabeledInput
        label="Minimum days between dewormings"
        value={String(form.min_deworming_interval_days ?? "")}
        onChangeText={(v) => set("min_deworming_interval_days", v)}
        keyboardType="numeric"
      />
      <LabeledInput
        label="Minimum days between weighings"
        value={String(form.min_weight_recording_interval_days ?? "")}
        onChangeText={(v) => set("min_weight_recording_interval_days", v)}
        keyboardType="numeric"
      />
      <LabeledInput
        label="Minimum days between hoof trims"
        value={String(form.min_hoof_trimming_interval_days ?? "")}
        onChangeText={(v) => set("min_hoof_trimming_interval_days", v)}
        keyboardType="numeric"
      />
      <LabeledInput
        label="Days open before a cow is flagged"
        value={String(form.max_open_days ?? "")}
        onChangeText={(v) => set("max_open_days", v)}
        keyboardType="numeric"
        hint="Days since calving with no conception"
      />

      {saveError ? <Banner tone="danger">{saveError}</Banner> : null}

      <View style={{ height: 8 }} />
      <Button
        label={mutation.isPending ? "Saving…" : dirty ? "Save changes" : "No changes"}
        disabled={!dirty || mutation.isPending}
        loading={mutation.isPending}
        onPress={handleSave}
      />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    sectionHeader: {
      marginTop: 4,
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 18,
      color: c.text,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: -0.2,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: FONT_FAMILY.regular,
      marginTop: 3,
    },
    field: {
      marginBottom: 14,
    },
    fieldLabel: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: FONT_FAMILY.medium,
      marginBottom: 7,
      letterSpacing: 0.2,
    },
    fieldHint: {
      fontSize: 11,
      color: c.textSubtle,
      fontFamily: FONT_FAMILY.regular,
      marginTop: 6,
    },
    input: {
      width: "100%",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: c.text,
      fontFamily: FONT_FAMILY.regular,
      backgroundColor: c.bg,
    },
  });
