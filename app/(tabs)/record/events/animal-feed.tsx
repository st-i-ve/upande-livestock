import { Redirect } from "expo-router";

export default function AnimalFeedRoute() {
  return <Redirect href="/(tabs)/record/events/feeding?tab=system" />;
}
