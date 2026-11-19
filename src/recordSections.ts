import type { MaterialCommunityIcons } from "@expo/vector-icons";

/** The Record menu, as data so the feed-types filtering can be tested without a phone. */
export type RecordItem = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; href: string };

export const RECORD_SECTIONS: { title: string; items: RecordItem[] }[] = [
  { title: "Daily routine", items: [
    { icon: "water", label: "Milk recording", href: "/(tabs)/record/events/milk" },
    { icon: "grain", label: "Animal feeding (TMR)", href: "/(tabs)/record/events/animal-feed" },
    { icon: "clipboard-text-outline", label: "Feeding day: plan and amend", href: "/(tabs)/record/events/feed-day" },
    { icon: "chart-box-outline", label: "Daily feed report", href: "/(tabs)/record/events/feed-report" },
  ]},
  { title: "Health & breeding", items: [
    { icon: "magnify", label: "Check up", href: "/(tabs)/record/events/diagnosis" },
    { icon: "medical-bag", label: "Treatment (health file)", href: "/(tabs)/record/events/treatment" },
    { icon: "needle", label: "Vaccination", href: "/(tabs)/record/events/vaccination" },
    { icon: "bug", label: "Deworming", href: "/(tabs)/record/events/deworming" },
    { icon: "fire", label: "Heat detection", href: "/(tabs)/record/events/heat" },
    { icon: "heart", label: "Service / AI", href: "/(tabs)/record/events/service" },
    { icon: "clipboard-check", label: "Pregnancy diagnosis", href: "/(tabs)/record/events/pd" },
    { icon: "baby-bottle-outline", label: "Calving", href: "/(tabs)/record/events/calving" },
  ]},
  { title: "Husbandry", items: [
    { icon: "scale", label: "Weight recording", href: "/(tabs)/record/events/weight" },
    { icon: "arrow-left-right", label: "Movement", href: "/(tabs)/record/events/movement" },
    { icon: "content-cut", label: "Dehorning", href: "/(tabs)/record/events/dehorning" },
    { icon: "tools", label: "Hoof trimming", href: "/(tabs)/record/events/hoof" },
    { icon: "water-off", label: "Drying off", href: "/(tabs)/record/events/dryoff" },
  ]},
  { title: "Stores", items: [
    { icon: "warehouse", label: "Stock (read only)", href: "/(tabs)/record/stock" },
  ]},
];
