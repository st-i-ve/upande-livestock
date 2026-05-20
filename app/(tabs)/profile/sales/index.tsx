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

export default function SalesList() {
  return (
    <Screen title="Sales" subtitle="Animals sold to buyers" back>
      <SectionHeader title="Year-to-date" subtitle="Revenue and profit summary" />
      <MetricGrid
        items={[
          { label: "YTD revenue", value: "285,000", sub: "3 sales · KES" },
          { label: "YTD net P&L", value: "+55,000", sub: "vs book value" },
        ]}
      />

      <Divider />

      <SectionHeader title="Record a new sale" subtitle="Posts gain/loss to the GL" />
      <Button label="Record sale" icon="cash" onPress={() => router.push("/(tabs)/record/sales/new")} />

      <Divider />

      <SectionHeader title="Recent sales" subtitle="Last three transactions" />
      <Row left={<Avatar icon="cash" tone="calf" />} title="TESTDAM-001/22 → Mwangi Butchery" meta="9 May · 95,000 KES · loss 25,000" />
      <Row left={<Avatar icon="cash" tone="calf" />} title="ANAIAH-129273 → Eldoret Co-op" meta="3 Apr · 95,000 KES · gain 15,000" />
      <Row left={<Avatar icon="cash" tone="calf" />} title="ARSHAVIN-129279 → Direct buyer" meta="22 Mar · 95,000 KES · gain 65,000" />
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
