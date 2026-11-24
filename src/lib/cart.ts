import "server-only";
import { cookies } from "next/headers";
import { AdminError } from "@/lib/admin-error";
import {
  availablePrints,
  dollarsToCents,
  printOfferKind,
} from "@/lib/artwork";
import { getArtworks } from "@/lib/catalog";
import {
  CART_COOKIE,
  CART_MAX_AGE,
  cookieOptions,
  MAX_LINES,
  MAX_QUANTITY,
  parseCartCookie,
  type CartLine,
} from "@/lib/cart-release";
import {
  longerSideInches,
  type CartLineQuote,
} from "@/lib/print-shipping";

export type { CartLine };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRINT_ID = /^[a-zA-Z0-9_-]{1,80}$/;

export type ResolvedCart = {
  lines: CartLineQuote[];
  missing: CartLine[];
};

function parseQuantity(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const quantity = Number(value);
  if (quantity < 1 || quantity > MAX_QUANTITY) return null;
  return quantity;
}

async function writeCart(lines: CartLine[]) {
  const jar = await cookies();

  jar.set(
    CART_COOKIE,
    JSON.stringify(lines),
    cookieOptions(lines.length === 0 ? 0 : CART_MAX_AGE),
  );
}

export async function readCart(): Promise<CartLine[]> {
  const jar = await cookies();
  return parseCartCookie(jar.get(CART_COOKIE)?.value);
}

export async function cartCount(): Promise<number> {
  const lines = await readCart();
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export async function resolveCart(lines: CartLine[]): Promise<ResolvedCart> {
  const artworks = await getArtworks();
  const resolved: CartLineQuote[] = [];
  const missing: CartLine[] = [];

  for (const line of lines) {
    const artwork = artworks.find((item) => item.slug === line.artworkSlug);
    const kind = artwork ? printOfferKind(artwork) : null;
    const print = artwork
      ? availablePrints(artwork).find((item) => item.id === line.printId)
      : undefined;
    const unitPriceCents = print ? dollarsToCents(print.price) : 0;

    if (!artwork || !kind || !print || !Number.isInteger(unitPriceCents) || unitPriceCents <= 0) {
      missing.push(line);
      continue;
    }

    resolved.push({
      artworkSlug: artwork.slug,
      artworkTitle: artwork.title.slice(0, 200),
      printId: print.id,
      printType: print.type,
      size: print.size.slice(0, 80),
      quantity: line.quantity,
      unitPriceCents,
      lineTotalCents: unitPriceCents * line.quantity,
      kind,
      estimatedShipWindow:
        kind === "preorder" ? (artwork.estimatedPrintShipping ?? "").slice(0, 450) : "",
      longerInches: longerSideInches(print.size),
    });
  }

  return { lines: resolved, missing };
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function addCartLine(formData: FormData) {
  const artworkSlug = text(formData, "slug");
  const printId = text(formData, "printId");
  const quantity = parseQuantity(text(formData, "quantity"));

  if (!SLUG.test(artworkSlug) || !PRINT_ID.test(printId) || quantity === null) {
    throw new AdminError("Choose a print and a quantity from 1 to 10.");
  }

  const lines = await readCart();
  const existing = lines.find(
    (line) => line.artworkSlug === artworkSlug && line.printId === printId,
  );

  if (existing) {
    if (existing.quantity >= MAX_QUANTITY) {
      throw new AdminError("That print is already at the maximum quantity.");
    }
    existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
  } else if (lines.length >= MAX_LINES) {
    throw new AdminError("The cart can hold 12 print sizes.");
  } else {
    lines.push({ artworkSlug, printId, quantity });
  }

  const resolved = await resolveCart(lines);
  const added = resolved.lines.some(
    (line) => line.artworkSlug === artworkSlug && line.printId === printId,
  );

  if (!added) throw new AdminError("That print is not available.");

  await writeCart(
    lines.filter(
      (line) =>
        !resolved.missing.some(
          (missing) =>
            missing.artworkSlug === line.artworkSlug && missing.printId === line.printId,
        ),
    ),
  );
}

export async function updateCartLine(formData: FormData) {
  const artworkSlug = text(formData, "slug");
  const printId = text(formData, "printId");
  const quantity = parseQuantity(text(formData, "quantity"));
  if (quantity === null) throw new AdminError("Enter a quantity from 1 to 10.");

  const lines = await readCart();
  const existing = lines.find(
    (line) => line.artworkSlug === artworkSlug && line.printId === printId,
  );

  if (!existing) throw new AdminError("That print is no longer in the cart.");
  existing.quantity = quantity;
  await writeCart(lines);
}

export async function removeCartLine(formData: FormData) {
  const artworkSlug = text(formData, "slug");
  const printId = text(formData, "printId");

  await writeCart(
    (await readCart()).filter(
      (line) => line.artworkSlug !== artworkSlug || line.printId !== printId,
    ),
  );
}

export async function clearCart() {
  await writeCart([]);
}
