import { Stack } from "expo-router";
import React from "react";

import { useColors } from "@/src/hooks/useColors";

export default function AlertsStackLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: "slide_from_right",
      }}
    />
  );
}
