import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AmendSheet } from "@/components/feed/AmendSheet";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Field } from "@/components/Field";
import { KV } from "@/components/KV";
import { Loader } from "@/components/Loader";
import { OfflineNotice } from "@/components/OnlineOnlyNotice";
import { Pill } from "@/components/Pill";
import { SecondSessionBanner, SessionHistory, SessionPicker, SessionPill } from "@/components/feed/SessionPanel";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { appetiteLabel, dayIsOpen, fmtKg, signedKg, signedPct, statusTone } from "@/src/feed/daySheet";
import { defaultChoice, guardChoice, halfLabel, type FeedChoice } from "@/src/feed/feedSessions";
import type { HerdDay } from "@/src/frappe/feedActuals";
import { useAmendFeedDay, useAnimalIntake, useFeedDayProgram, useManufactureActuals, useResetFeedDay } from "@/src/hooks/useFeedActuals";
import { useColors } from "@/src/hooks/useColors";
import { useFeedTypes } from "@/src/hooks/useFeedTypes";
import { useOperator } from "@/src/hooks/useOperator";
import { extractFrappeError, todayISO } from "@/src/services/api";

/**
 * The day's feeding sheet: per herd, what the recipe plans against what was
 * fed, with Amend (change the kg of any component actually fed), Mix actuals
 * (books the stock; stays a draft when stock is short) and per-animal intake.
 */
/** The screen, or why it is off: Settings -> Feed types can switch the day sheet off for the phone. */
export default function FeedDayGate() {
  const feedTypes = useFeedTypes();
  if (!feedTypes.day_sheet) {
    return (
      <Screen title="Feeding day" back>
        <Banner tone="warning">
          The feeding day sheet is switched off for the phone. Turn it on in Livestock Settings, under Feeding, Feed types.
        </Banner>
      </Screen>
    );
  }
  return <FeedDay />;
}

function FeedDay() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  // Saving never needs signal: the write is kept on the phone and sent later.
  const offline = false;
  const [date, setDate] = useState(todayISO());
  const q = useFeedDayProgram(date);
  const [amending, setAmending] = useState<HerdDay | null>(null);
  const [mixing, setMixing] = useState<{ day: HerdDay; choice: FeedChoice; override: boolean; warn?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [amendError, setAmendError] = useState<string | null>(null);
  const amend = useAmendFeedDay();
  const mix = useManufactureActuals();
  const reset = useResetFeedDay();
  const { operator } = useOperator();

  const doAmend = (changes: Record<string, number>, remarks: string) => {
    if (!amending) return;
    setAmendError(null);
    amend.mutate(
      { herd: amending.herd, date, kgByItem: changes, remarks },
      {
        onSuccess: () => {
          setNotice(`${amending.herdName}: amount fed saved on this phone.`);
          setAmending(null);
        },
        onError: (e) => setAmendError(extractFrappeError(e)),
      },
    );
  };

  const doReset = (d: HerdDay, fromSheet: boolean) => {
    setAmendError(null);
    reset.mutate(
      { herd: d.herd, date },
      {
        onSuccess: () => {
          setNotice(`${d.herdName}: back to the recipe for ${date}.`);
          if (fromSheet) setAmending(null);
        },
        onError: (e) => (fromSheet ? setAmendError(extractFrappeError(e)) : setNotice(extractFrappeError(e))),
      },
    );
  };

  // The write is queued, so the over-feed check is made here first, from the state the phone last saw.
  const askMix = (d: HerdDay, choice: FeedChoice) => {
    const g = guardChoice(d.session, choice);
    if (g.kind === "refuse") return setNotice(`${d.herdName}: ${g.message}`);
    setMixing({ day: d, choice, override: g.kind === "confirm", warn: g.kind === "confirm" ? g.message : undefined });
  };

  const doMix = () => {
    const m = mixing;
    if (!m) return;
    const d = m.day;
    setMixing(null);
    mix.mutate(
      { herd: d.herd, date, employee: operator, feedSession: m.choice, override: m.override || undefined },
      {
        onSuccess: () =>
          setNotice(`${d.herdName}: saved on this phone. It is mixed and issued when it reaches the server.`),
        onError: (e) => setNotice(extractFrappeError(e)),
      },
    );
  };

  return (
    <Screen
      title="Feeding day"
      subtitle="Plan against what was fed"
      back
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
      headerRight={
        <Pressable onPress={() => router.push("/(tabs)/record/events/feed-report")} hitSlop={8}>
          <Text style={s.link}>Report</Text>
        </Pressable>
      }
    >
      <OfflineNotice />
      <Field label="Day">
        <DateField value={date} onChange={setDate} maximumDate={fromISODate(todayISO())} />
      </Field>
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {q.isLoading ? <Loader /> : null}
      {q.error ? <ErrorState text={extractFrappeError(q.error)} onRetry={q.refetch} /> : null}
      {q.data?.setup.map((t) => <Banner key={t} tone="warning">{t}</Banner>)}
      {q.data && q.data.herds.length === 0 && !q.isLoading ? <Empty icon="grain" text="No herds to feed this day" /> : null}
      {q.data?.herds.map((d) => (
        <HerdCard
          key={d.herd}
          day={d}
          date={date}
          offline={offline}
          busy={mix.isPending}
          onAmend={() => {
            setAmendError(null);
            setAmending(d);
          }}
          onMix={(choice) => askMix(d, choice)}
          onReset={() => doReset(d, false)}
          resetting={reset.isPending}
        />
      ))}
      {q.data?.skipped.length ? (
        <>
          <SectionTitle>Not on the sheet</SectionTitle>
          {q.data.skipped.map((k) => <KV key={k.herd} k={k.herd} v={k.reason} />)}
        </>
      ) : null}

      {amending ? (
        <AmendSheet
          day={amending}
          offline={offline}
          saving={amend.isPending}
          error={amendError}
          onSave={doAmend}
          onReset={() => doReset(amending, true)}
          resetting={reset.isPending}
          onClose={() => setAmending(null)}
        />
      ) : null}
      <ConfirmModal
        visible={!!mixing}
        title={`Mix ${mixing?.day.herdName ?? ""}?`}
        message={
          `${mixing?.warn ? mixing.warn + "\n\n" : ""}` +
          `${mixing?.choice === "Half" ? halfLabel(mixing.day.session) : "Full day"}: this books ` +
          `${fmtKg((mixing?.day.actualKg ?? 0) * (mixing?.choice === "Half" ? 0.5 : 1))} of feed out of the store for ${date}` +
          `${mixing?.day.amended ? ", as amended" : ""}. If stock is short it is saved as a draft and waits for stock.`
        }
        confirmLabel="Mix and feed"
        onConfirm={doMix}
        onCancel={() => setMixing(null)}
      />
    </Screen>
  );
}

