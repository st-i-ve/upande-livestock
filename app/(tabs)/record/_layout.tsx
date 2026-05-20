import { Stack } from "expo-router";
import React from "react";

export default function RecordStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
        animation: "slide_from_right",
      }}
    />
  );
}
