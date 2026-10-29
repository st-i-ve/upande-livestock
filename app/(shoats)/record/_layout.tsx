import { Stack } from "expo-router";
import React from "react";

import { RecordGate } from "@/components/RecordGate";
import { useColors } from "@/src/hooks/useColors";

/** Shoat record screens; the gate stops a user with no Employee at the door. */
export default function ShoatRecordLayout() {
  const c = useColors();
  return (
    <RecordGate>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: "fade" }} />
    </RecordGate>
  );
}
