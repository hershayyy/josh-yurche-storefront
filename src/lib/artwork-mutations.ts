import "server-only";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminError } from "@/lib/admin-error";
import {
  normalizeAvailability,
  type Artwork,
  type ArtworkImage,
  type ArtworkStatus,
} from "@/lib/artwork";
import { readCatalog, updateCatalog } from "@/lib/catalog-store";
import { isPrintType } from "@/lib/print-type";
import { assertBlobUrl, deleteStoredImage, storeWebImage } from "@/lib/image-store";
import { createWebImage } from "@/lib/images";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PHOTOS = 24;
const MAX_BYTES = 30 * 1024 * 1024;
const MAX_BATCH = 8;

const STATUSES = new Set<ArtworkStatus>(["in-progress", "completed"]);

export function isSlug(value: string) {
  return SLUG.test(value) && value.length <= 80;
}

function slugify(title: string) {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "artwork";
}

function uniqueSlug(title: string, slugs: string[]) {
  const base = slugify(title);

  if (!slugs.includes(base)) return base;

  let suffix = 2;
  while (slugs.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim().replace(/\s+/g, " ");
}

function readInches(formData: FormData, name: string, label: string) {
  const value = Number(readText(formData, name));

  if (!Number.isFinite(value) || value <= 0 || value > 200) {
    throw new AdminError(`Enter the ${label} in inches.`);
  }

  return Math.round(value * 100) / 100;
}

function readChoice<T extends string>(value: string, allowed: Set<T>, message: string): T {
  if (!allowed.has(value as T)) throw new AdminError(message);
  return value as T;
}

function readWindow(formData: FormData, name: string, label: string) {
  const value = readText(formData, name);

  if (value.length > 80) {
    throw new AdminError(`Keep the ${label} under 80 characters.`);
  }

  return value;
}

function applyDetails(artwork: Artwork, formData: FormData) {
  const title = readText(formData, "title");

  if (!title || title.length > 80) {
    throw new AdminError("Enter a title under 80 characters.");
  }

  artwork.title = title;
  artwork.widthInches = readInches(formData, "widthInches", "width");
  artwork.heightInches = readInches(formData, "heightInches", "height");
  artwork.status = readChoice(
    readText(formData, "status"),
    STATUSES,
    "Choose whether the painting is in progress or completed.",
  );
  const availability = normalizeAvailability(
    formData.getAll("availability").map((value) => String(value)),
  );

  if (!availability) {
    throw new AdminError(
      "Choose one offering, or pair Original available or Original sold with Open for pre-order or Prints available.",
    );
  }

  artwork.availability = availability;

  const completion = readWindow(
    formData,
    "estimatedCompletion",
    "painting completion",
  );
  const shipping = readWindow(
    formData,
    "estimatedPrintShipping",
    "print shipping window",
  );

  if (completion) artwork.estimatedCompletion = completion;
  else delete artwork.estimatedCompletion;

  if (shipping) artwork.estimatedPrintShipping = shipping;
  else delete artwork.estimatedPrintShipping;
}

function findArtwork(artworks: Artwork[], slug: string) {
  const artwork = artworks.find((item) => item.slug === slug);

  if (!artwork) throw new AdminError("That painting is no longer in the catalog.");
  return artwork;
}

export async function createArtworkRecord(formData: FormData) {
  await requireAdmin();
  let slug = "";

  await updateCatalog((catalog) => {
    const artwork: Artwork = {
      slug: "artwork",
      title: "",
      widthInches: 1,
      heightInches: 1,
      status: "in-progress",
      availability: ["gallery-only"],
      images: [],
    };
    applyDetails(artwork, formData);
    artwork.slug = uniqueSlug(
      artwork.title,
      catalog.artworks.map((item) => item.slug),
    );
    slug = artwork.slug;
    catalog.artworks.push(artwork);

    if (!catalog.artworks.some((item) => item.slug === catalog.featuredSlug)) {
      catalog.featuredSlug = artwork.slug;
    }
  });

  return slug;
}

export async function saveArtworkRecord(slug: string, formData: FormData) {
  await requireAdmin();
  if (!isSlug(slug)) throw new AdminError("That painting could not be saved.");

  await updateCatalog((catalog) => {
    const artwork = findArtwork(catalog.artworks, slug);
    applyDetails(artwork, formData);
    const feature = formData.get("featured") === "on";

    if (feature) {
      catalog.featuredSlug = artwork.slug;
      return;
    }

    if (catalog.featuredSlug === artwork.slug) {
      catalog.featuredSlug =
        catalog.artworks.find((item) => item.slug !== artwork.slug)?.slug ??
        artwork.slug;
    }
  });
}

export async function featureArtworkRecord(slug: string) {
  await requireAdmin();
  if (!isSlug(slug)) throw new AdminError("Choose a painting to feature.");

  await updateCatalog((catalog) => {
    findArtwork(catalog.artworks, slug);
    catalog.featuredSlug = slug;
  });
}

export async function deleteArtworkRecord(slug: string) {
  await requireAdmin();
  if (!isSlug(slug)) throw new AdminError("That painting could not be removed.");

  const catalog = await readCatalog();
  const artwork = findArtwork(catalog.artworks, slug);

  await updateCatalog((current) => {
    current.artworks = current.artworks.filter((item) => item.slug !== slug);

    if (current.featuredSlug === slug) {
      current.featuredSlug = current.artworks[0]?.slug ?? "";
    }
  });

  await Promise.all(artwork.images.map((image) => deleteStoredImage(image)));
}

function photoHint(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  ) {
    return "heic";
  }

  return undefined;
}

