import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { BACKDATE_AMBER_DARK, BACKDATE_AMBER_LIGHT } from "@/components/BackdateButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Calc } from "@/components/Calc";
import { Chip, Chips } from "@/components/Chips";
import { DateField } from "@/components/DateTimeField";
import { ErrorState } from "@/components/ErrorState";
import { Field, Input } from "@/components/Field";
import { FrappeSearchPicker } from "@/components/FrappeSearchPicker";
import { KV } from "@/components/KV";
import { Loader } from "@/components/Loader";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { Switch } from "@/components/Switch";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useScheme } from "@/src/theme/themeStore";
import { useFeedDayStatus } from "@/src/hooks/useFeedDayStatus";
import { useHerdFeedInfo } from "@/src/hooks/useHerdFeedInfo";
import { useHerdRecipes } from "@/src/hooks/useHerdRecipes";
import { useHerds } from "@/src/hooks/useHerds";
import { useManualFeed } from "@/src/hooks/useManualFeed";
import { useManufactureHerdFeed } from "@/src/hooks/mutations";
import { useOperator } from "@/src/hooks/useOperator";
import type { HerdRecipe } from "@/src/frappe/herdRecipes";
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
  const recipes = useHerdRecipes(herdName);

  // Which recipe is currently picked — shared between the System and Manual
  // tabs so switching tabs never loses the choice. Defaults to the herd's
  // standing ration the moment `herd_recipes` answers, and only then: `herd`
  // changing before `recipes.data` catches up must not leave the previous
  // herd's bom_no selected under the new herd's name. `selectedForHerd` is
  // the guard — it reseeds exactly once per herd, the same "seed once, then
  // leave it alone" shape `ManualTab`'s own rows already use below.
  const [selectedBom, setSelectedBom] = useState<string>("");
  const [selectedForHerd, setSelectedForHerd] = useState<string>("");

  useEffect(() => {
    if (!herdName && feedable.length) setHerdName(feedable[0].n);
  }, [feedable, herdName]);

  useEffect(() => {
    if (recipes.data && selectedForHerd !== herdName) {
      setSelectedBom(recipes.data.standingBom);
      setSelectedForHerd(herdName);
    }
  }, [recipes.data, herdName, selectedForHerd]);

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

      {mode === "manual" ? (
        <ManualTab
          herd={herdName}
          recipes={recipes.data?.recipes ?? []}
          selectedBom={selectedBom}
          onSelectBom={setSelectedBom}
        />
      ) : (
        <SystemTab
          herd={herdName}
          recipes={recipes.data?.recipes ?? []}
          selectedBom={selectedBom}
          onSelectBom={setSelectedBom}
        />
      )}
    </Screen>
  );
}

