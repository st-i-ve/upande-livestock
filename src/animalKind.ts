import type { ImageSourcePropType } from "react-native";

export type AnimalKind = "cow" | "heifer" | "calf" | "bull";

/** Black silhouettes, tinted by the theme where they are shown. Drawn by
 *  scripts/build_animal_silhouettes.py from the desk's cow mark. */
export const KIND_IMAGES: Record<AnimalKind, ImageSourcePropType> = {
  cow: require("@/assets/animals/cow.png"),
  heifer: require("@/assets/animals/heifer.png"),
  calf: require("@/assets/animals/calf.png"),
  bull: require("@/assets/animals/bull.png"),
};

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
