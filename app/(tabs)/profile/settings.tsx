import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { appAlert } from "@/src/ui/appAlert";

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
      appAlert("No changes", "Nothing to save.");
      return;
    }
    // Coerce numeric fields.
    if (patch.custom_milk_price_per_kg !== undefined) {
      patch.custom_milk_price_per_kg = Number(patch.custom_milk_price_per_kg);
    }
    if (patch.custom_default_payout_percent !== undefined) {
      patch.custom_default_payout_percent = Number(patch.custom_default_payout_percent);
    }
    try {
      await mutation.mutateAsync(patch);
      setOriginal({ ...original, ...patch });
      appAlert("Saved", `${Object.keys(patch).length} field${Object.keys(patch).length === 1 ? "" : "s"} updated.`);
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
      <SectionHeader title="Company & farm" />
      <LinkField
        label="Default company"
        doctype="Company"
        value={form.custom_default_company || ""}
        onChange={(v) => set("custom_default_company", v)}
        icon="domain"
      />
      <LabeledInput
        label="Farm"
        value={form.custom_farm || ""}
        onChangeText={(v) => set("custom_farm", v)}
        hint="Posted on Sales Invoice (custom_farm)"
      />
      <LabeledInput
        label="Milk business unit"
        value={form.custom_milk_business_unit || ""}
        onChangeText={(v) => set("custom_milk_business_unit", v)}
      />

      <Divider />

      <SectionHeader title="Default herds" subtitle="Where new animals land by default" />
      <LinkField
        label="Default heifer herd"
        doctype="Herds"
        value={form.custom_default_heifer_herd || ""}
        onChange={(v) => set("custom_default_heifer_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
      />
      <LinkField
        label="Default bull herd"
        doctype="Herds"
        value={form.custom_default_bull_herd || ""}
        onChange={(v) => set("custom_default_bull_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
      />
      <LinkField
        label="Default dry herd"
        doctype="Herds"
        value={form.custom_default_dry_herd || ""}
        onChange={(v) => set("custom_default_dry_herd", v)}
        fields={["name", "herd_name"]}
        displayField="herd_name"
        icon="fence"
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
      />
      <LabeledInput
        label="Milking stock entry type"
        value={form.custom_milking_stock_entry_type || ""}
        onChangeText={(v) => set("custom_milking_stock_entry_type", v)}
        hint="e.g. Milking"
      />
      <LabeledInput
        label="Milk price (KES / kg)"
        value={String(form.custom_milk_price_per_kg ?? "")}
        onChangeText={(v) => set("custom_milk_price_per_kg", v)}
        keyboardType="numeric"
      />

      <Divider />

      <SectionHeader title="Stock — drugs & semen" />
      <LinkField
        label="Drug warehouse"
        doctype="Warehouse"
        value={form.custom_drug_warehouse || ""}
        onChange={(v) => set("custom_drug_warehouse", v)}
        fields={["name", "warehouse_name"]}
        displayField="warehouse_name"
        icon="warehouse"
      />
      <LinkField
        label="Semen warehouse"
        doctype="Warehouse"
        value={form.custom_semen_warehouse || ""}
        onChange={(v) => set("custom_semen_warehouse", v)}
        fields={["name", "warehouse_name"]}
        displayField="warehouse_name"
        icon="warehouse"
      />
      <LinkField
        label="Livestock sale item"
        doctype="Item"
        value={form.custom_animal_sale_item || ""}
        onChange={(v) => set("custom_animal_sale_item", v)}
        fields={["name", "item_name", "item_code"]}
        displayField="item_name"
        icon="package-variant"
      />

      <Divider />

      <SectionHeader title="Accounting" subtitle="Frappe accounts used by server scripts" />
      <LinkField
        label="Animal asset account"
        doctype="Account"
        value={form.custom_animal_asset_account || ""}
        onChange={(v) => set("custom_animal_asset_account", v)}
        icon="bank"
      />
      <LinkField
        label="Default credit / cash account"
        doctype="Account"
        value={form.custom_default_credit_account || ""}
        onChange={(v) => set("custom_default_credit_account", v)}
        icon="cash"
      />
      <LinkField
        label="Disposal write-off account"
        doctype="Account"
        value={form.custom_disposal_account || ""}
        onChange={(v) => set("custom_disposal_account", v)}
        icon="cash-remove"
      />
      <LinkField
        label="Animal sale income account"
        doctype="Account"
        value={form.custom_animal_sale_income_account || ""}
        onChange={(v) => set("custom_animal_sale_income_account", v)}
        icon="cash-plus"
      />
      <LinkField
        label="Milk income account"
        doctype="Account"
        value={form.custom_milk_income_account || ""}
        onChange={(v) => set("custom_milk_income_account", v)}
        icon="water"
      />
      <LinkField
        label="Vet expense account"
        doctype="Account"
        value={form.custom_vet_expense_account || ""}
        onChange={(v) => set("custom_vet_expense_account", v)}
        icon="medical-bag"
      />
      <LinkField
        label="Feed expense account"
        doctype="Account"
        value={form.custom_feed_expense_account || ""}
        onChange={(v) => set("custom_feed_expense_account", v)}
        icon="grain"
      />
      <LinkField
        label="Insurance receivable account"
        doctype="Account"
        value={form.custom_insurance_receivable_account || ""}
        onChange={(v) => set("custom_insurance_receivable_account", v)}
        icon="shield-check"
      />
      <LinkField
        label="Insurance income account"
        doctype="Account"
        value={form.custom_insurance_income_account || ""}
        onChange={(v) => set("custom_insurance_income_account", v)}
        icon="shield-check"
      />

      <Divider />

      <SectionHeader title="Insurance defaults" />
      <LabeledInput
        label="Default payout percent"
        value={String(form.custom_default_payout_percent ?? "")}
        onChangeText={(v) => set("custom_default_payout_percent", v)}
        keyboardType="numeric"
        hint="Used on culls/deaths when policy doesn't override"
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
