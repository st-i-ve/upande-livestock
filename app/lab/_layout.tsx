import { Stack } from "expo-router";
import React from "react";

import { useColors } from "@/src/hooks/useColors";

/**
 * Quality: the history (index) and the recording form (record), a stack at the
 * app's root. They used to be a hidden tab and a hidden sibling of it: the
 * Quality tab is `href: null` for everyone who can record, and opening a hidden
 * tab route (from the Record menu, or the form from the lab's only tab) is
 * resolved by the tab navigator, which fell back to its first tab, Animals: the
 * "back at the index" bug. A root stack is opened the same way for every role.
 */
export default function QualityStackLayout() {
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
