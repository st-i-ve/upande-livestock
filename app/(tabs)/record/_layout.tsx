import { Stack } from "expo-router";
import React from "react";

import { RecordGate } from "@/components/RecordGate";
import { useColors } from "@/src/hooks/useColors";

/** Every record screen lives under here (or under animals/act, which re-exports
 *  them); the gate stops a user with no Employee at the door. */
export default function RecordStackLayout() {
  const c = useColors();
  return (
    <RecordGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: "fade",
        }}
      />
    </RecordGate>
  );
}
