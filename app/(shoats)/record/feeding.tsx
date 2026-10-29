import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { Field, FieldRow } from "@/components/Field";
import { Loader } from "@/components/Loader";
import { OnlineOnlyNotice, useOffline } from "@/components/OnlineOnlyNotice";
import { Screen } from "@/components/Screen";
import { useDayField } from "@/components/shoats/DayField";
import { useHerdField } from "@/components/shoats/HerdField";
import { SaveBanners } from "@/components/shoats/SaveBanners";
import { RADIUS, font } from "@/constants/theme";
import { manufactureHerdFeed } from "@/src/frappe/feeding";
import { useColors } from "@/src/hooks/useColors";
import { useFeedDayStatus } from "@/src/hooks/useFeedDayStatus";
import { useHerdFeedInfo } from "@/src/hooks/useHerdFeedInfo";
import { extractFrappeError } from "@/src/services/api";
import { kg } from "@/src/shoats/logic";
import { refreshShoats } from "@/src/shoats/invalidate";

/**
 * Feeding a shoat herd its ration: the herd's own recipe at the head on the
 * ledger, mixed and issued through the same feeding path as cattle. Half a day
 * or a whole day; the day's status says what is still owed.
 */
export default function ShoatFeeding() {
  const c = useColors();
  const offline = useOffline();
  const qc = useQueryClient();
  const { herd, field } = useHerdField();
  const day = useDayField("Date of this feed");
  const info = useHerdFeedInfo(herd?.name);
  const status = useFeedDayStatus(herd?.name);
  const [portionPick, setPortion] = useState<0.5 | 1 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const st = status.data;
  const portion = portionPick ?? (st ? (st.suggestedPortion === 0.5 ? 0.5 : 1) : 1);
  const d = info.data;

  const run = async () => {
    if (!herd) return;
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const r = await manufactureHerdFeed(herd.name, portion, day.eventDate);
      setNote(`${Number(r.produced_qty).toLocaleString()} ${r.uom} of ${r.production_item} mixed and issued to ${herd.label} (${r.heads} head).`);
      refreshShoats(qc);
      await Promise.all([info.refetch(), status.refetch()]);
    } catch (e) {
      setError(extractFrappeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Feeding" subtitle="The herd's ration, by head" back>
      {field}
      {day.field}

      {herd && info.isLoading ? <Loader /> : null}
      {herd && info.error ? <Banner tone="warning">{extractFrappeError(info.error)}</Banner> : null}

      {herd && st ? (
        <View style={[styles.card, { borderColor: c.border }]}>
          <Text style={[styles.lbl, { color: c.textMuted }]}>Today</Text>
          <Text style={[styles.title, { color: c.text }]}>{kg(st.issuedKg)} fed of {kg(st.dayKg)}</Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>
            {st.complete ? "The day is fed." : `${kg(st.remainingKg)} still owed · run ${st.runsDone + 1} of ${st.runsPerDay}`}
          </Text>
        </View>
      ) : null}

      {herd && d ? (
        <View style={[styles.card, { borderColor: c.border }]}>
          <Text style={[styles.lbl, { color: c.textMuted }]}>Ration</Text>
          <Text style={[styles.title, { color: c.text }]}>{d.productionItemName || d.productionItem}</Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>{`${d.heads} head × ${d.perHeadQty} ${d.uom} = ${Math.round(d.perHeadQty * d.heads * 10) / 10} ${d.uom} a day`}</Text>
          {d.lines.map((l) => (
            <Text key={l.itemCode} style={[styles.line, { color: c.text }]}>
              {l.itemName} · {Math.round(l.recipeQty * portion * 10) / 10} {l.recipeUom}
              {l.shortQty > 0 ? ` (short ${l.shortQty})` : ""}
            </Text>
          ))}
        </View>
      ) : null}

      {herd && d ? (
        <Field label="This run covers">
          <Chips>
            <Chip label="Half the day" active={portion === 0.5} onPress={() => setPortion(0.5)} />
            <Chip label="A whole day" active={portion === 1} onPress={() => setPortion(1)} />
          </Chips>
        </Field>
      ) : null}

      <SaveBanners error={error} note={note} result={null} />
      <OnlineOnlyNotice />
      <FieldRow>
        <Button label={busy ? "Feeding…" : "Mix and feed"} disabled={offline || busy || !herd || !d} loading={busy} onPress={run} />
      </FieldRow>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12 },
  lbl: { fontSize: 11, ...font("500") },
  title: { fontSize: 18, ...font("600"), marginTop: 2 },
  sub: { fontSize: 12, marginTop: 2 },
  line: { fontSize: 13, marginTop: 6 },
});
