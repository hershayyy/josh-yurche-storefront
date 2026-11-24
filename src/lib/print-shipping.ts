import type { OrderLine, OrderShipment, ShippingChoice } from "@/lib/order-status";
import type { PrintType } from "@/lib/print-type";
import type { PackageRates } from "@/lib/shipping-rate";

export type CartLineQuote = {
  artworkSlug: string;
  artworkTitle: string;
  printId: string;
  printType: PrintType;
  size: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  kind: "in-stock" | "preorder";
  /** The painting's own estimate. Empty for in-stock prints. */
  estimatedShipWindow: string;
  longerInches: number | null;
};

export type QuoteShipment = {
  fulfillment: "pack" | "hold";
  shipWindow: string;
  shippingCents: number;
  lines: CartLineQuote[];
};

export type ShippingPlan = {
  id: ShippingChoice | "scheduled";
  label: string;
  shipments: QuoteShipment[];
  shippingCents: number;
  /**
   * Difference versus shipping each group on its own.
   * Zero unless waiting removes a shared package.
   */
  savingsCents: number;
};

export type CartQuote = {
  lines: CartLineQuote[];
  merchandiseCents: number;
  mixed: boolean;
  /** Null when the rates needed for this cart are not configured. */
  plans: ShippingPlan[] | null;
};

export type ShippingPricing = {
  singleCents: number | null;
  rates: PackageRates | null;
};

/**
 * Prints at or under the longer-side limit share a package, up to
 * printsPerPackage. Anything larger, or a size we cannot read, ships alone.
 * Combining groups saves money only when those shared packages get fewer.
 */
export function packageCharge(
  items: { longerInches: number | null; quantity: number }[],
  rates: PackageRates,
): number {
  let standard = 0;
  let solo = 0;

  for (const item of items) {
    if (item.longerInches !== null && item.longerInches <= rates.maxSharedInches) {
      standard += item.quantity;
    } else {
      solo += item.quantity;
    }
  }

  const sharedPackages = standard === 0 ? 0 : Math.ceil(standard / rates.printsPerPackage);
  return sharedPackages * rates.sharedPackageCents + solo * rates.soloPackageCents;
}

export function longerSideInches(size: string): number | null {
  const match = size.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return Math.max(width, height);
}

export function quotePrintCart(lines: CartLineQuote[], pricing: ShippingPricing): CartQuote {
  const merchandiseCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const mixed =
    lines.some((line) => line.kind === "in-stock") &&
    lines.some((line) => line.kind === "preorder");
  const cartQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (lines.length === 0) {
    return { lines, merchandiseCents, mixed, plans: [] };
  }

  const separate = shipmentsFor(lines, "separate", cartQuantity, pricing);
  if (!separate) return { lines, merchandiseCents, mixed, plans: null };

  if (!mixed) {
    return {
      lines,
      merchandiseCents,
      mixed,
      plans: [
        {
          id: "scheduled",
          label: "Shipping",
          shipments: separate,
          shippingCents: totalShipping(separate),
          savingsCents: 0,
        },
      ],
    };
  }

  const together = shipmentsFor(lines, "together", cartQuantity, pricing);
  if (!together) return { lines, merchandiseCents, mixed, plans: null };

  const separateCents = totalShipping(separate);
  const togetherCents = totalShipping(together);

  return {
    lines,
    merchandiseCents,
    mixed,
    plans: [
      {
        id: "ship-as-available",
        label: "Ship as available",
        shipments: separate,
        shippingCents: separateCents,
        savingsCents: 0,
      },
      {
        id: "wait-together",
        label: "Wait and ship together",
        shipments: together,
        shippingCents: togetherCents,
        savingsCents: Math.max(0, separateCents - togetherCents),
      },
    ],
  };
}

export function orderShipments(plan: ShippingPlan): OrderShipment[] {
  return plan.shipments.map((shipment) => ({
    fulfillment: shipment.fulfillment,
    shipWindow: shipment.shipWindow,
    shippingCents: shipment.shippingCents,
    lines: shipment.lines.map((line) => toOrderLine(line)),
  }));
}

function toOrderLine(line: CartLineQuote): OrderLine {
  return {
    artworkSlug: line.artworkSlug,
    artworkTitle: line.artworkTitle,
    printId: line.printId,
    printType: line.printType,
    size: line.size,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    kind: line.kind,
    shipWindow: line.estimatedShipWindow,
  };
}

function totalShipping(shipments: QuoteShipment[]) {
  return shipments.reduce((sum, shipment) => sum + shipment.shippingCents, 0);
}

function chargeItems(
  items: CartLineQuote[],
  cartQuantity: number,
  pricing: ShippingPricing,
): number | null {
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (quantity === 0) return 0;
  if (cartQuantity === 1) return pricing.singleCents;
  if (!pricing.rates) return null;
  return packageCharge(items, pricing.rates);
}

function shipmentsFor(
  lines: CartLineQuote[],
  mode: "separate" | "together",
  cartQuantity: number,
  pricing: ShippingPricing,
): QuoteShipment[] | null {
  if (mode === "together") {
    const preorders = lines.filter((line) => line.kind === "preorder");
    const shipWindow = uniqueWindows(preorders);
    const shippingCents = chargeItems(lines, cartQuantity, pricing);
    if (shippingCents === null) return null;

    return [
      {
        fulfillment: "hold",
        shipWindow,
        shippingCents,
        lines,
      },
    ];
  }

  const shipments: QuoteShipment[] = [];
  const inStock = lines.filter((line) => line.kind === "in-stock");

  if (inStock.length > 0) {
    const shippingCents = chargeItems(inStock, cartQuantity, pricing);
    if (shippingCents === null) return null;
    shipments.push({
      fulfillment: "pack",
      shipWindow: "",
      shippingCents,
      lines: inStock,
    });
  }

  const groups = new Map<string, CartLineQuote[]>();

  for (const line of lines) {
    if (line.kind !== "preorder") continue;
    const group = groups.get(line.estimatedShipWindow) ?? [];
    group.push(line);
    groups.set(line.estimatedShipWindow, group);
  }

  for (const [shipWindow, group] of groups) {
    const shippingCents = chargeItems(group, cartQuantity, pricing);
    if (shippingCents === null) return null;
    shipments.push({
      fulfillment: "hold",
      shipWindow,
      shippingCents,
      lines: group,
    });
  }

  return shipments;
}

function uniqueWindows(lines: CartLineQuote[]) {
  return [...new Set(lines.map((line) => line.estimatedShipWindow).filter(Boolean))].join(" · ");
}
