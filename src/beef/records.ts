/**
 * The Record menu, in the order Mutara wants it: Weight first (the herdsman's
 * first job), then breeding, movement, health, husbandry and stores.
 * Hrefs are the record routes under app/(tabs)/record.
 */
export type RecordItem = { icon: string; label: string; href: string };
export type RecordSection = { title: string; items: RecordItem[] };

export const WEIGHT_HREF = "/(tabs)/record/events/weight";

export const RECORD_SECTIONS: RecordSection[] = [
  {
    title: "Weight",
    items: [{ icon: "scale", label: "Weight recording", href: WEIGHT_HREF }],
  },
  {
    title: "Breeding",
    items: [
      { icon: "heart", label: "Service (natural or AI)", href: "/(tabs)/record/events/service" },
      { icon: "clipboard-check", label: "Pregnancy diagnosis", href: "/(tabs)/record/events/pd" },
      { icon: "baby-bottle-outline", label: "Calving", href: "/(tabs)/record/events/calving" },
      { icon: "fire", label: "Heat detection", href: "/(tabs)/record/events/heat" },
    ],
  },
  {
    title: "Movement",
    items: [
      { icon: "arrow-left-right", label: "Movement", href: "/(tabs)/record/events/movement" },
      { icon: "cow-off", label: "Calf separation", href: "/(tabs)/record/events/separation" },
    ],
  },
  {
    title: "Health",
    items: [
      { icon: "magnify", label: "Check up", href: "/(tabs)/record/events/diagnosis" },
      { icon: "medical-bag", label: "Treatment (health file)", href: "/(tabs)/record/events/treatment" },
      { icon: "needle", label: "Vaccination", href: "/(tabs)/record/events/vaccination" },
      { icon: "bug", label: "Deworming", href: "/(tabs)/record/events/deworming" },
    ],
  },
  {
    title: "Husbandry",
    items: [
      { icon: "content-cut", label: "Dehorning", href: "/(tabs)/record/events/dehorning" },
      { icon: "tools", label: "Hoof trimming", href: "/(tabs)/record/events/hoof" },
      { icon: "grain", label: "Animal feeding", href: "/(tabs)/record/events/animal-feed" },
    ],
  },
  {
    title: "Stores",
    items: [{ icon: "warehouse", label: "Stock (read only)", href: "/(tabs)/record/stock" }],
  },
];
