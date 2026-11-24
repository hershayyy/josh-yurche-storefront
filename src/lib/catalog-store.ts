import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { AdminError } from "@/lib/admin-error";
import { seedCatalog, type Catalog } from "@/lib/artwork";
import { parseCatalog } from "@/lib/catalog-document";

const LOCAL_PATH = path.join(process.cwd(), ".data", "catalog.json");

export type StorageMode = "local" | "cloud" | "unconfigured" | "misconfigured";

type Storage =
  | { mode: "local" }
  | { mode: "cloud"; databaseUrl: string }
  | { mode: "unconfigured" };

function databaseUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
}

function resolveStorage(): Storage {
  const url = databaseUrl();
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (url && hasBlob) return { mode: "cloud", databaseUrl: url };
  if (!url && !hasBlob) {
    return process.env.VERCEL ? { mode: "unconfigured" } : { mode: "local" };
  }

  throw new Error(
    "Artwork storage needs both POSTGRES_URL (or DATABASE_URL) and BLOB_READ_WRITE_TOKEN.",
  );
}

export function storageTarget(): Storage {
  return resolveStorage();
}

export function getStorageMode(): StorageMode {
  try {
    return resolveStorage().mode;
  } catch {
    return "misconfigured";
  }
}

async function readLocal(): Promise<Catalog> {
  try {
    const raw = await readFile(LOCAL_PATH, "utf8");
    return parseCatalog(JSON.parse(raw) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const catalog = seedCatalog();
    await writeLocal(catalog);
    return catalog;
  }
}

async function writeLocal(catalog: Catalog) {
  parseCatalog(catalog);
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  const temporary = `${LOCAL_PATH}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`);
  await rename(temporary, LOCAL_PATH);
}

function sqlClient(url: string) {
  return neon(url);
}

async function ensureDatabase(url: string) {
  const sql = sqlClient(url);
  await sql.query(
    `CREATE TABLE IF NOT EXISTS artwork_catalog (
      id integer PRIMARY KEY,
      version integer NOT NULL,
      document jsonb NOT NULL
    )`,
  );

  const inserted = seedCatalog();
  await sql.query(
    `INSERT INTO artwork_catalog (id, version, document)
     VALUES (1, 1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(inserted)],
  );
}

async function readDatabase(url: string): Promise<Catalog> {
  await ensureDatabase(url);
  const sql = sqlClient(url);
  const rows = await sql.query(
    "SELECT document FROM artwork_catalog WHERE id = 1",
  );
  const document = rows[0]?.document;
  return parseCatalog(
    typeof document === "string" ? (JSON.parse(document) as unknown) : document,
  );
}

async function updateDatabase(
  url: string,
  mutate: (catalog: Catalog) => void,
): Promise<Catalog> {
  await ensureDatabase(url);
  const sql = sqlClient(url);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rows = await sql.query(
      "SELECT version, document FROM artwork_catalog WHERE id = 1",
    );
    const version = rows[0]?.version;
    const document = rows[0]?.document;

    if (typeof version !== "number") {
      throw new Error("Artwork catalog is missing from Postgres.");
    }

    const catalog = parseCatalog(
      typeof document === "string" ? (JSON.parse(document) as unknown) : document,
    );
    mutate(catalog);
    parseCatalog(catalog);

    const updated = await sql.query(
      `UPDATE artwork_catalog
       SET document = $1::jsonb, version = version + 1
       WHERE id = 1 AND version = $2
       RETURNING version`,
      [JSON.stringify(catalog), version],
    );

    if (updated.length > 0) return catalog;
  }

  throw new AdminError("The catalog changed while saving. Try again.");
}

let writeQueue: Promise<void> = Promise.resolve();

export async function readCatalog(): Promise<Catalog> {
  const storage = resolveStorage();

  if (storage.mode === "cloud") return readDatabase(storage.databaseUrl);
  if (storage.mode === "local") return readLocal();
  return seedCatalog();
}

export async function updateCatalog(mutate: (catalog: Catalog) => void): Promise<Catalog> {
  const run = async () => {
    const storage = resolveStorage();

    if (storage.mode === "unconfigured") {
      throw new AdminError(
        "Connect Vercel Blob and Postgres before editing artwork.",
      );
    }

    if (storage.mode === "local") {
      const catalog = await readLocal();
      mutate(catalog);
      parseCatalog(catalog);
      await writeLocal(catalog);
      return catalog;
    }

    return updateDatabase(storage.databaseUrl, mutate);
  };

  const result = writeQueue.then(run, run);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
