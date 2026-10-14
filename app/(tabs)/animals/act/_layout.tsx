import { Stack } from "expo-router";
import React from "react";

import { RecordGate } from "@/components/RecordGate";
import { useColors } from "@/src/hooks/useColors";

/** Record screens opened from an animal or herd, kept inside the Animals stack
 *  so they never pollute the Record tab's. Same gate as the Record stack. */
export default function ActLayout() {
  const c = useColors();
  return (
    <RecordGate>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: "fade" }} />
    </RecordGate>
  );
}
