import { router } from "expo-router";
import React from "react";

import { Avatar } from "@/components/Avatar";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { herds } from "@/data/mock";

export default function HerdsList() {
  return (
    <Screen title="Herds" subtitle="12 herds · 462 animals" back>
      {herds.map((h) => (
        <Row
          key={h.n}
          left={<Avatar icon="fence" />}
          title={h.n}
          meta={`${h.cat} · ${h.cnt} head · ${h.cc}`}
          chevron
          onPress={() => router.push(`/(tabs)/animals/herds/${encodeURIComponent(h.n)}`)}
        />
      ))}
    </Screen>
  );
}
