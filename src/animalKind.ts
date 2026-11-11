export type AnimalKind = "cow" | "heifer" | "calf" | "bull" | "steer";

export type KindFacts = {
  sex?: string | null;
  dob?: string | null;
  repro?: string | null;
  stage?: string | null;
};

const CALF_DAYS = 180;

/**
 * What kind of animal she is, for the actions offered on her page (the picture
 * an animal with no photo wears is src/silhouettes.ts). A calf is a calf; a breeding bull is the bull; any
 * other male (weaner, grower, finisher, market, steer) is the steer picture,
 * never a heifer or cow; a heifer is a heifer; other females are the cow.
 */
export function kindOf(a: KindFacts | null | undefined): AnimalKind {
  if (!a) return "cow";
  const male = String(a.sex ?? "").toUpperCase().startsWith("M");
  const female = String(a.sex ?? "").toUpperCase().startsWith("F");
  const days = a.dob ? (Date.now() - new Date(a.dob).getTime()) / 86400000 : null;
  const young = days != null && days >= 0 && days < CALF_DAYS;
  if (a.stage === "calf" || a.repro === "Calf" || (!a.stage && young)) return "calf";
  if (male) return a.stage === "bull" ? "bull" : "steer";
  if (a.stage === "heifer") return "heifer";
  return female ? "cow" : "steer";
}
