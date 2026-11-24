import {
  normalizeAvailability,
  type Artwork,
  type ArtworkImage,
  type ArtworkStatus,
  type Catalog,
  type PrintOption,
} from "@/lib/artwork";
import { isPrintType } from "@/lib/print-type";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set<ArtworkStatus>(["in-progress", "completed"]);
const PRINT_ID = /^[a-zA-Z0-9_-]{1,80}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeSrc(src: string) {
  if (src.startsWith("/artwork/") || src.startsWith("/uploads/")) {
    return !src.includes("..") && !src.includes("\\") && !src.includes("//");
  }

  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

function parseImage(value: unknown): ArtworkImage {
  if (!isRecord(value) || typeof value.src !== "string" || typeof value.alt !== "string") {
    throw new Error("Artwork catalog has an invalid photo.");
  }

  if (!isSafeSrc(value.src) || value.alt.length > 300) {
    throw new Error("Artwork catalog has an invalid photo.");
  }

  const image: ArtworkImage = { src: value.src, alt: value.alt };
  if (value.source === "seed" || value.source === "local" || value.source === "blob") {
    image.source = value.source;
  }
  if (typeof value.key === "string" && value.key.length < 300 && !value.key.includes("..")) {
    image.key = value.key;
  }
  return image;
}

function parseAvailability(value: unknown) {
  const list = Array.isArray(value) ? value : [value];
  const offerings = list.filter((item): item is string => typeof item === "string");

  if (offerings.length !== list.length) return null;
  return normalizeAvailability(offerings);
}

function parsePrint(value: unknown, index: number): PrintOption {
  if (
    !isRecord(value) ||
    typeof value.size !== "string" ||
    value.size.length === 0 ||
    value.size.length > 80 ||
    typeof value.price !== "number" ||
    !Number.isFinite(value.price) ||
    value.price < 0
  ) {
    throw new Error("Artwork catalog has an invalid print option.");
  }

  const id =
    typeof value.id === "string" && PRINT_ID.test(value.id) ? value.id : `size-${index + 1}`;
  const paper =
    typeof value.paper === "string" ? value.paper.trim().replace(/\s+/g, " ") : "";

  return {
    id,
    type: isPrintType(value.type) ? value.type : "art-print",
    size: value.size,
    price: value.price,
    available: value.available !== false,
    ...(paper && paper.length <= 200 ? { paper } : {}),
  };
}

function parsePrints(values: unknown[]): PrintOption[] {
  const used = new Set<string>();

  return values.map((value, index) => {
    const print = parsePrint(value, index);
    let id = print.id;
    let suffix = 2;

    while (used.has(id)) {
      id = `${print.id}-${suffix}`.slice(0, 80);
      suffix += 1;
    }

    used.add(id);
    return { ...print, id };
  });
}

function parseArtwork(value: unknown): Artwork {
  if (!isRecord(value)) throw new Error("Artwork catalog has an invalid painting.");

  const status = value.status;
  const availability = parseAvailability(value.availability);

  if (
    typeof value.slug !== "string" ||
    !SLUG.test(value.slug) ||
    typeof value.title !== "string" ||
    typeof value.widthInches !== "number" ||
    typeof value.heightInches !== "number" ||
    !STATUSES.has(status as ArtworkStatus) ||
    !availability ||
    !Array.isArray(value.images)
  ) {
    throw new Error("Artwork catalog has an invalid painting.");
  }

  const artwork: Artwork = {
    slug: value.slug,
    title: value.title,
    widthInches: value.widthInches,
    heightInches: value.heightInches,
    status: status as ArtworkStatus,
    availability,
    images: value.images.map(parseImage),
  };

  if (typeof value.estimatedCompletion === "string" && value.estimatedCompletion) {
    artwork.estimatedCompletion = value.estimatedCompletion;
  }
  if (typeof value.estimatedPrintShipping === "string" && value.estimatedPrintShipping) {
    artwork.estimatedPrintShipping = value.estimatedPrintShipping;
  }
  if (Array.isArray(value.prints)) {
    artwork.prints = parsePrints(value.prints);
  }

  return artwork;
}

export function parseCatalog(input: unknown): Catalog {
  if (!isRecord(input) || typeof input.featuredSlug !== "string" || !Array.isArray(input.artworks)) {
    throw new Error("Artwork catalog is invalid.");
  }

  const artworks = input.artworks.map(parseArtwork);
  const slugs = new Set<string>();

  for (const artwork of artworks) {
    if (slugs.has(artwork.slug)) {
      throw new Error(`Duplicate artwork slug "${artwork.slug}".`);
    }
    slugs.add(artwork.slug);
  }

  if (artworks.length === 0) {
    if (input.featuredSlug !== "") throw new Error("Artwork catalog is invalid.");
  } else if (!slugs.has(input.featuredSlug)) {
    throw new Error("The featured painting is missing from the catalog.");
  }

  return { featuredSlug: input.featuredSlug, artworks };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === "object" && value !== null) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stable((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

export function sameCatalog(left: Catalog, right: Catalog) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}
