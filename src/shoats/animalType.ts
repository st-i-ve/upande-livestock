import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/**
 * Which animals this phone is working with: cattle (the individual-animal app) or a
 * shoat species (sheep or goats, managed by herd numbers). Chosen after login,
 * remembered on the device, switchable from Profile and from the Shoats header.
 */
export type AnimalType = "cattle" | "sheep" | "goats";

export const ANIMAL_TYPE_KEY = "animal.type";

/** The species name the server stores on a Herd. */
export const speciesOf = (t: AnimalType): "Sheep" | "Goat" | null =>
  t === "sheep" ? "Sheep" : t === "goats" ? "Goat" : null;

export const isShoats = (t: AnimalType | null): t is "sheep" | "goats" => t === "sheep" || t === "goats";

export const LABEL: Record<AnimalType, string> = { cattle: "Cattle", sheep: "Sheep", goats: "Goats" };

/** Where each animal type opens. */
export const homeOf = (t: AnimalType | null): "/choose" | "/(tabs)/animals" | "/(shoats)/herds" =>
  t === "cattle" ? "/(tabs)/animals" : isShoats(t) ? "/(shoats)/herds" : "/choose";

export const parseAnimalType = (v: string | null | undefined): AnimalType | null =>
  v === "cattle" || v === "sheep" || v === "goats" ? v : null;

type State = {
  type: AnimalType | null;
  hydrated: boolean;
  setType: (t: AnimalType) => void;
  hydrate: () => Promise<void>;
};

export const useAnimalType = create<State>((set) => ({
  type: null,
  hydrated: false,
  setType: (t) => {
    set({ type: t });
    AsyncStorage.setItem(ANIMAL_TYPE_KEY, t).catch(() => {});
  },
  hydrate: async () => {
    try {
      set({ type: parseAnimalType(await AsyncStorage.getItem(ANIMAL_TYPE_KEY)), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
