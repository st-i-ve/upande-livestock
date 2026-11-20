/**
 * What the animal page writes on its picture (photo or silhouette), besides the
 * name and number: her sex on the left, the breed and the stream (Feedlot /
 * Breeding) as chips on the right. A value that is not known is left off.
 */
export type HeroInfo = {
  sex: { label: "Male" | "Female"; icon: "gender-male" | "gender-female" } | null;
  chips: { key: "breed" | "stream"; label: string }[];
};

export function heroInfo(a: { sex?: string | null; breed?: string | null; stream?: string | null }): HeroInfo {
  const s = String(a.sex ?? "").trim().toUpperCase();
  const sex =
    s === "M" || s === "MALE"
      ? ({ label: "Male", icon: "gender-male" } as const)
      : s === "F" || s === "FEMALE"
        ? ({ label: "Female", icon: "gender-female" } as const)
        : null;
  const chips: HeroInfo["chips"] = [];
  const breed = String(a.breed ?? "").trim();
  const stream = String(a.stream ?? "").trim();
  if (breed) chips.push({ key: "breed", label: breed });
  if (stream) chips.push({ key: "stream", label: stream });
  return { sex, chips };
}
