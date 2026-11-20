import { Redirect } from "expo-router";

export default function FeedDayRoute() {
  return <Redirect href="/(tabs)/record/events/feeding?tab=day_sheet" />;
}
