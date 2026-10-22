import { router, useLocalSearchParams, useSegments } from "expo-router";
import { useEffect } from "react";

import { useLocalAnimal } from "@/src/hooks/useLocalAnimal";
import type { Animal } from "@/types";

/**
 * A record screen can be opened two ways: from the Record tab's menu, or from
 * an animal's (or herd's) quick actions. The second runs inside the Animals
 * stack (`animals/act/*`, re-exports of the same screens) so it never lands in
 * the Record tab's stack, and it carries the animal it was opened for.
 */
export function useFromAnimals(): boolean {
  return (useSegments() as string[]).includes("animals");
}

/** The animal a quick action was opened for (`?animal=<id>`), when there is one. */
export function usePresetAnimal(): Animal | null {
  const { animal } = useLocalSearchParams<{ animal?: string }>();
  const id = animal ? decodeURIComponent(String(animal)) : undefined;
  const { data } = useLocalAnimal(id);
  return (id && (data as Animal | null | undefined)) || null;
}

/** Seed a screen's selection with the preset animal, once, if nothing is chosen. */
export function useSeedAnimal(preset: Animal | null, current: unknown, seed: (a: Animal) => void) {
  useEffect(() => {
    const empty = Array.isArray(current) ? current.length === 0 : !current;
    if (preset && empty) seed(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.id]);
}

/** "Vaccinate · A011/26 DIEGO" when the screen was opened for an animal. */
export const titleFor = (title: string, preset: Animal | null): string =>
  preset ? `${title} · ${preset.id} ${preset.name}`.trim() : title;

/**
 * Where to go after a save. From a quick action: back to the animal (whose data
 * the mutation has already invalidated). From the Record menu: the success page.
 */
export function useFinishRecording() {
  const fromAnimals = useFromAnimals();
  const { animal } = useLocalSearchParams<{ animal?: string }>();
  return (name: string) => {
    if (!fromAnimals) {
      router.replace(`/(tabs)/record/success?name=${encodeURIComponent(name)}`);
      return;
    }
    if (animal) router.dismissTo(`/(tabs)/animals/${encodeURIComponent(String(animal))}`);
    else router.back();
  };
}
