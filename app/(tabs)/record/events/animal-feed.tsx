import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

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
import { useAuthStore } from "@/src/auth/authStore";
import { useFeedHerd, useManufactureHerdFeed } from "@/src/hooks/mutations";
import { useHerdFeedInfo } from "@/src/hooks/useHerdFeedInfo";
import { useHerds } from "@/src/hooks/useHerds";
import { extractFrappeError } from "@/src/services/api";

type Stage = "manufacture" | "feed";

const kg = (n: number) => `${Number(n || 0).toLocaleString()} kg`;

export default function AnimalFeed() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { data: herds = [], isLoading, error, refetch } = useHerds();
  const employeeName = useAuthStore((s) => s.employeeName);

  // Only herds with a BOM can be manufactured/fed.
  const feedable = useMemo(() => herds.filter((h) => !!h.bom), [herds]);

  const [herdName, setHerdName] = useState<string>("");
  const [stage, setStage] = useState<Stage>("manufacture");
  const [feedKg, setFeedKg] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!herdName && feedable.length) setHerdName(feedable[0].n);
  }, [feedable, herdName]);

  const info = useHerdFeedInfo(herdName);
  const manufacture = useManufactureHerdFeed();
  const feed = useFeedHerd();

  const available = info.data?.availableInStore ?? 0;
  const feedKgNum = Number(feedKg) || 0;

  const onManufacture = async () => {
    setSubmitError(null);
    if (!herdName) return setSubmitError("Pick a herd.");
    try {
      const r = await manufacture.mutateAsync(herdName);
      await info.refetch();
      Alert.alert(
        "Feed manufactured",
        `${r.produced_qty.toLocaleString()} ${r.uom} of ${r.production_item} made into ${r.store}.\n` +
          `Work Order ${r.work_order}.\nNow switch to Feed to issue it to the herd.`,
      );
      setStage("feed");
    } catch (err) {
      setSubmitError(extractFrappeError(err));
    }
  };

  const onFeed = async () => {
    setSubmitError(null);
    if (!herdName) return setSubmitError("Pick a herd.");
    if (feedKgNum <= 0) return setSubmitError("Enter how many kg to feed.");
    if (feedKgNum > available)
      return setSubmitError(`Only ${kg(available)} available in the store.`);
    try {
      const r = await feed.mutateAsync({
        herd: herdName,
        qty: feedKgNum,
        employee: employeeName || undefined,
      });
      await info.refetch();
      setFeedKg("");
      Alert.alert(
        "Herd fed",
        `Issued ${r.issued_qty.toLocaleString()} ${r.uom} of ${r.production_item} from ${r.store}.\n` +
          `Material Issue ${r.stock_entry}.`,
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

  const d = info.data;

  return (
    <Screen
      title="Animal feeding"
      subtitle={stage === "manufacture" ? "1 · Manufacture TMR" : "2 · Feed herd"}
      back
    >
      <Field label="Herd">
        <Picker value={herdName} onChange={setHerdName} options={feedable.map((h) => h.n)} />
      </Field>

      {/* Stage switcher */}
      <View style={s.tabs}>
        {(["manufacture", "feed"] as Stage[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setStage(t)}
            style={[s.tab, stage === t && s.tabActive]}
          >
            <Text style={[s.tabText, stage === t && s.tabTextActive]}>
              {t === "manufacture" ? "1 · Manufacture" : "2 · Feed"}
            </Text>
          </Pressable>
        ))}
      </View>

      {info.isLoading || !d ? (
        <Loader />
      ) : stage === "manufacture" ? (
        <>
          <View style={s.card}>
            <Text style={s.cardLbl}>BOM / TMR</Text>
            <Text style={s.cardTitle}>{d.bomNo}</Text>
            <Text style={s.cardSub}>Produces: {d.productionItemName}</Text>
            <Text style={s.cardSub}>
              {d.heads} head × {d.perHeadQty.toLocaleString()} {d.uom} = {kg(d.totalManufactureQty)}
            </Text>
          </View>

          <SectionTitle>Raw materials · {d.heads} head</SectionTitle>
          <View style={s.box}>
            {d.breakdown.map((b) => (
              <KV
                key={b.itemCode}
                k={`${b.itemName} (${b.perHeadQty.toLocaleString()} ${b.uom}/head)`}
                v={`${b.totalQty.toLocaleString()} ${b.uom}`}
              />
            ))}
          </View>

          <Calc
            label="Total feed to manufacture"
            value={kg(d.totalManufactureQty)}
            footer={`${d.heads} head × ${d.perHeadQty.toLocaleString()} ${d.uom} → ${d.store}`}
          />

          <Banner tone="info">
            Manufacturing runs a Work Order: raw materials transfer from their stores into{" "}
            {d.store}, then the finished feed is produced there.
          </Banner>

          {submitError ? <Banner tone="danger">{submitError}</Banner> : null}

          <Button
            label={manufacture.isPending ? "Manufacturing…" : "Manufacture feed"}
            disabled={manufacture.isPending || !herdName}
            loading={manufacture.isPending}
            onPress={onManufacture}
          />
        </>
      ) : (
        <>
          <View style={s.card}>
            <Text style={s.cardLbl}>Available in {d.store}</Text>
            <Text style={s.cardTitle}>{kg(available)}</Text>
            <Text style={s.cardSub}>{d.productionItemName}</Text>
          </View>

          {!employeeName ? (
            <Banner tone="warning">
              No Employee is linked to your login — the material issue needs one. Set it in Profile →
              My employee first.
            </Banner>
          ) : null}

          <Field label="Feed to issue (kg)" help={`Max ${kg(available)}`}>
            <Input value={feedKg} onChangeText={setFeedKg} keyboardType="numeric" placeholder="0" />
          </Field>

          <Calc
            label="Issuing to herd"
            value={feedKgNum > 0 ? kg(feedKgNum) : "—"}
            footer={`${d.productionItemName} · out of ${d.store} · ${herdName}`}
          />

          {available <= 0 ? (
            <Banner tone="info">
              Nothing in the store yet — manufacture the feed first (step 1).
            </Banner>
          ) : null}

          {submitError ? <Banner tone="danger">{submitError}</Banner> : null}

          <Button
            label={feed.isPending ? "Issuing…" : "Feed herd"}
            disabled={feed.isPending || feedKgNum <= 0 || feedKgNum > available}
            loading={feed.isPending}
            onPress={onFeed}
          />
        </>
      )}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    tabs: {
      flexDirection: "row",
      backgroundColor: c.bgMuted,
      borderRadius: RADIUS.md,
      padding: 3,
      marginBottom: 12,
    },
    tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: RADIUS.sm },
    tabActive: { backgroundColor: c.bg },
    tabText: { fontSize: 12, color: c.textMuted, fontFamily: FONT_FAMILY.semibold },
    tabTextActive: { color: c.text },
    card: { backgroundColor: c.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
    cardLbl: { fontSize: 11, color: c.textMuted },
    cardTitle: { fontSize: 15, fontWeight: "600", color: c.text, marginTop: 3 },
    cardSub: { fontSize: 11, color: c.textMuted, marginTop: 5 },
    box: { backgroundColor: c.bgMuted, padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
  });
