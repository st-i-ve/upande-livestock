import type { MaterialCommunityIcons } from "@expo/vector-icons";

import { eventEntry, sortByEvent } from "./events/eventCatalog.ts";

/**
 * The Record menu, as data so the feed-types filtering can be tested without a phone.
 * An item that records an event carries its Livestock Event Type: its icon comes
 * from the shared event catalog (the desk's lucide icons) and the order inside a
 * section follows the catalog. Items with no event use a plain icon.
 */
export type RecordItem = { icon?: keyof typeof MaterialCommunityIcons.glyphMap; event?: string; label: string; href: string };

const ev = (event: string, href: string, label?: string): RecordItem => ({
  event,
  href,
  label: label ?? eventEntry(event)?.label ?? event,
});

const ordered = (items: RecordItem[]) => sortByEvent(items, (i) => i.event ?? null);

export const RECORD_SECTIONS: { title: string; items: RecordItem[] }[] = [
  // Breeding, in the order of a cow's cycle (Abortion and Birth are outcomes on the Calving screen).
  { title: "Servicing", items: ordered([
    ev("Heat Detection", "/(tabs)/record/events/heat"),
    ev("Service", "/(tabs)/record/events/service"),
    ev("Pregnancy Diagnosis", "/(tabs)/record/events/pd"),
    ev("Calving", "/(tabs)/record/events/calving"),
  ]) },
  { title: "Health", items: ordered([
    ev("Check Up", "/(tabs)/record/events/diagnosis"),
    ev("Treatment", "/(tabs)/record/events/treatment", "Treatment (health file)"),
  ]) },
  // The Quality section is placed here by the Record screen for the roles that may record it.
  { title: "Daily routine", items: [
    ev("Milking", "/(tabs)/record/events/milk", "Milk recording"),
    ev("Feeding", "/(tabs)/record/events/feeding"),
    { icon: "chart-box-outline", label: "Daily feed report", href: "/(tabs)/record/events/feed-report" },
  ]},
  { title: "Husbandry", items: ordered([
    ev("Weight Recording", "/(tabs)/record/events/weight", "Weight recording"),
    ev("Movement", "/(tabs)/record/events/movement"),
    ev("Drying Off", "/(tabs)/record/events/dryoff"),
    ev("Vaccination", "/(tabs)/record/events/vaccination"),
    ev("Deworming", "/(tabs)/record/events/deworming"),
    ev("Dehorning", "/(tabs)/record/events/dehorning"),
    ev("Hoof Trimming", "/(tabs)/record/events/hoof"),
  ]) },
  { title: "Stores", items: [
    { icon: "warehouse", label: "Stock (read only)", href: "/(tabs)/record/stock" },
  ]},
];
