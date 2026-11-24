import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { AdminError } from "@/lib/admin-error";
import type { ArtworkImage } from "@/lib/artwork";
import { getStorageMode } from "@/lib/catalog-store";

const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");
const LOCAL_KEY = /^[a-z0-9-]+\/[0-9a-f-]+\.jpg$/;

function localFile(key: string) {
  if (!LOCAL_KEY.test(key)) {
    throw new AdminError("That photo could not be removed.");
  }

  const target = path.resolve(UPLOADS_ROOT, key);

  if (!target.startsWith(`${UPLOADS_ROOT}${path.sep}`)) {
    throw new AdminError("That photo could not be removed.");
  }

  return target;
}

export async function storeWebImage(slug: string, bytes: Buffer): Promise<ArtworkImage> {
  const mode = getStorageMode();
  const id = randomUUID();

  if (mode === "local") {
    const key = `${slug}/${id}.jpg`;
    const file = localFile(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return {
      src: `/uploads/${key}`,
      alt: "",
      source: "local",
      key,
    };
  }

  if (mode === "cloud") {
    const blob = await put(`artwork/${slug}/${id}.jpg`, bytes, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
    });

    return {
      src: blob.url,
      alt: "",
      source: "blob",
      key: blob.pathname,
    };
  }

  throw new AdminError("Connect Vercel Blob and Postgres before uploading photos.");
}

export async function deleteStoredImage(image: ArtworkImage) {
  if (image.source === "local" && image.key) {
    await unlink(localFile(image.key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return;
  }

  if (image.source === "blob") {
    await del(image.key || image.src);
  }
}

export function assertBlobUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new AdminError("That upload could not be saved.");
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".public.blob.vercel-storage.com")
  ) {
    throw new AdminError("That upload could not be saved.");
  }

  return url;
}
