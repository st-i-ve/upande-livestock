import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Calc } from "@/components/Calc";
import { Chip, Chips } from "@/components/Chips";
import { EmployeePickerButton } from "@/components/EmployeePickerButton";
import { Field, FieldRow, Input, Textarea } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { ageDays, initials } from "@/services/utils";
import { useColors } from "@/src/hooks/useColors";
import { useAuthStore } from "@/src/auth/authStore";
import {
  CalfFeedType,
  CalfFeedingSession,
} from "@/src/frappe/calfFeeding";
import { useCreateCalfFeeding } from "@/src/hooks/mutations";
import { useDefaultCompany } from "@/src/hooks/useDefaultCompany";
import { extractFrappeError, todayISO } from "@/src/services/api";
import type { Animal } from "@/types";

const FEED_TYPES: CalfFeedType[] = [
  "Colostrum",
  "Transitional Milk",
  "Whole Milk",
  "Milk Replacer",
  "Starter Feed",
  "Forage",
];

const SESSIONS: CalfFeedingSession[] = ["AM", "PM", "Midday", "Night"];

const recommendedFor = (calf: Animal) => {
  const days = calf.dob ? ageDays(calf.dob) : 0;
  const wt = calf.lastWt || 0;
  if (days <= 1) return { kg: (wt * 0.10 / 2).toFixed(1), type: "Colostrum" as CalfFeedType, phase: "Day 1 — first feed within 6h", formula: "10% birth weight ÷ 2" };
  if (days <= 5) return { kg: (wt * 0.05 / 2).toFixed(1), type: "Transitional Milk" as CalfFeedType, phase: "Days 2-5", formula: "5% body weight ÷ 2" };
  if (days <= 60) return { kg: (wt * 0.10 / 2).toFixed(1), type: "Whole Milk" as CalfFeedType, phase: "Pre-weaning", formula: "10% body weight ÷ 2" };
  if (days <= 90) {
    const tp = 1 - (days - 60) / 30;
    return { kg: (wt * 0.10 * tp / 2).toFixed(1), type: "Whole Milk" as CalfFeedType, phase: "Weaning taper", formula: "Tapering linearly to day 90" };
  }
  return { kg: "0", type: "Starter Feed" as CalfFeedType, phase: "Weaned", formula: "Whole milk feeding ended" };
};

export default function CalfFeed() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const defaultOperator = useAuthStore((s) => s.employeeName);
  const setStoredOperator = useAuthStore((s) => s.setEmployeeName);
  const { data: company } = useDefaultCompany();

  const [operator, setOperator] = useState<string | null>(defaultOperator);
  const [calf, setCalf] = useState<Animal | null>(null);
  const [session, setSession] = useState<CalfFeedingSession>("AM");
  const [feedType, setFeedType] = useState<CalfFeedType>("Whole Milk");
  const [item, setItem] = useState<string>("");
  const [wh, setWh] = useState<string>("");
  const [qty, setQty] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateCalfFeeding();

  const rec = useMemo(() => (calf ? recommendedFor(calf) : null), [calf]);
  const days = calf?.dob ? ageDays(calf.dob) : null;

  // When the user picks a calf, seed the recommended quantity + type once.
  React.useEffect(() => {
    if (rec && !qty) {
      setQty(rec.kg);
      setFeedType(rec.type);
    }
  }, [rec]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    setError(null);
    if (!operator) return setError("Pick the operator before submitting.");
    if (!calf) return setError("Pick the calf.");
    if (!company) return setError("Default company not loaded yet. Try again in a moment.");
    if (!qty || Number(qty) <= 0) return setError("Enter quantity fed (kg).");
    if (operator !== defaultOperator) await setStoredOperator(operator);

    try {
      const r = await mutation.mutateAsync({
        calf: calf.id,
        feedingDate: todayISO(),
        feedingSession: session,
        company,
        feedType,
        feedItem: item,           // expected to match a Frappe Item code
        sourceWarehouse: wh,
        quantityKg: Number(qty),
        operator,
        remarks: remarks || undefined,
      });
      Alert.alert(
        r.queued ? "Queued offline" : "Calf feeding recorded",
        r.queued
          ? `Saved locally. Will sync when online.`
          : `${qty} kg ${feedType} fed to ${calf.name}.`,
      );
      router.replace("/(tabs)/record/success?name=Calf feeding");
    } catch (err) {
      setError(extractFrappeError(err));
    }
  };

  return (
    <Screen title="Calf feeding" subtitle={calf?.name ?? "Pick a calf"} back>
      <Field label="Operator">
        <EmployeePickerButton value={operator} onChange={setOperator} />
      </Field>
      <Field label="Calf" help="Pick from the herd list — calves are filtered by repro status.">
        <AnimalPickerButton
          title="Select calf"
          placeholder="Search calves..."
          include={(a) => a.repro === "Calf" || a.repro === "Heifer" || /calf|0-2|2-4/i.test(a.herd)}
          value={calf}
          onPickSingle={setCalf}
        />
      </Field>

      {calf ? (
        <View style={s.head}>
          <Avatar text={initials(calf.name)} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{calf.name}</Text>
            <Text style={s.meta}>
              {days !== null ? `${days} days` : "—"}
              {calf.lastWt ? ` · ${calf.lastWt} kg` : ""}
              {calf.herd ? ` · ${calf.herd}` : ""}
            </Text>
          </View>
        </View>
      ) : null}

      {rec ? (
        <Calc
          label={`Recommended · ${rec.phase}`}
          value={`${rec.kg} kg ${rec.type}`}
          footer={`${rec.formula} · per Livestock Settings`}
        />
      ) : null}

      <Field label="Feed type">
        <Picker value={feedType} onChange={(v) => setFeedType(v as CalfFeedType)} options={FEED_TYPES} />
      </Field>
      <Field
        label="Feed item (stock)"
        help="Search live Frappe Items. Stock issued from source warehouse on submit."
      >
        <FrappeSearchPicker
          doctype="Item"
          value={item || null}
          onChange={(name) => setItem(name)}
          fields={["name", "item_name", "item_code", "stock_uom"]}
          displayField="item_name"
          metaField="item_code"
          searchField="item_name"
          filters={[["disabled", "=", 0], ["is_stock_item", "=", 1]]}
          icon="package-variant"
        />
      </Field>
      <FieldRow>
        <Field label="Source warehouse" style={{ flex: 1 }}>
          <FrappeSearchPicker
            doctype="Warehouse"
            value={wh || null}
            onChange={(name) => setWh(name)}
            fields={["name", "warehouse_name"]}
            displayField="warehouse_name"
            searchField="warehouse_name"
            filters={[["disabled", "=", 0]]}
            icon="warehouse"
          />
        </Field>
        <Field label="Session" style={{ flex: 1 }}>
          <Chips>
            {SESSIONS.map((sx) => (
              <Chip key={sx} label={sx} active={session === sx} onPress={() => setSession(sx)} />
            ))}
          </Chips>
        </Field>
      </FieldRow>
      <Field label="Quantity fed (kg)">
        <Input value={qty} onChangeText={setQty} keyboardType="numeric" />
      </Field>
      <Field label="Remarks (optional)">
        <Textarea value={remarks} onChangeText={setRemarks} placeholder="Optional notes" />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={mutation.isPending ? "Submitting…" : "Submit"}
        disabled={mutation.isPending || !calf}
        loading={mutation.isPending}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    name: { fontSize: 13, fontWeight: "600", color: c.text },
    meta: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  });
