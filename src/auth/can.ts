/**
 * What the signed-in user may do, in one place the phone asks.
 *
 * The rule: if someone should not access something, take it out of their view
 * (hide, never grey out or refuse after a tap). The server decides: the desk's
 * `capabilities()` map (read/create/write per doctype plus role-gated flags) rides
 * on `posting_day`, is cached here with the roles, and the menus read it. A phone
 * with no map (an older server, nothing cached yet) hides nothing; the server
 * still refuses what it must.
 */
export type Capabilities = {
  read: Record<string, boolean>;
  create: Record<string, boolean>;
  write: Record<string, boolean>;
  stock: boolean;
  post_draft: boolean;
  override_feed: boolean;
  insure: boolean;
  accounts: boolean;
  appreciate: boolean;
  cull_vet: boolean;
  cull_manager: boolean;
  quality: boolean;
  operator: boolean;
};

export type Can = Capabilities | null | undefined;

/** The map as the server sent it, or null when it sent none (or something else). */
export const mapCapabilities = (raw: unknown): Capabilities | null => {
  const m = raw as Partial<Capabilities> | null | undefined;
  if (!m || typeof m !== "object" || typeof m.read !== "object" || !m.read || typeof m.create !== "object" || !m.create) return null;
  return { ...(m as Capabilities), write: m.write ?? {} };
};

export const canRead = (can: Can, doctype: string): boolean => !can || !!can.read?.[doctype];
export const canCreate = (can: Can, doctype: string): boolean => !can || !!can.create?.[doctype];
export const canFlag = (can: Can, flag: Exclude<keyof Capabilities, "read" | "create" | "write">): boolean => !can || !!can[flag];

/** Mixing and issuing feed moves stock: the stores and manager roles (guard_stock). */
export const canMix = (can: Can): boolean => canFlag(can, "stock");
/** Amending or resetting a feeding day writes the day's actuals. */
export const canAmend = (can: Can): boolean => canCreate(can, "Livestock Feed Actual");

type Need = { read?: string[]; create?: string[]; flag?: "stock"; any?: Array<{ create?: string; flag?: "stock" }> };
const EVENT: Need = { create: ["Livestock Event"] };

/**
 * What each record screen (the last segment of its route) needs, read off the
 * guards of the endpoints it calls: the desk's VIEW_NEEDS, by phone route.
 */
export const ROUTE_NEEDS: Record<string, Need> = {
  milk: { read: ["Milk Recording"], create: ["Milk Recording"] },
  "animal-feed": { flag: "stock" },
  "feed-day": { read: ["Herds"], any: [{ flag: "stock" }, { create: "Livestock Feed Actual" }] },
  "feed-report": { read: ["Herds", "Animal"] },
  weight: { create: ["Livestock Weight Record"] },
  diagnosis: { create: ["Livestock Diagnosis"] },
  treatment: { create: ["Livestock Health Case"] },
  stock: { read: ["Herds"] },
  heat: EVENT,
  service: EVENT,
  pd: EVENT,
  calving: EVENT,
  dryoff: EVENT,
  vaccination: EVENT,
  deworming: EVENT,
  dehorning: EVENT,
  hoof: EVENT,
  movement: EVENT,
};

const lastSegment = (hrefOrRoute: string) => hrefOrRoute.split("?")[0].split("/").filter(Boolean).pop() ?? "";

/** May the user open this record screen / use this quick action? Unknown routes stay. */
export const routeAllowed = (hrefOrRoute: string, can: Can): boolean => {
  const need = ROUTE_NEEDS[lastSegment(hrefOrRoute)];
  if (!need || !can) return true;
  return (
    (need.read ?? []).every((d) => canRead(can, d)) &&
    (need.create ?? []).every((d) => canCreate(can, d)) &&
    (!need.flag || canFlag(can, need.flag)) &&
    (!need.any || need.any.some((a) => (a.create ? canCreate(can, a.create) : false) || (a.flag ? canFlag(can, a.flag) : false)))
  );
};

/** The Record menu without what the user's rights do not cover; a section left empty goes too. */
export const sectionsFor = <S extends { items: { href: string }[] }>(sections: readonly S[], can: Can): S[] =>
  sections
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => routeAllowed(it.href, can)) }))
    .filter((sec) => sec.items.length > 0);

/** An animal's quick actions without what the user's rights do not cover. */
export const actionsFor = <A extends { route: string }>(actions: readonly A[], can: Can): A[] =>
  actions.filter((a) => routeAllowed(a.route, can));
