import { isEventEnabled } from "@/src/beef/events";

/**
 * The Shoats Record menu: Weigh sample first, then the rest. Hrefs are routes under app/(shoats)/record.
 *
 * `events` are the server's Livestock Event Types each entry stands for (shoats are
 * recorded by number, on their own doctypes, but a farm switches the event off once
 * for cattle and shoats alike — Settings -> Events). An entry of several stays while
 * any of them is on; the screen then offers only those. No `events` (the count
 * ledger: head count, death, sale, transfer…) is no event type and is never hidden.
 */
export type ShoatRecordItem = { icon: string; label: string; blurb: string; href: string; events?: readonly string[] };

export const SHOAT_RECORD_ITEMS: ShoatRecordItem[] = [
  { icon: "scale", label: "Weigh sample", blurb: "Weigh a few, record how many and the average", href: "/(shoats)/record/weigh", events: ["Weight Recording"] },
  { icon: "counter", label: "Count & movements", blurb: "Head count, death, purchase, sale, slaughter, transfer", href: "/(shoats)/record/count" },
  { icon: "heart", label: "Breeding", blurb: "Mating, lambing or kidding, weaning", href: "/(shoats)/record/breeding", events: ["Service", "Calving"] },
  { icon: "medical-bag", label: "Health", blurb: "Treatment, dipping, deworming, vaccination", href: "/(shoats)/record/health", events: ["Treatment", "Vaccination", "Deworming"] },
  { icon: "grain", label: "Feeding", blurb: "Feed the herd its ration", href: "/(shoats)/record/feeding", events: ["Feeding"] },
];

/** The shoat Record menu without the entries whose every event the farm switched off. */
export const visibleShoatItems = <I extends { events?: readonly string[] }>(
  items: readonly I[],
  disabled: readonly string[] | null | undefined,
): I[] => items.filter((it) => !it.events?.length || it.events.some((e) => isEventEnabled(e, disabled)));

/** The breeding screen's modes still on: Mating is a Service, a lambing/kidding a Calving; weaning is no event type. */
export const shoatBreedingModes = (
  disabled: readonly string[] | null | undefined,
): ("Mating" | "Birth" | "Weaning")[] => [
  ...(isEventEnabled("Service", disabled) ? (["Mating"] as const) : []),
  ...(isEventEnabled("Calving", disabled) ? (["Birth"] as const) : []),
  "Weaning",
];

/** Health types still on. A type that is no event type (Dipping) is never hidden. */
export const shoatHealthTypes = (types: readonly string[], disabled: readonly string[] | null | undefined): string[] =>
  types.filter((t) => isEventEnabled(t, disabled));

/** Is the shoat entry `leaf` (weigh, count, breeding, health, feeding) still on? For the herd page's buttons. */
export const shoatEntryOn = (leaf: string, disabled: readonly string[] | null | undefined): boolean =>
  visibleShoatItems(SHOAT_RECORD_ITEMS.filter((i) => i.href.endsWith(`/${leaf}`)), disabled).length > 0;
