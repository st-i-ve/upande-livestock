/**
 * One order, one grouping, one icon per event type, mirrored from the desk
 * (frontend/src/lib/event-catalog.json + event-icons.ts). To sync: regenerate
 * EVENT_GROUPS and EVENT_CATALOG below from that JSON; keep everything else.
 * `icon` is a lucide icon name; components/EventIcon.tsx maps it to the
 * lucide-react-native component. Pure data and helpers, so it is tested without a phone.
 */
export type EventGroupKey =
  | "servicing" | "health" | "quality" | "herd" | "production" | "husbandry" | "disposal";

export interface EventEntry {
  /** Livestock Event Type name; the catalog key for entries that are not one. */
  key: string;
  eventType: string | null;
  /** The desk route (the phone has its own routes: see EVENT_FOR_ROUTE). */
  view: string | null;
  label: string;
  group: EventGroupKey;
  icon: string;
}

export const EVENT_GROUPS: { key: EventGroupKey; label: string }[] = [
  { key: "servicing", label: "Servicing" },
  { key: "health", label: "Health" },
  { key: "quality", label: "Quality" },
  { key: "herd", label: "Herd" },
  { key: "production", label: "Production" },
  { key: "husbandry", label: "Husbandry" },
  { key: "disposal", label: "Disposal" },
];

export const EVENT_CATALOG: EventEntry[] = [
  { key: "Heat Detection", eventType: "Heat Detection", view: "heat", label: "Heat detection", group: "servicing", icon: "Flame" },
  { key: "Service", eventType: "Service", view: "service", label: "Service", group: "servicing", icon: "Dna" },
  { key: "Pregnancy Diagnosis", eventType: "Pregnancy Diagnosis", view: "diagnosis", label: "Pregnancy diagnosis", group: "servicing", icon: "ScanHeart" },
  { key: "Abortion", eventType: "Abortion", view: "abortion", label: "Abortion", group: "servicing", icon: "HeartCrack" },
  { key: "Calving", eventType: "Calving", view: "calving", label: "Calving", group: "servicing", icon: "Baby" },
  { key: "Birth", eventType: "Birth", view: null, label: "Birth", group: "servicing", icon: "Sparkles" },
  { key: "Check Up", eventType: "Check Up", view: "check-up", label: "Check-up", group: "health", icon: "Stethoscope" },
  { key: "Health Case", eventType: "Health Case", view: "health-case", label: "Case files", group: "health", icon: "ClipboardPlus" },
  { key: "Treatment", eventType: "Treatment", view: "treatment", label: "Treatment", group: "health", icon: "Pill" },
  { key: "Milk Quality", eventType: null, view: "quality", label: "Quality recording", group: "quality", icon: "FlaskConical" },
  { key: "Weight Recording", eventType: "Weight Recording", view: "weight", label: "Weight", group: "herd", icon: "Scale" },
  { key: "Movement", eventType: "Movement", view: "movement", label: "Movement", group: "herd", icon: "ArrowRightLeft" },
  { key: "Milking", eventType: "Milking", view: "milking", label: "Milking", group: "production", icon: "Droplets" },
  { key: "Drying Off", eventType: "Drying Off", view: "drying-off", label: "Drying off", group: "production", icon: "Moon" },
  { key: "Feeding", eventType: "Feeding", view: "feeding", label: "Feeding", group: "production", icon: "Utensils" },
  { key: "Vaccination", eventType: "Vaccination", view: null, label: "Vaccination", group: "husbandry", icon: "Syringe" },
  { key: "Deworming", eventType: "Deworming", view: null, label: "Deworming", group: "husbandry", icon: "Bug" },
  { key: "Dehorning", eventType: "Dehorning", view: null, label: "Dehorning", group: "husbandry", icon: "Scissors" },
  { key: "Hoof Trimming", eventType: "Hoof Trimming", view: null, label: "Hoof trimming", group: "husbandry", icon: "Footprints" },
  { key: "Cull Review", eventType: "Cull Review", view: "culling", label: "Culling", group: "disposal", icon: "Trash2" },
];

const BY_KEY = new Map(EVENT_CATALOG.map((e, i) => [e.key, { e, i }]));

/** The entry for an event type name or a catalog key. */
export const eventEntry = (eventType: string): EventEntry | undefined => BY_KEY.get(eventType)?.e;

/** The catalog's display position of an event type; unknown types sort last. */
export const eventRank = (eventType: string | null | undefined): number =>
  (eventType ? BY_KEY.get(eventType)?.i : undefined) ?? Infinity;

/** Sort items into the catalog order (stable; unknown types keep their relative order, last). */
export function sortByEvent<T>(items: readonly T[], eventOf: (t: T) => string | null): T[] {
  return items
    .map((t, i) => ({ t, i, r: eventRank(eventOf(t)) }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r < b.r ? -1 : 1))
    .map((x) => x.t);
}

/** The event types of one group, in order. */
export const groupEntries = (group: EventGroupKey): EventEntry[] => EVENT_CATALOG.filter((e) => e.group === group);
