import type { PrintType } from "@/lib/print-type";

/**
 * Artwork types, display helpers, and the seed catalog.
 *
 * The live catalog is stored separately so the admin can edit it:
 * locally in `.data/catalog.json`, and on Vercel in Postgres.
 * The first time that store is empty, it imports `seedCatalog()` —
 * these paintings, photo URLs, and their order.
 */

export type ImageSource = "seed" | "local" | "blob";

export type ArtworkImage = {
  /** Public path or Vercel Blob URL. */
  src: string;
  alt: string;
  /** Where the file lives. Seeded files in `public/artwork` are not deleted. */
  source?: ImageSource;
  /** Local path under `public/uploads`, or a blob pathname, used when removing a photo. */
  key?: string;
};

export type PrintOption = {
  /** Stable id used by checkout. Editing the label does not change it. */
  id: string;
  /** Art print or poster. Existing options without a type are art prints. */
  type: PrintType;
  /** Confirmed size label, for example "11 × 14 in". */
  size: string;
  /** Confirmed price in US dollars. */
  price: number;
  /** Unavailable sizes stay in the admin and off the public page. */
  available: boolean;
  /** Optional stock note, added after the paper or finish is confirmed. */
  paper?: string;
};

export type ArtworkStatus = "in-progress" | "completed";

/**
 * gallery-only — shown in the gallery, with no print section.
 * prints — art prints or posters.
 * preorder — open for pre-order. Until `prints` has prices, the artwork
 * page also says print pre-orders are coming soon.
 * original-available / original-sold — the original painting. Either can
 * stand alone, or pair with prints or preorder. The original status is
 * stored and shown first.
 */
export type ArtworkAvailability =
  | "gallery-only"
  | "prints"
  | "preorder"
  | "original-available"
  | "original-sold";

export type Artwork = {
  slug: string;
  title: string;
  widthInches: number;
  heightInches: number;
  status: ArtworkStatus;
  /** One offering, or an original status followed by prints or preorder. */
  availability: ArtworkAvailability[];
  /** Display order. Index 0 is the lead image. */
  images: ArtworkImage[];
  estimatedCompletion?: string;
  estimatedPrintShipping?: string;
  prints?: PrintOption[];
};

export type Catalog = {
  featuredSlug: string;
  artworks: Artwork[];
};

const seed: Catalog = {
  featuredSlug: "donut-and-mongo",
  artworks: [
    {
      slug: "donut-and-mongo",
      title: "Donut and Mongo",
      widthInches: 30,
      heightInches: 40,
      status: "in-progress",
      availability: ["preorder"],
      estimatedPrintShipping: "Test window: about 4 weeks after checkout",
      prints: [
        { id: "donut-8x10", type: "art-print", size: "8 × 10 in", price: 35, available: true },
        { id: "donut-11x14", type: "art-print", size: "11 × 14 in", price: 48, available: true },
        { id: "donut-16x20", type: "art-print", size: "16 × 20 in", price: 72, available: false },
      ],
      images: [
        {
          src: "/artwork/donut-and-mongo/donut_and_mongo_1.jpg",
          alt: "Donut and Mongo progress photo, with the dinosaur head painted",
          source: "seed",
        },
        {
          src: "/artwork/donut-and-mongo/donut_and_mongo_2.jpg",
          alt: "Donut and Mongo progress photo, with the dinosaur head still sketched",
          source: "seed",
        },
      ],
    },
    {
      slug: "textured-tentacles",
      title: "Textured Tentacles",
      widthInches: 20,
      heightInches: 16,
      status: "completed",
      availability: ["gallery-only"],
      images: [
        {
          src: "/artwork/textured-tentacles/textured-tentacles.png",
          alt: "Textured Tentacles, an octopus painting",
          source: "seed",
        },
      ],
    },
  ],
};

