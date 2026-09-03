import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Text } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/src/auth/authStore";

export default function EventSuccess() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const fullname = useAuthStore((st) => st.fullname);
  return (
    <Screen title={name || "Submitted"} subtitle="Submitted" back>
      <Banner tone="success">
        <Text style={{ fontWeight: "700" }}>{name} submitted</Text>
        {fullname ? `\nRecorded by ${fullname}.` : ""}
      </Banner>
      {/* "/(tabs)" no longer resolves — there is no tabs index route. Done
          returns to the event list, which is where the next entry starts. */}
      <Button label="Done" onPress={() => router.replace("/(tabs)/record")} />
      <Button label="Record another" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}
