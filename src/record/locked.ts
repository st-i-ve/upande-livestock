/**
 * A record screen opened from an animal's quick actions (`animals/act/*` with
 * `?animal=<id>`) records for THAT animal only: the picker becomes a fixed card.
 * `locked=1` locks anywhere an `animal` is given; `locked=0` unlocks it.
 * Opened from the Record tab (no animal) the picker is free as ever.
 */
export function lockedAnimalId(
  params: { animal?: string | string[]; locked?: string | string[] },
  segments: readonly string[],
): string | null {
  const raw = Array.isArray(params.animal) ? params.animal[0] : params.animal;
  if (!raw) return null;
  const flag = Array.isArray(params.locked) ? params.locked[0] : params.locked;
  if (flag === "0") return null;
  const fromAnimal = segments.includes("animals") && segments.includes("act");
  if (flag !== "1" && !fromAnimal) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
