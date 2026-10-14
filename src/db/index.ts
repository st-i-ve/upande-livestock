import * as SQLite from "expo-sqlite";

/**
 * The phone's local store. Today it holds the animals (see animals.ts); the
 * schema is versioned so a later release can add a table or a column without
 * asking anyone to reinstall. `PRAGMA user_version` is the version on disk and
 * `MIGRATIONS[n]` takes a database at version n to n + 1.
 */
const DB_NAME = "livestock.db";

const MIGRATIONS: string[][] = [
  // 0 -> 1
  [
    `CREATE TABLE animals (
       name TEXT PRIMARY KEY NOT NULL,
       tag TEXT,
       animal_name TEXT,
       sex TEXT,
       breed TEXT,
       dob TEXT,
       herd TEXT,
       status TEXT,
       repro_status TEXT,
       image TEXT,
       dam TEXT,
       sire TEXT,
       parity INTEGER,
       last_weight_kg REAL,
       modified TEXT
     )`,
    // Search is by tag, name and herd; NOCASE so "kt-0" finds "KT-001".
    `CREATE INDEX idx_animals_tag ON animals (tag COLLATE NOCASE)`,
    `CREATE INDEX idx_animals_animal_name ON animals (animal_name COLLATE NOCASE)`,
    `CREATE INDEX idx_animals_herd ON animals (herd COLLATE NOCASE)`,
    `CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT)`,
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  while (version < SCHEMA_VERSION) {
    const steps = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      for (const sql of steps) await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  return db;
}

/** The open database, migrated to the current schema. Opened once. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = open().catch((e) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", key);
  return r?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, value);
}

/** Forget everything — used on logout so the next user never sees this herd. */
export async function clearDb(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM animals; DELETE FROM meta;");
  });
}