function HerdCard({
  day,
  date,
  offline,
  busy,
  onAmend,
  onMix,
  onReset,
  resetting,
}: {
  day: HerdDay;
  date: string;
  offline: boolean;
  busy: boolean;
  onAmend: () => void;
  onMix: (choice: FeedChoice) => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [showIntake, setShowIntake] = useState(false);
  const open = dayIsOpen(day);
  const intake = useAnimalIntake(day.herd, date, showIntake);
  const label = day.status === "Planned" && day.amended ? "Amended" : day.status;
  const [pick, setPick] = useState<FeedChoice | null>(null);
  const choice = pick ?? defaultChoice(day.session);
  const fed = day.session.state !== "not_fed";

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.herd}>{day.herdName}</Text>
          <Text style={s.meta}>{day.headCount} head</Text>
        </View>
        {fed ? <SessionPill session={day.session} /> : <Pill label={label} tone={statusTone(day.status)} />}
      </View>
      <SecondSessionBanner session={day.session} herdName={day.herdName} />
      <SessionHistory session={day.session} />

      <View style={s.totals}>
        <Total k="Plan" v={fmtKg(day.plannedKg)} sub={`${day.plannedPerHead.toFixed(2)} kg/head`} />
        <Total k="Fed" v={fmtKg(day.actualKg)} sub={`${day.actualPerHead.toFixed(2)} kg/head`} />
        <Total k="Difference" v={signedKg(day.varianceKg)} sub="" />
      </View>

      <View style={s.head}>
        <Text style={[s.th, { flex: 1 }]}>Component</Text>
        <Text style={[s.th, s.num]}>Plan</Text>
        <Text style={[s.th, s.num]}>Fed</Text>
      </View>
      {day.components.map((comp) => {
        const diff = Math.abs(comp.actualKg - comp.plannedKg) > 1e-6;
        return (
          <View key={comp.itemCode} style={s.line}>
            <Text style={[s.name, { flex: 1 }, comp.removed && s.struck]} numberOfLines={1}>{comp.itemName}</Text>
            <Text style={[s.cell, s.num]}>{fmtKg(comp.plannedKg)}</Text>
            <Text style={[s.cell, s.num, comp.removed && s.struck, diff && { color: c.text, fontFamily: FONT_FAMILY.semibold }]}>{fmtKg(comp.actualKg)}</Text>
          </View>
        );
      })}

      {day.status === "Waiting for stock" ? (
        <Banner tone="warning">Waiting for stock. A draft is saved{day.draftEntries.length ? ` (${day.draftEntries.join(", ")})` : ""}; post it once stock arrives.</Banner>
      ) : null}
      {day.components.some((x) => x.removed) ? <Text style={s.meta}>Struck through: not used this day, left out of the mix.</Text> : null}
      {day.remarks ? <Text style={s.meta}>Note: {day.remarks}</Text> : null}

      {open ? <SessionPicker session={day.session} value={choice} onChange={setPick} /> : null}
      <View style={s.actions}>
        <View style={{ flex: 1 }}>
          <Button label="Amend" variant="outline" icon="pencil-outline" disabled={!open || offline} onPress={onAmend} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={`${day.amended ? "Mix as amended" : "Confirm and mix"}${choice === "Half" ? " (half)" : ""}`} icon="grain" disabled={!open || offline || busy} loading={busy} onPress={() => onMix(choice)} />
        </View>
      </View>
      {day.amended && open && !fed ? (
        <Button label="Reset to recipe" variant="link" disabled={offline || resetting} loading={resetting} onPress={onReset} />
      ) : null}
      <Button
        label={showIntake ? "Hide intake per animal" : "Intake per animal"}
        variant="link"
        onPress={() => setShowIntake((v) => !v)}
      />
      {showIntake ? (
        intake.isLoading ? <Loader /> :
        intake.error ? <ErrorState text={extractFrappeError(intake.error)} onRetry={intake.refetch} /> :
        intake.data && intake.data.animals.length === 0 ? <Empty icon="cow" text="No animals fed in this herd" /> :
        intake.data ? (
          <View>
            <View style={s.head}>
              <Text style={[s.th, { flex: 1 }]}>Animal</Text>
              <Text style={[s.th, s.num]}>Plan</Text>
              <Text style={[s.th, s.num]}>Fed</Text>
              <Text style={[s.th, s.pct]}>+/-</Text>
              <Text style={[s.th, s.app]}>Appetite</Text>
            </View>
            {intake.data.animals.map((a) => (
              <View key={a.animal} style={s.line}>
                <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>{a.tag}</Text>
                <Text style={[s.cell, s.num]}>{fmtKg(a.plannedKg)}</Text>
                <Text style={[s.cell, s.num]}>{fmtKg(a.actualKg)}</Text>
                <Text style={[s.cell, s.pct]}>{signedPct(a.variancePct)}</Text>
                <Text style={[s.cell, s.app]}>{appetiteLabel(a.appetite)}</Text>
              </View>
            ))}
            <Text style={s.meta}>
              Below plan {intake.data.totals.belowPlan}, above plan {intake.data.totals.abovePlan}, on plan {intake.data.totals.onPlan}.
            </Text>
            <Text style={s.meta}>Per head: the herd&apos;s feed divided by the animals fed.</Text>
          </View>
        ) : null
      ) : null}
    </View>
  );
}

function Total({ k, v, sub, danger }: { k: string; v: string; sub: string; danger?: boolean }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.th}>{k}</Text>
      <Text style={[s.big, danger && { color: c.danger }]}>{v}</Text>
      {sub ? <Text style={s.meta}>{sub}</Text> : null}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    link: { color: c.text, fontSize: 13, fontFamily: FONT_FAMILY.semibold },
    card: { borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 12, marginTop: 12, gap: 6, backgroundColor: c.bg },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    herd: { fontSize: 16, color: c.text, fontFamily: FONT_FAMILY.semibold },
    meta: { fontSize: 11, color: c.textMuted },
    totals: { flexDirection: "row", gap: 8, paddingVertical: 6 },
    big: { fontSize: 15, color: c.text, fontFamily: FONT_FAMILY.semibold },
    head: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    th: { fontSize: 10, color: c.textMuted, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold },
    line: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
    name: { fontSize: 13, color: c.text },
    cell: { fontSize: 12, color: c.textMuted },
    num: { width: 74, textAlign: "right" },
    pct: { width: 50, textAlign: "right" },
    app: { width: 70, textAlign: "right" },
    struck: { textDecorationLine: "line-through", opacity: 0.55 },
    actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  });
