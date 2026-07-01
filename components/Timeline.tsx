import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

export type TimelineEvent = { date: string; title: string; desc?: string };

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View>
      {events.map((e, i) => (
        <View key={i} style={s.item}>
          <View style={s.dotCol}>
            <View style={s.dot} />
            {i < events.length - 1 ? <View style={s.line} /> : null}
          </View>
          <View style={s.body}>
            <Text style={s.date}>{e.date}</Text>
            <Text style={s.title}>{e.title}</Text>
            {e.desc ? <Text style={s.desc}>{e.desc}</Text> : null}
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
    title: { fontSize: 12, fontWeight: "600", color: c.text },
    desc: { fontSize: 11, color: c.textMuted, marginTop: 1 },
  });