const formatCreated = (raw: string): string => {
  const d = new Date(raw && raw.includes("T") ? raw : raw?.replace(" ", "T"));
  if (!raw || Number.isNaN(d.getTime())) return raw ?? "";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const recipeLabel = (r: HerdRecipe): string =>
  r.isStanding ? `Standing ration — ${r.itemName}` : `${r.itemName} · tuned ${formatCreated(r.created)}`;

/** Every recipe this herd has been fed under: the standing ration first and
 *  always the default, then whatever was tuned for it before, newest first —
 *  the order `herd_recipes` already returns them in.
 *
 *  Built on `Picker`, not `SearchPicker` or `FrappeSearchPicker`: this list is
 *  short and arrives whole with the herd (no remote search, no paging), which
 *  is exactly the case `Picker` is for — the other two exist for long or
 *  remote catalogues. `Picker`'s options are plain strings, so each recipe is
 *  folded into one label (item name, plus when it was made for a tuned one)
 *  rather than reaching for a bespoke row layout. */
function RecipePicker({
  recipes,
  value,
  onChange,
}: {
  recipes: HerdRecipe[];
  value: string;
  onChange: (bomNo: string) => void;
}) {
  const { labels, byLabel } = useMemo(() => {
    const seen = new Map<string, number>();
    const labels: string[] = [];
    const byLabel = new Map<string, string>();
    for (const r of recipes) {
      let label = recipeLabel(r);
      // Two tunes made the same minute of the same item would otherwise
      // collide on one label and silently pick whichever the Map keeps.
      const n = (seen.get(label) ?? 0) + 1;
      seen.set(label, n);
      if (n > 1) label = `${label} (${n})`;
      labels.push(label);
      byLabel.set(label, r.bomNo);
    }
    return { labels, byLabel };
  }, [recipes]);

  if (!labels.length) return null;

  const selectedIndex = recipes.findIndex((r) => r.bomNo === value);
  const currentLabel = labels[selectedIndex] ?? labels[0];

  return (
    <Picker
      value={currentLabel}
      onChange={(label) => {
        const bomNo = byLabel.get(label);
        if (bomNo) onChange(bomNo);
      }}
      options={labels}
    />
  );
}

/** Half a day's ration, or the whole day — the only two amounts a run is ever
 *  posted for. */
type Portion = 0.5 | 1;

/** Off = Half day, On = Full day — the fuller state is the "on" one. A bare
 *  switch does not say which side is which, so both states are labelled
 *  either side of the track, with the active one emphasised; the number
 *  itself (0.5 / 1) never appears in the UI, only these words. Built on the
 *  same `Switch` primitive as the profile's light/dark toggle — same
 *  construction, no new native module. */
function PortionSwitch({
  value,
  onChange,
  colors,
}: {
  value: Portion;
  onChange: (v: Portion) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const s = useMemo(() => makePortionSwitchStyles(colors), [colors]);
  const full = value === 1;

  return (
    <View style={s.row}>
      <Text style={[s.label, !full && s.labelActive]}>Half day</Text>
      <Switch
        checked={full}
        onChange={(next) => onChange(next ? 1 : 0.5)}
        accessibilityLabel="Portion for this run: half day or full day"
        icon={full ? "circle" : "circle-half-full"}
      />
      <Text style={[s.label, full && s.labelActive]}>Full day</Text>
    </View>
  );
}

const makePortionSwitchStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    label: { fontSize: 13, color: c.textSubtle, fontFamily: FONT_FAMILY.medium },
    labelActive: { color: c.text, fontFamily: FONT_FAMILY.semibold },
  });

/** The normal path: the herd's own BOM and head count, run for a fraction of
 *  the day. `date` now lets this post on a day other than today — wired
 *  through `useManufactureHerdFeed` to `manufactureHerdFeed`'s third
 *  argument, which was previously dead from this hook. */