const galleryPaintings: Artwork[] = [
  {
    slug: "crush-and-the-boys",
    title: "Crush and the Boys",
    widthInches: 36,
    heightInches: 12,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/crush-and-the-boys/crush-and-the-boys.png",
        alt: "Crush and the Boys",
        source: "seed",
      },
    ],
  },
  {
    slug: "water-tiger",
    title: "Water Tiger",
    widthInches: 36,
    heightInches: 16,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/water-tiger/water-tiger.png",
        alt: "Water Tiger",
        source: "seed",
      },
    ],
  },
  {
    slug: "bowie",
    title: "Bowie",
    widthInches: 30,
    heightInches: 40,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/bowie/bowie.png",
        alt: "Bowie",
        source: "seed",
      },
    ],
  },
  {
    slug: "the-octopuses-garden",
    title: "The Octopuses Garden",
    widthInches: 30,
    heightInches: 24,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/octo-garden/octo-garden.png",
        alt: "The Octopuses Garden",
        source: "seed",
      },
    ],
  },
  {
    slug: "slash",
    title: "Slash",
    widthInches: 36,
    heightInches: 36,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/slash/slash.png",
        alt: "Slash",
        source: "seed",
      },
    ],
  },
  {
    slug: "marilyn",
    title: "Marilyn",
    widthInches: 40,
    heightInches: 30,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/marilyn/marilyn.png",
        alt: "Marilyn",
        source: "seed",
      },
    ],
  },
  {
    slug: "angels-arrival",
    title: "Angels Arrival",
    widthInches: 16,
    heightInches: 20,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/angels-arrival/angels-arrival.png",
        alt: "Angels Arrival",
        source: "seed",
      },
    ],
  },
  {
    slug: "blue-peacock",
    title: "Blue Peacock",
    widthInches: 30,
    heightInches: 48,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/blue-peacock/blue-peacock.png",
        alt: "Blue Peacock",
        source: "seed",
      },
    ],
  },
  {
    slug: "flamingo",
    title: "Flamingo",
    widthInches: 16,
    heightInches: 30,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/flamingo/flamingo.png",
        alt: "Flamingo",
        source: "seed",
      },
    ],
  },
  {
    slug: "sarus",
    title: "Sarus",
    widthInches: 16,
    heightInches: 30,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/sarus/sarus.png",
        alt: "Sarus",
        source: "seed",
      },
    ],
  },
  {
    slug: "frolic",
    title: "Frolic",
    widthInches: 20,
    heightInches: 24,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/frolic/frolic.png",
        alt: "Frolic",
        source: "seed",
      },
    ],
  },
  {
    slug: "freddie",
    title: "Freddie",
    widthInches: 48,
    heightInches: 30,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/freddie/freddie.png",
        alt: "Freddie",
        source: "seed",
      },
    ],
  },
  {
    slug: "jimi",
    title: "Jimi",
    widthInches: 28.5,
    heightInches: 24,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/jimi/jimi.png",
        alt: "Jimi",
        source: "seed",
      },
    ],
  },
  {
    slug: "living-color",
    title: "Living Color",
    widthInches: 30,
    heightInches: 24,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/living-color/living-color.png",
        alt: "Living Color",
        source: "seed",
      },
    ],
  },
  {
    slug: "i-am-the-walrus",
    title: "I am the Walrus",
    widthInches: 24,
    heightInches: 30,
    status: "completed",
    availability: ["gallery-only"],
    images: [
      {
        src: "/artwork/walrus/walrus.png",
        alt: "I am the Walrus",
        source: "seed",
      },
    ],
  },
];

seed.artworks.push(...galleryPaintings);

export function seedCatalog(): Catalog {
  return structuredClone(seed);
}

const statusLabels: Record<ArtworkStatus, string> = {
  "in-progress": "In progress",
  completed: "Completed",
};

export function leadImage(artwork: Artwork): ArtworkImage | undefined {
  return artwork.images[0];
}

export function availablePrints(artwork: Artwork): PrintOption[] {
  return (artwork.prints ?? []).filter((print) => print.available && print.price > 0);
}

