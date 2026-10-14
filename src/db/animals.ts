import type { Animal } from "@/types";

import { getDb } from "./index";

/** One row of `animals_since`, as the server sends it. */
export type ServerAnimal = {
  name: string;
  tag: string | null;
  animal_name: string | null;
  sex: string | null;
  breed: string | null;
  dob: string | null;
  herd: string | null;
  status: string | null;
  repro_status: string | null;
  image: string | null;
  dam: string | null;
  sire: string | null;
  parity: number | null;
  last_weight_kg: number | null;
  modified: string | null;
};

type Row = Omit<ServerAnimal, "dob"> & { dob: string | null };

const COLS = [
  "name", "tag", "animal_name", "sex", "breed", "dob", "herd", "status",
  "repro_status", "image", "dam", "sire", "parity", "last_weight_kg", "modified",
] as const;

/**
 * Apply one sync to the table in a single transaction. `replace` empties it
 * first (a full sync), so a login as another user or on another site never keeps
 * the previous herd.
 */
export async function applySync(
  animals: ServerAnimal[],
  removed: string[],
  replace: boolean,
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    if (replace) await db.runAsync("DELETE FROM animals");
    const upsert = await db.prepareAsync(
      `INSERT OR REPLACE INTO animals (${COLS.join(",")}) VALUES (${COLS.map(() => "?").join(",")})`,
    );
    try {
      for (const a of animals) {
        await upsert.executeAsync(COLS.map((c) => a[c] ?? null));
      }
    } finally {
      await upsert.finalizeAsync();
    }
    for (const n of removed) await db.runAsync("DELETE FROM animals WHERE name = ?", n);
  });
}

const sexFrom = (raw: string | null): "F" | "M" =>
  String(raw ?? "").toLowerCase().startsWith("m") ? "M" : "F";

const toAnimal = (r: Row): Animal => ({
  id: r.name,
  name: r.animal_name || r.name,
  sex: sexFrom(r.sex),
  dob: r.dob ?? "",
  herd: r.herd ?? "",
  repro: r.repro_status ?? "",
  dim: null,
  parity: r.parity ?? 0,
  lastWt: r.last_weight_kg ?? 0,
  milkSafe: null,
  inTreatment: 0,
  pregnant: String(r.repro_status ?? "").toLowerCase().includes("pregnant") ? 1 : 0,
  tag: r.tag,
  breed: r.breed,
  image: r.image,
  dam: r.dam,
  sire: r.sire,
  status: r.status,
});

/** Active animals, optionally narrowed by a search on tag, name or herd. */
export async function queryAnimals(search?: string): Promise<Animal[]> {
  const db = await getDb();
  const q = (search ?? "").trim();
  if (!q) {
    return (await db.getAllAsync<Row>("SELECT * FROM animals ORDER BY name")).map(toAnimal);
  }
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM animals
      WHERE name LIKE ?1 ESCAPE '\\' OR tag LIKE ?1 ESCAPE '\\'
         OR animal_name LIKE ?1 ESCAPE '\\' OR herd LIKE ?1 ESCAPE '\\'
      ORDER BY name`,
    like,
  );
  return rows.map(toAnimal);
}

export async function getLocalAnimal(id: string): Promise<Animal | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<Row>("SELECT * FROM animals WHERE name = ?", id);
  return r ? toAnimal(r) : null;
}

export async function countAnimals(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM animals");
  return r?.n ?? 0;
}
