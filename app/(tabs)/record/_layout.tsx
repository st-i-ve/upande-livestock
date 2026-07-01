import { Stack } from "expo-router";
import React from "react";

import { useColors } from "@/src/hooks/useColors";

export default function RecordStackLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: "fade",
      }}
    />
  );
}
