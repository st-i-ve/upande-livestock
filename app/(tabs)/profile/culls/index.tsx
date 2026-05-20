import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Divider } from "@/components/Divider";
import { MetricGrid } from "@/components/MetricGrid";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { COLORS, FONT_FAMILY } from "@/constants/theme";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function CullsList() {
  return (
    <Screen title="Culls / deaths" subtitle="Animals removed without sale" back>
      <SectionHeader title="Year-to-date" subtitle="Write-offs and leading causes" />
      <MetricGrid
        items={[
          { label: "YTD write-off", value: "−620,000", sub: "7 animals · KES" },
          { label: "Top reason", value: "Mastitis", sub: "3 animals", small: true },
        ]}
      />

      <Divider />

      <SectionHeader title="Record a cull or death" subtitle="Writes the asset off the GL" />
      <Button
        label="Record cull / death"
        icon="delete"
        variant="danger"
        onPress={() => router.push("/(tabs)/record/culls/new")}
      />

      <Divider />

      <SectionHeader title="Recent removals" subtitle="Last entries with book value impact" />
      <Row left={<Avatar icon="delete" tone="danger" />} title="JACKI-129390 · Culled (Farm Use)" meta="2 May · book 150,000 written off" />
      <Row left={<Avatar icon="delete" tone="danger" />} title="VICTOR-129572 · Died — Disease" meta="14 Apr · book 120,000 written off" />
    </Screen>
  );
}

const s = StyleSheet.create({
  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
    marginTop: 3,
  },
});
