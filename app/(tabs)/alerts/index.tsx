import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { allAlerts } from "@/data/mock";

type Sev = "danger" | "default";

const SEV: Record<Sev, { bg: string; fg: string; border: string }> = {
  danger: {
    bg: `${COLORS.danger}14`,
    fg: COLORS.danger,
    border: `${COLORS.danger}33`,
  },
  default: {
    bg: COLORS.bgMuted,
    fg: COLORS.textMuted,
    border: COLORS.borderSubtle,
  },
};

export default function Alerts() {
  const dangerCount = allAlerts.filter((a) => a.sev === "danger").length;
  return (
    <Screen
      title="Action queue"
      subtitle={`${allAlerts.length} items · ${dangerCount} urgent`}
    >
      <View style={s.list}>
        {allAlerts.map((a, i) => {
          const sev = (a.sev as Sev) || "default";
          const tone = SEV[sev];
          const last = i === allAlerts.length - 1;
          return (
            <View key={i}>
              <View style={s.row}>
                <View
                  style={[
                    s.iconWrap,
                    { backgroundColor: tone.bg, borderColor: tone.border },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={a.ic as any}
                    size={20}
                    color={tone.fg}
                  />
                </View>
                <View style={s.body}>
                  <Text style={s.title} numberOfLines={2}>
                    {a.t}
                  </Text>
                  <Text style={s.meta} numberOfLines={2}>
                    {a.s}
                  </Text>
                </View>
                <Button label="Resolve" variant="link" />
              </View>
              {last ? null : <View style={s.divider} />}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  list: {},
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.semibold,
    fontWeight: "600",
    color: COLORS.text,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.regular,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginLeft: 40 + 12, // align with the title (after icon)
  },
});
