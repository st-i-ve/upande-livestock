import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

export type TimelineEvent = { date: string; title: string; desc?: string };

export function Timeline({ events }: { events: TimelineEvent[] }) {
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

const s = StyleSheet.create({
  item: { flexDirection: "row", paddingBottom: 12 },
  dotCol: { width: 18, alignItems: "center", paddingTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.text },
  line: { width: 1, flex: 1, backgroundColor: COLORS.borderSubtle, marginTop: 4 },
  body: { flex: 1, paddingLeft: 6 },
  date: { fontSize: 10, color: COLORS.textSubtle, marginBottom: 1 },
  title: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  desc: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
});