async function filesFromForm(formData: FormData) {
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) throw new AdminError("Choose at least one photo.");
  if (files.length > MAX_BATCH) {
    throw new AdminError("Upload 8 photos or fewer at a time.");
  }

  return files;
}

export async function addArtworkFiles(slug: string, formData: FormData) {
  await requireAdmin();
  if (!isSlug(slug)) throw new AdminError("Choose a painting before uploading.");

  const files = await filesFromForm(formData);
  const catalog = await readCatalog();
  const artwork = findArtwork(catalog.artworks, slug);

  if (artwork.images.length + files.length > MAX_PHOTOS) {
    throw new AdminError("This painting already has the maximum number of photos.");
  }

  const stored: ArtworkImage[] = [];

  try {
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        throw new AdminError("Each photo needs to be under 30 MB.");
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const web = await createWebImage(bytes, photoHint(file));
      const image = await storeWebImage(slug, web.buffer);
      const number = artwork.images.length + stored.length + 1;
      image.alt =
        number === 1 ? artwork.title : `${artwork.title}, photo ${number}`;
      stored.push(image);
    }
  } catch (error) {
    await Promise.all(stored.map((image) => deleteStoredImage(image)));
    throw error;
  }

  try {
    await updateCatalog((current) => {
      const currentArtwork = findArtwork(current.artworks, slug);

      if (currentArtwork.images.length + stored.length > MAX_PHOTOS) {
        throw new AdminError("This painting already has the maximum number of photos.");
      }

      currentArtwork.images.push(...stored);
    });
  } catch (error) {
    await Promise.all(stored.map((image) => deleteStoredImage(image)));
    throw error;
  }
}

export async function addBlobOriginal(slug: string, url: string) {
  await requireAdmin();
  if (!isSlug(slug)) throw new AdminError("Choose a painting before uploading.");
  const sourceUrl = assertBlobUrl(url);

  const response = await fetch(sourceUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new AdminError("Could not read that photo.");

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new AdminError("Each photo needs to be under 30 MB.");
  }

  const web = await createWebImage(bytes);
  const image = await storeWebImage(slug, web.buffer);

  try {
    await updateCatalog((catalog) => {
      const artwork = findArtwork(catalog.artworks, slug);

      if (artwork.images.length >= MAX_PHOTOS) {
        throw new AdminError("This painting already has the maximum number of photos.");
      }

      const number = artwork.images.length + 1;
      image.alt = number === 1 ? artwork.title : `${artwork.title}, photo ${number}`;
      artwork.images.push(image);
    });
  } catch (error) {
    await deleteStoredImage(image);
    throw error;
  } finally {
    const { del } = await import("@vercel/blob");
    await del(sourceUrl.toString()).catch(() => undefined);
  }
}

function readIndex(value: FormDataEntryValue | null, length: number) {
  const index = Number(value);

  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new AdminError("That photo is no longer in this list.");
  }

  return index;
}

export async function moveArtworkPhoto(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  if (!isSlug(slug)) throw new AdminError("That photo could not be moved.");
  const direction = formData.get("direction") === "down" ? 1 : -1;

  await updateCatalog((catalog) => {
    const artwork = findArtwork(catalog.artworks, slug);
    const index = readIndex(formData.get("index"), artwork.images.length);
    const next = index + direction;

    if (next < 0 || next >= artwork.images.length) return;

    const [image] = artwork.images.splice(index, 1);
    artwork.images.splice(next, 0, image);
  });

  return slug;
}

