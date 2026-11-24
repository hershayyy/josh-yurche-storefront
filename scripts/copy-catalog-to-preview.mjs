import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import { seedCatalog } from "../src/lib/artwork.ts";
import { parseCatalog, sameCatalog } from "../src/lib/catalog-document.ts";
import { planCatalogImport } from "../src/lib/catalog-import-plan.ts";

const root = process.cwd();
const catalogPath = path.join(root, ".data", "catalog.json");
const envPath = path.join(root, ".env.preview.local");

loadEnvFile(envPath);

if (process.env.COPY_TARGET !== "preview") {
  fail("Set COPY_TARGET=preview. This copy does not read or write orders.");
}

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
if (stripeKey.startsWith("sk_live_") || stripeKey.startsWith("rk_live_")) {
  fail("Refusing to copy while STRIPE_SECRET_KEY is a live key.");
}

const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
const blobToken = process.env.BLOB_READ_WRITE_TOKEN || "";

if (!databaseUrl || !blobToken) {
  fail("Preview Postgres and Blob are not configured. Pull the Preview environment into .env.preview.local.");
}

if (!existsSync(catalogPath)) {
  fail("Local catalog .data/catalog.json was not found.");
}

const local = parseCatalog(JSON.parse(readFileSync(catalogPath, "utf8")));
const sql = neon(databaseUrl);

await sql.query(
  `CREATE TABLE IF NOT EXISTS artwork_catalog (
    id integer PRIMARY KEY,
    version integer NOT NULL,
    document jsonb NOT NULL
  )`,
);
await sql.query(
  `CREATE TABLE IF NOT EXISTS catalog_import (
    id integer PRIMARY KEY,
    catalog_version integer NOT NULL
  )`,
);

const catalogRows = await sql.query(
  "SELECT version, document FROM artwork_catalog WHERE id = 1",
);
const importRows = await sql.query(
  "SELECT catalog_version FROM catalog_import WHERE id = 1",
);
const current = catalogRows[0];
const version = typeof current?.version === "number" ? current.version : null;
let matchesSeed = false;

if (current) {
  const document = typeof current.document === "string" ? JSON.parse(current.document) : current.document;
  matchesSeed = sameCatalog(parseCatalog(document), seedCatalog());
}

const plan = planCatalogImport({
  hasCatalog: Boolean(current),
  catalogVersion: version,
  matchesSeed,
  importVersion: typeof importRows[0]?.catalog_version === "number" ? importRows[0].catalog_version : null,
});

if (plan.action === "skip") {
  console.log(plan.reason);
  console.log("Local test orders were not copied.");
  process.exit(0);
}

const prepared = await withBlobPhotos(local, blobToken);
parseCatalog(prepared);
const document = JSON.stringify(prepared);

let savedVersion;

if (plan.action === "insert") {
  await sql.query(
    "INSERT INTO artwork_catalog (id, version, document) VALUES (1, 1, $1::jsonb)",
    [document],
  );
  savedVersion = 1;
} else {
  const updated = await sql.query(
    `UPDATE artwork_catalog
     SET document = $1::jsonb, version = version + 1
     WHERE id = 1 AND version = $2
     RETURNING version`,
    [document, version],
  );
  savedVersion = updated[0]?.version;
  if (typeof savedVersion !== "number") {
    fail("Preview catalog changed while copying. Leaving it in place.");
  }
}

await sql.query(
  `INSERT INTO catalog_import (id, catalog_version)
   VALUES (1, $1)
   ON CONFLICT (id) DO UPDATE SET catalog_version = EXCLUDED.catalog_version`,
  [savedVersion],
);

const prints = prepared.artworks.reduce((sum, artwork) => sum + (artwork.prints?.length ?? 0), 0);
console.log(
  `Copied ${prepared.artworks.length} artworks and ${prints} print options. Featured artwork: ${prepared.featuredSlug}.`,
);
console.log("Local test orders were not copied.");

async function withBlobPhotos(catalog, token) {
  const artworks = [];

  for (const artwork of catalog.artworks) {
    const images = [];

    for (const image of artwork.images) {
      if (!image.src.startsWith("/uploads/")) {
        images.push(image);
        continue;
      }

      const relative = image.src.slice("/uploads/".length);
      if (relative.includes("..") || path.isAbsolute(relative)) {
        fail("A local upload path is not safe to copy.");
      }

      const file = path.join(root, "public", "uploads", relative);
      if (!existsSync(file)) fail("A local upload is missing from public/uploads.");

      const pathname = `artwork/imported/${relative.replaceAll("\\", "/")}`;
      const blob = await put(pathname, readFileSync(file), {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });

      images.push({
        ...image,
        src: blob.url,
        source: "blob",
        key: blob.pathname,
      });
    }

    artworks.push({ ...artwork, images });
  }

  return { ...catalog, artworks };
}

function loadEnvFile(file) {
  if (!existsSync(file)) return;

  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
