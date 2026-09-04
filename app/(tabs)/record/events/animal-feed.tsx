import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Calc } from "@/components/Calc";
import { ErrorState } from "@/components/ErrorState";
import { Field, Input } from "@/components/Field";
import { KV } from "@/components/KV";
import { Loader } from "@/components/Loader";
import { Picker } from "@/components/Picker";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useFeedDayStatus } from "@/src/hooks/useFeedDayStatus";
import { useHerdFeedInfo } from "@/src/hooks/useHerdFeedInfo";
import { useHerds } from "@/src/hooks/useHerds";
import { useManufactureHerdFeed } from "@/src/hooks/mutations";
import { extractFrappeError } from "@/src/services/api";

const kg = (n: number) => `${Number(n || 0).toLocaleString()} kg`;

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
 */
export default function AnimalFeed() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { data: herds = [], isLoading, error, refetch } = useHerds();

  const feedable = useMemo(() => herds.filter((h) => !!h.bom), [herds]);
  const [herdName, setHerdName] = useState<string>("");
  const [portion, setPortion] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!herdName && feedable.length) setHerdName(feedable[0].n);
  }, [feedable, herdName]);

  const info = useHerdFeedInfo(herdName);
  const day = useFeedDayStatus(herdName);
  const manufacture = useManufactureHerdFeed();

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
    if (!herdName) return setSubmitError("Pick a herd.");
    if (portionNum <= 0) return setSubmitError("A run has to be for more than nothing.");
    try {
      const r = await manufacture.mutateAsync({ herd: herdName, portion: portionNum });
      await Promise.all([info.refetch(), day.refetch()]);
      Alert.alert(
        "Mixed and fed",
        `${Number(r.produced_qty).toLocaleString()} ${r.uom} of ${r.production_item} ` +
          `mixed and issued to ${herdName}.\nWork Order ${r.work_order}.`,
      );
      router.replace("/(tabs)/record/success?name=Animal feeding");
    } catch (err) {
      setSubmitError(extractFrappeError(err));
    }
  };

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

      {info.isLoading || !d ? (
        <Loader />
      ) : (
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

          <Field
            label="This run"
            help="A fraction of the day. Half is offered because the farm feeds twice; change it if this run is a different size."
          >
            <Input
              value={portion}
              onChangeText={setPortion}
              keyboardType="decimal-pad"
              placeholder="0.5"
            />
          </Field>

          <Calc
            label="This run mixes and feeds"
            value={kg(d.totalManufactureQty * portionNum)}
            footer={`${d.heads} head · mixed into ${d.store} and issued in the same action`}
          />

          <SectionTitle>Raw materials for this run</SectionTitle>
          <View style={s.box}>
            {d.breakdown.map((b) => (
              <KV
                key={b.itemCode}
                k={`${b.itemName} (${b.perHeadQty.toLocaleString()} ${b.uom}/head)`}
                v={`${(b.totalQty * portionNum).toLocaleString()} ${b.uom}`}
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
            disabled={manufacture.isPending || !herdName || portionNum <= 0}
            onPress={onRun}
          />
        </>
      )}
    </Screen>
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
  });