export function hasPrintOptions(artwork: Artwork): boolean {
  return availablePrints(artwork).length > 0;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export const availabilityLabel: Record<ArtworkAvailability, string> = {
  "gallery-only": "Gallery only",
  preorder: "Open for pre-order",
  prints: "Prints available",
  "original-available": "Original available",
  "original-sold": "Original sold",
};

const AVAILABILITY_VALUES = new Set<string>(Object.keys(availabilityLabel));

/**
 * Accept one offering, or exactly one of the pairs:
 * original available/sold with open for pre-order, or with prints.
 * Original status is always first.
 */
export function normalizeAvailability(
  values: readonly string[],
): ArtworkAvailability[] | null {
  const unique: string[] = [];

  for (const value of values) {
    if (!unique.includes(value)) unique.push(value);
  }

  if (
    unique.length === 0 ||
    unique.length > 2 ||
    unique.some((value) => !AVAILABILITY_VALUES.has(value))
  ) {
    return null;
  }

  const offerings = unique as ArtworkAvailability[];

  if (offerings.length === 1) return offerings;

  const original = offerings.find(
    (value) => value === "original-available" || value === "original-sold",
  );
  const prints = offerings.find(
    (value) => value === "preorder" || value === "prints",
  );

  if (!original || !prints) return null;
  return [original, prints];
}

/** Keep the selection inside the allowed offerings and pairs. */
export function toggleAvailability(
  current: readonly ArtworkAvailability[],
  value: ArtworkAvailability,
): ArtworkAvailability[] {
  if (current.includes(value)) {
    const remaining = current.filter((item) => item !== value);
    return remaining.length > 0 ? remaining : [...current];
  }

  if (value === "gallery-only") return ["gallery-only"];

  const withoutConflicts = current.filter((item) => {
    if (item === "gallery-only") return false;
    if (value === "preorder" && item === "prints") return false;
    if (value === "prints" && item === "preorder") return false;
    if (value === "original-available" && item === "original-sold") return false;
    if (value === "original-sold" && item === "original-available") return false;
    return true;
  });

  return normalizeAvailability([...withoutConflicts, value]) ?? [value];
}

export function showsPrintSection(artwork: Artwork): boolean {
  return artwork.availability.some(
    (offering) => offering === "prints" || offering === "preorder",
  );
}

/** Prints available ship now. Open for pre-order waits for the print window. */
export function printOfferKind(artwork: Artwork): "in-stock" | "preorder" | null {
  if (artwork.availability.includes("prints")) return "in-stock";
  if (artwork.availability.includes("preorder")) return "preorder";
  return null;
}

export function statusLabel(artwork: Artwork): string {
  return statusLabels[artwork.status];
}

/**
 * Public offering lines. An original status comes before prints or pre-order.
 * A print or pre-order on its own stays hidden until that painting has sizes
 * and prices; the artwork page says pre-orders are coming soon until then.
 * In an allowed pair, both statuses are shown, original first.
 */
export function offeringLabels(artwork: Artwork): string[] {
  const paired = artwork.availability.length > 1;

  return artwork.availability.flatMap((offering) => {
    if (
      !paired &&
      (offering === "prints" || offering === "preorder") &&
      !hasPrintOptions(artwork)
    ) {
      return [];
    }

    return [availabilityLabel[offering]];
  });
}

/** Admin summary of the saved selection, including offerings not yet public. */
export function availabilitySummary(artwork: Artwork): string {
  return artwork.availability
    .map((offering) => availabilityLabel[offering])
    .join(" · ");
}

export function formatDimensions(
  artwork: Pick<Artwork, "widthInches" | "heightInches">,
  style: "short" | "long" = "short",
): string {
  const size = `${artwork.widthInches} × ${artwork.heightInches}`;
  return style === "long" ? `${size} inches` : `${size} in`;
}

export function formatPrice(dollars: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}
