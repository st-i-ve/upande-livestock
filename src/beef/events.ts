/**
 * Which Livestock Event Type each phone entry records, and the filter that
 * hides the ones a farm switched off (Settings -> Events on the server; the
 * bootstrap bundle's `disabled_events`). Pure, so it is tested without a phone.
 */

/** Route slug (the last part of a record href, or a quick action's route) -> event type. */
export const EVENT_FOR_ROUTE: Record<string, string> = {
  weight: "Weight Recording",
  service: "Service",
  pd: "Pregnancy Diagnosis",
  calving: "Calving",
  heat: "Heat Detection",
  movement: "Movement",
  // Calf separation is saved as a Movement event.
  separation: "Movement",
  diagnosis: "Check Up",
  treatment: "Treatment",
  vaccination: "Vaccination",
  deworming: "Deworming",
  dehorning: "Dehorning",
  hoof: "Hoof Trimming",
  "animal-feed": "Feeding",
};

/** The event type an href or route slug records, or null (stock and other non-event screens). */
export const eventForRoute = (hrefOrRoute: string): string | null => {
  const leaf = hrefOrRoute.split("?")[0].replace(/\/$/, "").split("/").pop() ?? "";
  return EVENT_FOR_ROUTE[leaf] ?? null;
};

/** The server's `disabled_events`, cleaned; anything missing or odd means nothing is off. */
export const mapDisabledEvents = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

export const isEventEnabled = (eventType: string | null | undefined, disabled: readonly string[] | null | undefined): boolean =>
  !eventType || !disabled?.length || !disabled.includes(eventType);

/** True when the entry at this href / route may be offered. */
export const isRouteEnabled = (hrefOrRoute: string, disabled: readonly string[] | null | undefined): boolean =>
  isEventEnabled(eventForRoute(hrefOrRoute), disabled);

/** The Record menu without switched-off events; a section left empty goes too. */
export const visibleSections = <S extends { items: { href: string }[] }>(
  sections: readonly S[],
  disabled: readonly string[] | null | undefined,
): S[] =>
  sections
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => isRouteEnabled(it.href, disabled)) }))
    .filter((sec) => sec.items.length > 0);

/** An animal's quick actions without switched-off events. */
export const visibleActions = <A extends { route: string }>(
  actions: readonly A[],
  disabled: readonly string[] | null | undefined,
): A[] => actions.filter((a) => isRouteEnabled(a.route, disabled));
