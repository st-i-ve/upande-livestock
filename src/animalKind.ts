import type { ImageSourcePropType } from "react-native";

export type AnimalKind = "cow" | "heifer" | "calf" | "bull" | "steer";

/** Generic photos (512px square) for an animal with no picture of her own.
 *  Sources and licences: assets/animals/CREDITS.md, ANIMAL_PHOTO_CREDITS below. */
export const KIND_IMAGES: Record<AnimalKind, ImageSourcePropType> = {
  cow: require("@/assets/animals/photo-cow.jpg"),
  heifer: require("@/assets/animals/photo-heifer.jpg"),
  calf: require("@/assets/animals/photo-calf.jpg"),
  bull: require("@/assets/animals/photo-bull.jpg"),
  steer: require("@/assets/animals/photo-steer.jpg"),
};

/** Shown on the Profile screen: CC BY and BY-SA ask for attribution. */
export const ANIMAL_PHOTO_CREDITS = [
  { kind: "cow", author: "Tom Igodt", licence: "CC BY 4.0" },
  { kind: "heifer", author: "John Haynes", licence: "CC BY-SA 2.0" },
  { kind: "calf", author: "Ranjithkumar Murugesan", licence: "CC0" },
  { kind: "bull", author: "Homoatrox", licence: "CC BY-SA 3.0" },
  { kind: "steer", author: "Scott Bauer, USDA ARS", licence: "Public domain" },
] as const;

export type KindFacts = {
  sex?: string | null;
  dob?: string | null;
  repro?: string | null;
  stage?: string | null;
};

const CALF_DAYS = 180;

/**
 * Which generic picture an animal without a photo gets: sex AND stage, as the
 * desk's placeholderKind(). A calf is a calf; a breeding bull is the bull; any
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
