import { Stack } from "expo-router";
import React from "react";

import { QualityOnlyGate } from "@/components/QualityOnlyGate";
import { useColors } from "@/src/hooks/useColors";

export default function AnimalsStackLayout() {
  const c = useColors();
  return (
    <QualityOnlyGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: "fade",
        }}
      />
    </QualityOnlyGate>
  );
}
