import { breedingCards, breedingFirst } from "@/src/beef/breeding";
import { factsFrom } from "@/src/hooks/useHerds";
import { mapBeefSettings, mapHerd } from "@/src/frappe/herd";
import type { Animal, Herd } from "@/types";

const a = (id: string, sex: "M" | "F", herd: string, dob = "2018-01-01", name = id) => ({ id, name, sex, herd, dob }) as Animal;
const NOW = Date.parse("2026-10-29");

describe("herd rows from the bootstrap bundle", () => {
  it("maps class, breeding flag and counts", () => {
    const h = mapHerd({ name: "Lactation Group 1", herd_class: "Breeding", is_breeding: 1, females: 50, bulls: 2, fed_heads: 52, heads: 55 });
    expect(h).toMatchObject({ n: "Lactation Group 1", herdClass: "Breeding", isBreeding: true, females: 50, bulls: 2, fedHeads: 52, cnt: 55 });
    expect(mapHerd({ name: "Starters" }).isBreeding).toBe(false);
  });
  it("beef settings default to Mutara's numbers", () => {
    expect(mapBeefSettings(undefined)).toEqual({
      calfSeparationAgeDays: 210, defaultServiceType: "Natural", breedingBullMinAgeMonths: 18, conceptionWindowDays: 10, kinshipCheck: true,
    });
    expect(mapBeefSettings({ calf_separation_age_days: 180, default_service_type: "A.I.", kinship_check: 0 })).toMatchObject({
      calfSeparationAgeDays: 180, defaultServiceType: "A.I.", kinshipCheck: false,
    });
  });
  it("a configured 0 is honoured, not replaced by the default", () => {
    expect(mapBeefSettings({ calf_separation_age_days: 0 }).calfSeparationAgeDays).toBe(0);
  });
  it("herd facts list the breeding herds", () => {
    const herds: Herd[] = [mapHerd({ name: "Bulling Heifers", is_breeding: 1 }), mapHerd({ name: "Starters" })];
    expect(factsFrom(herds).breeding).toEqual(["Bulling Heifers"]);
  });
});

describe("breeding cards", () => {
  const herds = [
    mapHerd({ name: "Lactation Group 2", is_breeding: 1 }),
    mapHerd({ name: "Bulling Heifers", is_breeding: 1, females: 50, bulls: 2 }),
    mapHerd({ name: "Starters" }),
  ];
  const animals = [
    a("A1", "F", "Lactation Group 2"),
    a("A2", "F", "Lactation Group 2"),
    a("B1", "M", "Lactation Group 2", "2020-03-01", "Kito"),
    a("B2", "M", "Lactation Group 2", "2026-06-01", "Calf bull"),
    a("B3", "M", "Starters"),
  ];
  const cards = breedingCards(herds, animals, 18, NOW);
  it("one card per breeding herd, sorted, none for the feedlot", () => {
    expect(cards.map((c) => c.herd)).toEqual(["Bulling Heifers", "Lactation Group 2"]);
  });
  it("uses the server's counts when sent, else counts the local animals (calf bulls are not bulls)", () => {
    expect(cards[0]).toMatchObject({ females: 50, bulls: 2 });
    expect(cards[1]).toMatchObject({ females: 2, bulls: 1, bullNames: ["Kito"] });
  });
  it("breeding-herd animals come first in the pickers", () => {
    const list = [a("X", "F", "Calves"), a("Y", "F", "Lactation Group 2"), a("Z", "F", "Calves")];
    expect(breedingFirst(list, new Set(["Lactation Group 2"])).map((x) => x.id)).toEqual(["Y", "X", "Z"]);
  });
});
