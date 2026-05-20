import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AnimalRow } from "@/components/AnimalRow";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Empty } from "@/components/Empty";
import { MetricGrid } from "@/components/MetricGrid";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { COLORS, RADIUS } from "@/constants/theme";
import { animals, herds } from "@/data/mock";

export default function HerdDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const h = herds.find((x) => x.n === decodeURIComponent(name || ""));
  if (!h) {
    return (
      <Screen title="Not found" back>
        <Banner tone="warning">Herd not found.</Banner>
      </Screen>
    );
  }
  const inHerd = animals.filter((a) => a.herd === h.n);

  return (
    <Screen title={h.n} subtitle={h.cat} back>
      <MetricGrid
        items={[
          { label: "Animals", value: h.cnt },
          { label: "Cost centre", value: h.cc, small: true },
        ]}
      />

      <SectionTitle>Feeding plan (TMR / BOM)</SectionTitle>
      <View style={s.bom}>
        <Text style={s.bomTitle}>{h.bom}</Text>
        <Text style={s.bomSub}>Linked BOM determines cost-per-kg DMI for this herd</Text>
        <Button label="View ration items" variant="outline" />
      </View>

      <SectionTitle>
        Animals in herd {inHerd.length ? `(${inHerd.length} of ${h.cnt} shown)` : ""}
      </SectionTitle>
      {inHerd.length ? (
        inHerd.map((a) => (
          <AnimalRow
            key={a.id}
            a={a}
            meta={`${a.id} · ${a.lastWt} kg`}
            onPress={() => router.push(`/(tabs)/animals/${encodeURIComponent(a.id)}`)}
          />
        ))
      ) : (
        <Empty text="Not all herd members loaded in demo" />
      )}

      <SectionTitle>Quick actions</SectionTitle>
      <Button label="Feed this herd" icon="grain" variant="outline" onPress={() => router.push("/(tabs)/record/events/animal-feed")} />
      <Button label="Record milking" icon="water" variant="outline" onPress={() => router.push("/(tabs)/record/events/milk")} />
    </Screen>
  );
}

const s = StyleSheet.create({
  bom: {
    backgroundColor: COLORS.bgMuted,
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 14,
  },
  bomTitle: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  bomSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
});
