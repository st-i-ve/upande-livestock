import React, { useMemo } from "react";
import { font } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";
import { Pill } from "@/components/Pill";
import { BACKDATE_AMBER_DARK, BACKDATE_AMBER_LIGHT } from "@/components/BackdateButton";
import { useColors } from "@/src/hooks/useColors";
import { useScheme } from "@/src/theme/themeStore";

export type TimelineEvent = {
  date: string;
  title: string;
  desc?: string;
  /** `custom_is_backdated` off the source doc. Only ever `true` reaches here —
   *  an absent/falsy field must render nothing, not an empty pill. */
  isBackdated?: boolean;
  /** `custom_feed_mode` off a Feeding event. Only "Manual" draws a pill. */
  feedMode?: string | null;
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const amber = useScheme() === "dark" ? BACKDATE_AMBER_DARK : BACKDATE_AMBER_LIGHT;
  return (
    <View>
      {events.map((e, i) => (
        <View key={i} style={s.item}>
          <View style={s.dotCol}>
            <View style={s.dot} />
            {i < events.length - 1 ? <View style={s.line} /> : null}
          </View>
          {/* A backdated record is tinted as well as badged, so a back-recorded
              service is never read as a same-day one at a glance. */}
          <View
            style={[s.body, e.isBackdated && { backgroundColor: `${amber}14`, borderRadius: 6, paddingVertical: 4 }]}
            accessibilityLabel={e.isBackdated ? `${e.title}, backdated` : undefined}
          >
            <Text style={s.date}>{e.date}</Text>
            <Text style={s.title}>{e.title}</Text>
            {e.desc ? <Text style={s.desc}>{e.desc}</Text> : null}
            {e.isBackdated || e.feedMode === "Manual" ? (
              <View style={s.badgeRow}>
                {e.isBackdated ? <Pill label="Backdated" tone="amber" /> : null}
                {e.feedMode === "Manual" ? <Pill label="Manual" tone="amber" /> : null}
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    item: { flexDirection: "row", paddingBottom: 12 },
    dotCol: { width: 18, alignItems: "center", paddingTop: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.text },
    line: { width: 1, flex: 1, backgroundColor: c.borderSubtle, marginTop: 4 },
    body: { flex: 1, paddingLeft: 6 },
    date: { fontSize: 10, color: c.textSubtle, marginBottom: 1 },
    title: { fontSize: 12, ...font("600"), color: c.text },
    desc: { fontSize: 11, color: c.textMuted, marginTop: 1 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  });
