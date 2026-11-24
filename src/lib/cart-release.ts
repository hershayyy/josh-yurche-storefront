export type CartLine = {
  artworkSlug: string;
  printId: string;
  quantity: number;
};

export const CART_COOKIE = "jy_cart";
export const SETTLED_COOKIE = "jy_cart_settled";
export const MAX_LINES = 12;
export const MAX_QUANTITY = 10;
const MAX_SETTLED = 12;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRINT_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const SESSION_ID = /^cs_test_[A-Za-z0-9]+$/;
export const CART_MAX_AGE = 60 * 60 * 24 * 14;

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function parseCartCookie(raw: string | undefined): CartLine[] {
  if (!raw) return [];

  try {
    return parseStored(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function parseStored(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];

  const lines: CartLine[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;

    const record = item as Record<string, unknown>;
    const artworkSlug = typeof record.artworkSlug === "string" ? record.artworkSlug : "";
    const printId = typeof record.printId === "string" ? record.printId : "";
    const quantity = typeof record.quantity === "number" ? record.quantity : 0;

    if (
      !SLUG.test(artworkSlug) ||
      artworkSlug.length > 80 ||
      !PRINT_ID.test(printId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      continue;
    }

    const existing = lines.find(
      (line) => line.artworkSlug === artworkSlug && line.printId === printId,
    );

    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
    } else if (lines.length < MAX_LINES) {
      lines.push({ artworkSlug, printId, quantity });
    }
  }

  return lines;
}

export function parseSettledSessions(raw: string | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is string =>
          typeof item === "string" && SESSION_ID.test(item) && item.length <= 120,
      )
      .slice(-MAX_SETTLED);
  } catch {
    return [];
  }
}

export type PurchasedLine = {
  artworkSlug: string;
  printId: string;
  quantity: number;
};

export function purchasedLines(order: {
  shipments?: { lines: PurchasedLine[] }[];
}): PurchasedLine[] {
  const totals = new Map<string, PurchasedLine>();

  for (const shipment of order.shipments ?? []) {
    for (const line of shipment.lines) {
      if (
        !SLUG.test(line.artworkSlug) ||
        line.artworkSlug.length > 80 ||
        !PRINT_ID.test(line.printId) ||
        !Number.isInteger(line.quantity) ||
        line.quantity < 1
      ) {
        continue;
      }

      const key = `${line.artworkSlug}\0${line.printId}`;
      const existing = totals.get(key);

      if (existing) existing.quantity += line.quantity;
      else {
        totals.set(key, {
          artworkSlug: line.artworkSlug,
          printId: line.printId,
          quantity: line.quantity,
        });
      }
    }
  }

  return [...totals.values()];
}

/** Remove only the paid quantities. Lines and extra quantities added later stay. */
export function withoutPurchased(cart: CartLine[], purchased: PurchasedLine[]): CartLine[] {
  const next = cart.map((line) => ({ ...line }));

  for (const item of purchased) {
    const line = next.find(
      (entry) => entry.artworkSlug === item.artworkSlug && entry.printId === item.printId,
    );
    if (!line) continue;
    line.quantity -= item.quantity;
  }

  return next.filter((line) => line.quantity > 0);
}

/**
 * One release per Checkout Session. A second call for the same session returns
 * null so a refresh cannot remove those quantities again.
 */
export function cartReleaseUpdate(input: {
  cartRaw: string | undefined;
  settledRaw: string | undefined;
  purchased: PurchasedLine[];
  sessionId: string;
}): { cartValue: string; cartMaxAge: number; settledValue: string } | null {
  if (!SESSION_ID.test(input.sessionId) || input.sessionId.length > 120) return null;
  if (input.purchased.length === 0) return null;

  const settled = parseSettledSessions(input.settledRaw);
  if (settled.includes(input.sessionId)) return null;

  const cart = withoutPurchased(parseCartCookie(input.cartRaw), input.purchased);
  const remembered = [
    ...settled.filter((id) => id !== input.sessionId),
    input.sessionId,
  ].slice(-MAX_SETTLED);

  return {
    cartValue: JSON.stringify(cart),
    cartMaxAge: cart.length === 0 ? 0 : CART_MAX_AGE,
    settledValue: JSON.stringify(remembered),
  };
}