export async function makeArtworkLead(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  if (!isSlug(slug)) throw new AdminError("That photo could not be made the lead.");

  await updateCatalog((catalog) => {
    const artwork = findArtwork(catalog.artworks, slug);
    const index = readIndex(formData.get("index"), artwork.images.length);

    if (index === 0) return;

    const [image] = artwork.images.splice(index, 1);
    artwork.images.unshift(image);
  });

  return slug;
}

export async function removeArtworkPhoto(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  if (!isSlug(slug)) throw new AdminError("That photo could not be removed.");

  let removed = catalogImage(await readCatalog(), slug, formData);

  await updateCatalog((catalog) => {
    const artwork = findArtwork(catalog.artworks, slug);
    const index = readIndex(formData.get("index"), artwork.images.length);
    removed = artwork.images[index];
    artwork.images.splice(index, 1);
  });

  if (removed) await deleteStoredImage(removed);
  return slug;
}

const PRINT_ID = /^[a-zA-Z0-9_-]{1,80}$/;

function readDollars(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new AdminError("Enter a price in dollars, such as 48 or 48.50.");
  }

  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (cents <= 0 || cents > 1_000_000) {
    throw new AdminError("Enter a price between $0.01 and $10,000.");
  }

  return cents / 100;
}

function readPrintFields(formData: FormData, prints: Artwork["prints"], currentId?: string) {
  const size = readText(formData, "size");
  const printType = readText(formData, "printType");
  const paper = readText(formData, "paper");

  if (!isPrintType(printType)) {
    throw new AdminError("Choose Art print or Poster.");
  }

  if (!size || size.length > 40) {
    throw new AdminError("Enter a print size under 40 characters.");
  }

  if (paper.length > 200) {
    throw new AdminError("Keep the paper or finish description under 200 characters.");
  }

  const duplicate = (prints ?? []).some(
    (print) =>
      print.id !== currentId &&
      print.type === printType &&
      print.size.toLowerCase() === size.toLowerCase(),
  );

  if (duplicate) throw new AdminError("That size is already listed for this print type.");

  return {
    type: printType,
    size,
    price: readDollars(readText(formData, "price")),
    available: formData.get("available") === "on",
    shipsRolled: formData.get("shipsRolled") === "on",
    ...(paper ? { paper } : {}),
  };
}

export async function addPrintRecord(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  if (!isSlug(slug)) throw new AdminError("Choose a painting before adding a print size.");

  await updateCatalog((catalog) => {
    const artwork = findArtwork(catalog.artworks, slug);
    const prints = artwork.prints ?? [];

    if (prints.length >= 12) {
      throw new AdminError("A painting can have up to 12 print sizes.");
    }

    artwork.prints = [...prints, { id: randomUUID(), ...readPrintFields(formData, prints) }];
  });
}

export async function updatePrintRecord(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const printId = String(formData.get("printId") ?? "");

  if (!isSlug(slug) || !PRINT_ID.test(printId)) {
    throw new AdminError("That print size could not be saved.");
  }

  await updateCatalog((catalog) => {
    const artwork = findArtwork(catalog.artworks, slug);
    const prints = artwork.prints ?? [];
    const index = prints.findIndex((print) => print.id === printId);

    if (index < 0) throw new AdminError("That print size is no longer listed.");

    const next = readPrintFields(formData, prints, printId);
    prints[index] = { id: prints[index].id, ...next };
    artwork.prints = prints;
  });
}

export async function removePrintRecord(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const printId = String(formData.get("printId") ?? "");

  if (!isSlug(slug) || !PRINT_ID.test(printId)) {
    throw new AdminError("That print size could not be removed.");
  }

  await updateCatalog((catalog) => {
    const artwork = findArtwork(catalog.artworks, slug);
    const prints = artwork.prints ?? [];

    if (!prints.some((print) => print.id === printId)) {
      throw new AdminError("That print size is no longer listed.");
    }

    artwork.prints = prints.filter((print) => print.id !== printId);
  });
}

function catalogImage(
  catalog: Awaited<ReturnType<typeof readCatalog>>,
  slug: string,
  formData: FormData,
) {
  const artwork = findArtwork(catalog.artworks, slug);
  const index = readIndex(formData.get("index"), artwork.images.length);
  return artwork.images[index];
}
