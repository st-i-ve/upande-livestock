import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Chip, Chips } from "@/components/Chips";
import { Pill } from "@/components/Pill";
import { FONT_FAMILY } from "@/constants/theme";
import { defaultChoice, segments, sessionLine, STATE_LABEL, type DaySession, type FeedChoice } from "@/src/feed/feedSessions";
import { useColors } from "@/src/hooks/useColors";

/** Not fed / Half fed (1 of 2) / Fully fed. */
export function SessionPill({ session }: { session: DaySession }) {
  return <Pill label={session.label || STATE_LABEL[session.state]} tone={session.state === "fully_fed" ? "success" : session.state === "half_fed" ? "warning" : "default"} />;
}

/** Shown on both feeding screens while a half-fed herd is owed its second session. */
export function SecondSessionBanner({ session, herdName }: { session: DaySession; herdName?: string }) {
  if (!session.secondDue) return null;
  return (
    <Banner tone="warning" icon="clock-alert-outline">
      Second session due{herdName ? ` for ${herdName}` : ""}. Half the day was fed; feed the other half.
    </Banner>
  );
}

/** The Full day / Half day choice, asked before every Mix. */
export function SessionPicker({
  session,
  value,
  onChange,
}: {
  session: DaySession;
  value: FeedChoice | null;
  onChange: (v: FeedChoice) => void;
}) {
  const c = useColors();
  const s = useMemo(() => StyleSheet.create({ label: { fontSize: 11, color: c.textMuted, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold } }), [c]);
  const current = value ?? defaultChoice(session);
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>Feed this time</Text>
      <Chips>
        {segments(session).map((o) => (
          <Chip key={o.value} label={o.label} active={current === o.value} onPress={() => onChange(o.value)} />
        ))}
      </Chips>
    </View>
  );
}

/** The day's sessions as chips: "Half day, session 1 of 2: 20 kg Calves Meal (amended)". */
export function SessionHistory({ session }: { session: DaySession }) {
  const c = useColors();
  if (!session.sessions.length) return null;
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 11, color: c.textMuted, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold }}>Fed today</Text>
      <Chips>
        {session.sessions.map((r, i) => (
          <Chip key={`${r.feedSession}-${i}`} label={sessionLine(r)} active tone={r.status === "Waiting for stock" ? "warning" : "default"} />
        ))}
      </Chips>
    </View>
  );
}
