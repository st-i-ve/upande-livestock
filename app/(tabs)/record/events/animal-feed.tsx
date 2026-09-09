import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { BACKDATE_AMBER_DARK, BACKDATE_AMBER_LIGHT } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Calc } from "@/components/Calc";
import { Chip, Chips } from "@/components/Chips";
import { DateField } from "@/components/DateTimeField";
import { ErrorState } from "@/components/ErrorState";
import { Field, FieldRow, Input } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { KV } from "@/components/KV";
import { Loader } from "@/components/Loader";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useScheme } from "@/src/theme/themeStore";
import { useFeedDayStatus } from "@/src/hooks/useFeedDayStatus";
import { useHerdFeedInfo } from "@/src/hooks/useHerdFeedInfo";
import { useHerds } from "@/src/hooks/useHerds";
import { useManualFeed } from "@/src/hooks/useManualFeed";
import { useManufactureHerdFeed } from "@/src/hooks/mutations";
import { useOperator } from "@/src/hooks/useOperator";
import { extractFrappeError, todayISO } from "@/src/services/api";

const kg = (n: number) => `${Number(n || 0).toLocaleString()} kg`;

// Distinct from BackdateBanner's copy: that one says stocks are untouched.
// Manual feeding is the opposite case — it mixes and issues for real — so the
// warning here is about accountability for the recipe and head count, not a
// reassurance about stock.
const MANUAL_WARNING =
  "You are setting the recipe and the head count yourself. This moves real " +
  "stock out of the store — you are accountable for what you enter.";

type Mode = "system" | "manual";

/**
 * Mixing and feeding a herd, in one action.
 *
 * This screen used to have two stages — manufacture, then feed — which was a
 * bug, not a design: `manufacture_herd_feed` mixes the batch AND issues it to
 * the herd in the same call, and returns `issued_qty` to say so. Feeding after
 * manufacturing therefore fed the herd twice, drawing the second issue from
 * whatever else happened to be in the store.
 *
 * The farm feeds in two runs a day, and that is what the portion is for: half
 * the day's ration each time, mixed and fed together. Nothing forces two equal
 * halves — the field is editable and the day's total is shown, because a herd
 * that ate more this morning is a fact to record rather than an error.
 *
 * Two tabs share the herd picker above them: System runs the herd's own BOM
 * and head count (optionally backdated); Manual configuration lets the
 * operator tune the recipe and say how many animals were actually fed, for
 * the day the store could actually cover it did not have to be today.
 */
export default function AnimalFeed() {
  const { data: herds = [], isLoading, error, refetch } = useHerds();

  const feedable = useMemo(() => herds.filter((h) => !!h.bom), [herds]);
  const [herdName, setHerdName] = useState<string>("");
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    if (!herdName && feedable.length) setHerdName(feedable[0].n);
  }, [feedable, herdName]);

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
    <Screen title="Animal feeding" subtitle="Mix and feed a herd" back>
      <Field label="Herd">
        <Picker value={herdName} onChange={setHerdName} options={feedable.map((h) => h.n)} />
      </Field>

      <Chips>
        <Chip label="System" active={mode === "system"} onPress={() => setMode("system")} />
        <Chip
          label="Manual configuration"
          active={mode === "manual"}
          onPress={() => setMode("manual")}
        />
      </Chips>

      {mode === "manual" ? <ManualTab herd={herdName} /> : <SystemTab herd={herdName} />}
    </Screen>
  );
}

/** The normal path: the herd's own BOM and head count, run for a fraction of
 *  the day. `date` now lets this post on a day other than today — wired
 *  through `useManufactureHerdFeed` to `manufactureHerdFeed`'s third
 *  argument, which was previously dead from this hook. */