function SystemTab({
  herd,
  recipes,
  selectedBom,
  onSelectBom,
}: {
  herd: string;
  recipes: HerdRecipe[];
  selectedBom: string;
  onSelectBom: (bomNo: string) => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const info = useHerdFeedInfo(herd);
  const day = useFeedDayStatus(herd);
  const manufacture = useManufactureHerdFeed();

  const [portion, setPortion] = useState<Portion | null>(null);
  const [date, setDate] = useState(todayISO());
  const [submitError, setSubmitError] = useState<string | null>(null);

  // What the picker's choice actually mixes: the selected recipe's own
  // per-head figures where one is resolved, falling back to `info` (always
  // the herd's standing BOM) until `recipes` has loaded. Recomputing this
  // from the payload `herd_recipes` already sent — rather than re-fetching a
  // preview for the chosen bom_no — is what "no extra round trip" means here
  // too, same as the Manual tab's rows.
  const selectedRecipe = recipes.find((r) => r.bomNo === selectedBom) ?? null;

  // The suggestion is a default, not a rule: half a fresh day, the remainder
  // after. Only seeded once — after that the operator's own choice on the
  // slider stands even if the day's status refetches. A suggestion outside
  // the slider's two stops (should never happen — the server only ever sends
  // 0.5 or 1) collapses to the safe default of a full day rather than being
  // silently dropped.
  useEffect(() => {
    if (day.data && portion === null) {
      setPortion(day.data.suggestedPortion === 0.5 ? 0.5 : 1);
    }
  }, [day.data, portion]);

  const portionNum: number = portion ?? 0;
  const d = info.data;
  const st = day.data;

  // One route, always: `manufactureHerdFeed` (the "manufacture" action),
  // whichever recipe is picked above. `record_feeding.py` now reads `bom_no`
  // for this action and validates it server-side (submitted, same production
  // item, belongs to the herd), so a previously-used recipe mixes exactly
  // like the standing ration — the herd's own registered head count, System
  // path, `feed_mode` "System". Nothing here is hand-tuned, so nothing here
  // should ever call `manualFeed`.
  const onRun = async () => {
    setSubmitError(null);
    if (!herd) return setSubmitError("Pick a herd.");
    if (!d) return setSubmitError("Still loading the herd's programme — try again in a moment.");
    if (portionNum <= 0) return setSubmitError("A run has to be for more than nothing.");
    try {
      const r = await manufacture.mutateAsync({
        herd,
        portion: portionNum,
        postingDate: date,
        bomNo: selectedBom || undefined,
      });
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

  // What the picker's choice actually mixes: the selected recipe's own
  // per-head figures where one has resolved, else `info`'s (always the
  // herd's standing BOM — `getHerdFeedInfo` cannot answer for another
  // recipe). Every recipe already arrived with its own `lines` in the
  // `herd_recipes` payload, so this is a client-side recompute, not a second
  // round trip — the same "already have it" reasoning the Manual tab's row
  // seeding below relies on.
  const active = selectedRecipe
    ? {
        itemName: selectedRecipe.itemName,
        perHeadQty: selectedRecipe.perHeadQty,
        uom: selectedRecipe.uom,
        lines: selectedRecipe.lines,
      }
    : {
        itemName: d.productionItemName,
        perHeadQty: d.perHeadQty,
        uom: d.uom,
        lines: d.lines.map((l) => ({
          itemCode: l.itemCode,
          itemName: l.itemName,
          qty: d.heads ? l.recipeQty / d.heads : 0,
          uom: l.recipeUom,
        })),
      };
  const activeTotal = active.perHeadQty * d.heads;

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

      <Field
        label="Recipe"
        help="Defaults to the herd's standing ration. Pick a recipe tuned for this herd before instead if this run should follow it."
      >
        <RecipePicker recipes={recipes} value={selectedBom} onChange={onSelectBom} />
      </Field>

      <View style={s.card}>
        <Text style={s.cardLbl}>Ration</Text>
        <Text style={s.cardTitle}>{active.itemName}</Text>
        <Text style={s.cardSub}>
          {d.heads} head × {active.perHeadQty.toLocaleString()} {active.uom} = {kg(activeTotal)} for
          a full day
        </Text>
      </View>

      <Field
        label="This run"
        help="Half is offered because the farm feeds twice; switch to Full day if this run covers the whole day instead."
      >
        <PortionSwitch value={portion ?? 1} onChange={setPortion} colors={c} />
      </Field>

      <Field label="Date fed">
        <DateField value={date} onChange={setDate} maximumDate={new Date()} />
      </Field>

      <Calc
        label="This run mixes and feeds"
        value={kg(activeTotal * portionNum)}
        footer={`${d.heads} head · mixed into ${d.store} and issued in the same action`}
      />

      <SectionTitle>Raw materials for this run</SectionTitle>
      <View style={s.box}>
        {/* Recipe units throughout, per-head and whole-run, so the two figures
            in a row can be read against each other — and so this reads in the
            same units as the Manual tab's editable boxes. The stock-unit twins
            (hay: 222 kg here, 15.54 BALE there) never belong in this row. */}
        {active.lines.map((l) => (
          <KV
            key={l.itemCode}
            k={`${l.itemName} (${l.qty.toLocaleString()} ${l.uom}/head)`}
            v={`${(l.qty * d.heads * portionNum).toLocaleString()} ${l.uom}`}
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
 *  `rows` seeds from the *selected recipe's* own `lines[]` — arriving as part
 *  of the same `herd_recipes` payload the recipe picker (`RecipePicker`,
 *  shared with the System tab) already fetched, so picking a recipe here is
 *  never a second round trip. Each line is already a per-head figure in the
 *  recipe's own unit of measure (`HerdRecipeLine.qty`/`uom` — `BOM Item.qty`,
 *  never `stock_qty`), so it is used exactly as it arrives.
 *
 *  This used to seed from `getHerdFeedInfo(herd).lines[]` (`recipeQty /
 *  heads`) — always the herd's *standing* BOM, with no way to start from a
 *  previously tuned one. Before that it read `info.breakdown[].perHeadQty`,
 *  which is not a key the "info" action returns at all, so every herd opened
 *  here showed "No ingredients. Add one below." The obvious repair then was
 *  the wrong one too: `breakdown` lives on the server's `get_herd_feed_info()`,
 *  whose `per_head_qty` is `required_qty / heads` with `required_qty` in STOCK
 *  units — hay is written 2 kg per head in the recipe and stocked in BALE at
 *  0.07 bale/kg, so that route would put 0.14 in a box labelled kg and send a
 *  fourteenth of the ration.
 *
 *  Every value typed here is sent to the server exactly as shown — never
 *  scaled by heads, never converted between UOMs. The server derives the
 *  conversion from the herd's BOM and multiplies by the head count itself;
 *  doing either of those here would silently issue the wrong amount of stock.
 */
function ManualTab({
  herd,
  recipes,
  selectedBom,
  onSelectBom,
}: {
  herd: string;
  recipes: HerdRecipe[];
  selectedBom: string;
  onSelectBom: (bomNo: string) => void;
}) {
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

  // Which recipe `rows` currently reflects, and a snapshot of the rows it was
  // seeded with — the pair `isDirty` below compares the live rows against, to
  // tell a tuned edit from an unopened recipe before letting a picker change
  // silently overwrite it.
  const [seededBom, setSeededBom] = useState<string | null>(null);
  const [seedSnapshot, setSeedSnapshot] = useState<string>("");

  // The head count still seeds once from the herd's registered count and is
  // then left alone — untouched by the recipe picker, per the brief. Only
  // where the ingredient rows come from has changed (below).
  useEffect(() => {
    if (!info || heads) return;
    setHeads(info.heads ? String(info.heads) : "");
  }, [info, heads]);

  // Rows seed from the *selected recipe's* own lines — already per-head, in
  // the recipe's own unit of measure, arrived with the `herd_recipes` payload
  // — never from `info.lines` (the herd's standing BOM only) and never
  // re-derived by dividing anything by heads. Seeds once per distinct
  // `selectedBom`: switching recipes reseeds; typing in a box does not, same
  // "seed once" shape as the old effect this replaces.
  useEffect(() => {
    if (!selectedBom || seededBom === selectedBom) return;
    const recipe = recipes.find((r) => r.bomNo === selectedBom);
    if (!recipe) return;
    const fresh: TunedRow[] = recipe.lines.map((l) => ({
      itemCode: l.itemCode,
      itemName: l.itemName,
      uom: l.uom,
      qty: String(l.qty),
    }));
    setRows(fresh);
    setSeededBom(selectedBom);
    setSeedSnapshot(JSON.stringify(fresh));
  }, [selectedBom, recipes, seededBom]);

  const isDirty = seedSnapshot !== "" && JSON.stringify(rows) !== seedSnapshot;

  // Switching recipes reseeds every row from scratch — so a tuned edit not
  // yet submitted would vanish silently. Warn and require confirmation rather
  // than either blocking the switch outright or losing the edit quietly;
  // "keep editing" leaves the picker showing the old recipe until confirmed.
  const requestRecipeChange = (bomNo: string) => {
    if (bomNo === selectedBom) return;
    if (!isDirty) return onSelectBom(bomNo);
    Alert.alert(
      "Switch recipe?",
      "You've changed quantities for the current recipe. Switching will replace them with the new recipe's amounts.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Switch recipe", style: "destructive", onPress: () => onSelectBom(bomNo) },
      ],
    );
  };

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
        // The recipe the operator was actually tuning from — so the BOM
        // `manual_feed` builds descends from what was on screen, not from
        // whichever BOM happens to be the herd's registered one.
        baseBom: selectedBom || undefined,
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

      <Field
        label="Start from"
        help="The rows below reload from whichever recipe is picked here. Untuned edits are confirmed before they're replaced."
      >
        <RecipePicker recipes={recipes} value={selectedBom} onChange={requestRecipeChange} />
      </Field>

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
