import { useLocalSearchParams } from "expo-router";
import React from "react";

import { AnimalDetail } from "@/components/screens/AnimalDetail";

export default function AnimalDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AnimalDetail id={id ?? ""} />;
}