function SystemTab({ herd }: { herd: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const info = useHerdFeedInfo(herd);
  const day = useFeedDayStatus(herd);
  const manufacture = useManufactureHerdFeed();

  const [portion, setPortion] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The suggestion is a default, not a rule: half a fresh day, the remainder
  // after. Only seeded when the operator has not typed their own.
  useEffect(() => {
    if (day.data && portion === "") setPortion(String(day.data.suggestedPortion));
  }, [day.data, portion]);

  const portionNum = Number(portion) || 0;
  const d = info.data;
  const st = day.data;

  const onRun = async () => {
    setSubmitError(null);
    if (!herd) return setSubmitError("Pick a herd.");
    if (portionNum <= 0) return setSubmitError("A run has to be for more than nothing.");
    try {
      const r = await manufacture.mutateAsync({ herd, portion: portionNum, postingDate: date });
      await Promise.all([info.refetch(), day.refetch()]);
      Alert.alert(
        `${r.feed_mode} feeding mixed`,
        `${Number(r.produced_qty).toLocaleString()} ${r.uom} of ${r.production_item} ` +
          `mixed and issued to ${herd}.\nWork Order ${r.work_order}.`,
      );
      router.replace("/(tabs)/record/success?name=Animal feeding");
    } catch (err) {
      setSubmitError(extractFrappeError(err));
    }
  };

  if (info.isLoading || !d) {
    return <Loader />;
  }

  return (
    <>
      {st ? (
        <View style={s.card}>
          <Text style={s.cardLbl}>Today</Text>
          <Text style={s.cardTitle}>
            {kg(st.issuedKg)} fed of {kg(st.dayKg)}
          </Text>
          <Text style={s.cardSub}>
            {st.complete
              ? "The day is fed."
              : `${kg(st.remainingKg)} still owed · run ${st.runsDone + 1} of ${st.runsPerDay}`}
          </Text>
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.cardLbl}>Ration</Text>
        <Text style={s.cardTitle}>{d.productionItemName}</Text>
        <Text style={s.cardSub}>
          {d.heads} head × {d.perHeadQty.toLocaleString()} {d.uom} = {kg(d.totalManufactureQty)}{" "}
          for a full day
        </Text>
      </View>

      <FieldRow>
        <Field
          label="This run"
          help="A fraction of the day. Half is offered because the farm feeds twice; change it if this run is a different size."
          style={{ flex: 1 }}
        >
          <Input
            value={portion}
            onChangeText={setPortion}
            keyboardType="decimal-pad"
            placeholder="0.5"
          />
        </Field>
        <Field label="Date fed" style={{ flex: 1 }}>
          <DateField value={date} onChange={setDate} maximumDate={new Date()} />
        </Field>
      </FieldRow>

      <Calc
        label="This run mixes and feeds"
        value={kg(d.totalManufactureQty * portionNum)}
        footer={`${d.heads} head · mixed into ${d.store} and issued in the same action`}
      />

      <SectionTitle>Raw materials for this run</SectionTitle>
      <View style={s.box}>
        {/* Recipe units throughout, per-head and whole-run, so the two figures
            in a row can be read against each other — and so this reads in the
            same units as the Manual tab's editable boxes. `requiredQty`/`uom`
            are the stock-unit twins (hay: 222 kg here, 15.54 BALE there); one
            row must never mix the two. */}
        {d.lines.map((l) => (
          <KV
            key={l.itemCode}
            k={`${l.itemName} (${(d.heads ? l.recipeQty / d.heads : 0).toLocaleString()} ${
              l.recipeUom
            }/head)`}
            v={`${(l.recipeQty * portionNum).toLocaleString()} ${l.recipeUom}`}
          />
        ))}
      </View>

      <Banner tone="info">
        Mixing and feeding are one action: the Work Order produces the batch into {d.store} and
        issues it to the herd immediately, so mixed feed never sits in the store.
      </Banner>

      {submitError ? <Banner tone="danger">{submitError}</Banner> : null}

      <Button
        label={manufacture.isPending ? "Mixing…" : "Mix & feed"}
        disabled={manufacture.isPending || !herd || portionNum <= 0}
        onPress={onRun}
      />
    </>
  );
}

type TunedRow = { itemCode: string; itemName: string; uom: string; qty: string };

/** The operator's own recipe and head count, for the day the store could
 *  actually cover — not necessarily today, and not necessarily the herd's
 *  registered count.
 *
 *  `lines[].qty` seeds from `getHerdFeedInfo(herd).lines[]` as
 *  `recipeQty / heads`, labelled `recipeUom` — the base BOM's own per-head
 *  figure, in the unit the recipe is written in. This is exactly what the
 *  desk block's `seedManual()` does, and it is the only correct source.
 *
 *  It used to read `info.breakdown[].perHeadQty`, and `breakdown` is not a key
 *  the "info" action returns at all, so every herd opened here showed "No
 *  ingredients. Add one below."
 *
 *  The obvious repair is the wrong one. `breakdown` lives on the server's
 *  `get_herd_feed_info()`, whose `per_head_qty` is `required_qty / heads` with
 *  `required_qty` in STOCK units. Hay is written 2 kg per head in the recipe
 *  and stocked in BALE at 0.07 bale/kg, so that route would put 0.14 in a box
 *  labelled kg and send a fourteenth of the ration.
 *
 *  Every value typed here is sent to the server exactly as shown — never
 *  scaled by heads, never converted between UOMs. The server derives the
 *  conversion from the herd's BOM and multiplies by the head count itself;
 *  doing either of those here would silently issue the wrong amount of stock.
 */
function ManualTab({ herd }: { herd: string }) {
  const c = useColors();
  const amber = useScheme() === "dark" ? BACKDATE_AMBER_DARK : BACKDATE_AMBER_LIGHT;
  const s = useMemo(() => makeStyles(c), [c]);
  const { data: info, isLoading } = useHerdFeedInfo(herd);
  const { operator, missingMessage } = useOperator();
  const feed = useManualFeed();

  const [rows, setRows] = useState<TunedRow[] | null>(null);
  const [heads, setHeads] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  // Seed once, then leave the operator's edits alone. Re-seeding on every
  // refetch would wipe a half-typed recipe under their fingers.
  useEffect(() => {
    if (!info || rows) return;
    setRows(
      info.lines.map((l) => ({
        itemCode: l.itemCode,
        itemName: l.itemName,
        // Recipe unit and recipe amount, per head. Never `uom`/`requiredQty`,
        // which are the stock-unit twins — see the block comment above.
        uom: l.recipeUom,
        qty: String(info.heads ? l.recipeQty / info.heads : 0),
      })),
    );
    setHeads(info.heads ? String(info.heads) : "");
  }, [info, rows]);

  const setQty = (itemCode: string, qty: string) =>
    setRows((prev) => (prev ?? []).map((r) => (r.itemCode === itemCode ? { ...r, qty } : r)));

  const removeRow = (itemCode: string) =>
    setRows((prev) => (prev ?? []).filter((r) => r.itemCode !== itemCode));

  const addItem = (name: string, row: any) =>
    setRows((prev) =>
      (prev ?? []).some((r) => r.itemCode === name)
        ? prev
        : [
            ...(prev ?? []),
            {
              itemCode: name,
              itemName: row?.item_name || name,
              uom: row?.stock_uom || "",
              qty: "0",
            },
          ],
    );

  const submit = async () => {
    setError(null);
    if (!operator) return setError(missingMessage);
    const count = Number(heads);
    // A JSON body drops an omitted or NaN `heads` key entirely, and the
    // server would then run with none at all — refuse here instead, and
    // require a whole animal count rather than a fraction.
    if (!Number.isInteger(count) || count <= 0) {
      return setError("Enter how many animals were actually fed — a whole number greater than zero.");
    }
    const lines = (rows ?? [])
      .map((r) => ({ itemCode: r.itemCode, qty: Number(r.qty) }))
      .filter((l) => l.qty > 0);
    if (!lines.length) return setError("Enter a quantity for at least one ingredient.");
    try {
      const r = await feed.mutateAsync({
        herd,
        lines,
        heads: count,
        postingDate: date,
        employee: operator ?? undefined,
      });
      Alert.alert(
        `${r.feed_mode} feeding mixed`,
        `${Number(r.produced_qty).toLocaleString()} ${r.uom} of ${r.production_item} ` +
          `mixed and issued to ${herd}.\nWork Order ${r.work_order}.`,
      );
      router.replace("/(tabs)/record/success?name=Animal feeding");
    } catch (e) {
      setError(extractFrappeError(e));
    }
  };

  if (isLoading || !rows) {
    return <Loader />;
  }

  return (
    <>
      <View style={[s.warning, { borderColor: amber, backgroundColor: `${amber}14` }]}>
        <MaterialCommunityIcons name="alert-outline" size={16} color={amber} style={{ marginTop: 1 }} />
        <Text style={[s.warningText, { color: amber }]}>{MANUAL_WARNING}</Text>
      </View>

      <SectionTitle>Per animal</SectionTitle>
      {rows.length === 0 ? <Text style={s.empty}>No ingredients. Add one below.</Text> : null}
      {rows.map((r) => (
        <View key={r.itemCode} style={s.row}>
          <Field label={`${r.itemName} (${r.uom}/head)`}>
            <Input
              value={r.qty}
              onChangeText={(v) => setQty(r.itemCode, v)}
              keyboardType="decimal-pad"
            />
          </Field>
          <Button label="Remove ingredient" variant="link" onPress={() => removeRow(r.itemCode)} />
        </View>
      ))}

      <Field label="Add an ingredient">
        <FrappeSearchPicker
          doctype="Item"
          value={null}
          onChange={addItem}
          placeholder="Search item…"
          fields={["name", "item_name", "item_code", "stock_uom"]}
          displayField="item_name"
          metaField="item_code"
          searchField="item_name"
          filters={[
            ["disabled", "=", 0],
            ["is_stock_item", "=", 1],
          ]}
          icon="plus"
        />
      </Field>

      <Field
        label="Number of animals fed"
        help="Not the herd's head count — how many were actually at the trough."
      >
        <Input value={heads} onChangeText={setHeads} keyboardType="number-pad" />
      </Field>

      <Field label="Date fed">
        <DateField value={date} onChange={setDate} maximumDate={new Date()} />
      </Field>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Button
        label={feed.isPending ? "Mixing…" : "Mix & feed"}
        onPress={submit}
        disabled={feed.isPending}
      />
    </>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      backgroundColor: c.bg,
      padding: 12,
      marginBottom: 12,
    },
    cardLbl: { fontSize: 11, color: c.textMuted, fontFamily: FONT_FAMILY.medium },
    cardTitle: { fontSize: 16, color: c.text, fontFamily: FONT_FAMILY.semibold, marginTop: 2 },
    cardSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    box: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      backgroundColor: c.bg,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    warning: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      borderWidth: 1,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
    },
    warningText: { flex: 1, fontSize: 13, lineHeight: 19 },
    row: {
      backgroundColor: c.bgMuted,
      padding: 11,
      borderRadius: RADIUS.md,
      marginBottom: 7,
    },
    empty: {
      color: c.textSubtle,
      fontSize: 12,
      paddingVertical: 4,
    },
  });
