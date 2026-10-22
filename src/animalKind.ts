import type { ImageSourcePropType } from "react-native";

export type AnimalKind = "cow" | "heifer" | "calf" | "bull";

/** Generic photos (512px square) for an animal with no picture of her own.
 *  Sources and licences: assets/animals/CREDITS.md, ANIMAL_PHOTO_CREDITS below. */
export const KIND_IMAGES: Record<AnimalKind, ImageSourcePropType> = {
  cow: require("@/assets/animals/photo-cow.jpg"),
  heifer: require("@/assets/animals/photo-heifer.jpg"),
  calf: require("@/assets/animals/photo-calf.jpg"),
  bull: require("@/assets/animals/photo-bull.jpg"),
};

/** Shown on the Profile screen: CC BY and BY-SA ask for attribution. */
export const ANIMAL_PHOTO_CREDITS = [
  { kind: "cow", author: "Tom Igodt", licence: "CC BY 4.0" },
  { kind: "heifer", author: "John Haynes", licence: "CC BY-SA 2.0" },
  { kind: "calf", author: "Ranjithkumar Murugesan", licence: "CC0" },
  { kind: "bull", author: "Homoatrox", licence: "CC BY-SA 3.0" },
] as const;

export type KindFacts = {
  sex?: string | null;
  dob?: string | null;
  repro?: string | null;
  stage?: string | null;
};

const CALF_DAYS = 180;

/** Which generic picture an animal without a photo gets. */
export function kindOf(a: KindFacts | null | undefined): AnimalKind {
  if (!a) return "cow";
  const days = a.dob ? (Date.now() - new Date(a.dob).getTime()) / 86400000 : null;
  if (a.repro === "Calf" || (days != null && days >= 0 && days < CALF_DAYS)) return "calf";
  if (String(a.sex ?? "").toUpperCase().startsWith("M")) return "bull";
  if (a.stage === "heifer") return "heifer";
  return "cow";
}
