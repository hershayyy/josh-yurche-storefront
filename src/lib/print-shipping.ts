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
  /** True when this print ships in a tube. Flat prints keep the mailer rules. */
  shipsRolled: boolean;
  longerInches: number | null;
  shorterInches: number | null;
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

/** Inches kept free inside a tube for protective wrapping. */
export const TUBE_WRAP_INCHES = 1;

export type PackItem = {
  id: string;
  quantity: number;
  shipsRolled: boolean;
  longerInches: number | null;
  shorterInches: number | null;
};

export type PackedBox = {
  method: "flat" | "tube";
  /** False when a flat print misses the mailer limit, or a roll needs a longer tube. */
  fitsStandard: boolean;
  chargeCents: number;
  reason: string;
  items: { id: string; quantity: number }[];
};

/**
 * Flat prints share a mailer when the longer side is within the mailer limit.
 * Rolled prints use the shorter side against the tube's usable inside length,
 * which leaves room for wrapping. Rolls in this group share one tube up to
 * the package capacity. A tube costs the shared package rate with one print
 * or several. A flat print that misses the mailer limit still ships alone.
 */
export function usableTubeInches(tubeInsideInches: number) {
  return tubeInsideInches - TUBE_WRAP_INCHES;
}

export function packItems(items: PackItem[], rates: PackageRates): PackedBox[] {
  const boxes: PackedBox[] = [];
  const usable = usableTubeInches(rates.tubeInsideInches);
  let shared: { id: string; quantity: number }[] = [];
  let sharedCount = 0;
  const rolls: PackItem[] = [];

  const push = (
    method: PackedBox["method"],
    fitsStandard: boolean,
    chargeCents: number,
    reason: string,
    contents: { id: string; quantity: number }[],
  ) => {
    boxes.push({ method, fitsStandard, chargeCents, reason, items: contents });
  };

  const flushShared = () => {
    if (sharedCount === 0) return;
    push(
      "flat",
      true,
      rates.sharedPackageCents,
      "Flat mailer. The longer side is within the mailer limit, so these prints share one package.",
      shared,
    );
    shared = [];
    sharedCount = 0;
  };

  for (const item of items) {
    if (item.shipsRolled) {
      rolls.push(item);
      continue;
    }

    const fits = item.longerInches !== null && item.longerInches <= rates.maxSharedInches;
    if (!fits) {
      flushShared();
      for (let count = 0; count < item.quantity; count += 1) {
        push(
          "flat",
          false,
          rates.soloPackageCents,
          "Flat mailer. The longer side is over the mailer limit, so this print ships alone.",
          [{ id: item.id, quantity: 1 }],
        );
      }
      continue;
    }

    let remaining = item.quantity;
    while (remaining > 0) {
      const room = rates.printsPerPackage - sharedCount;
      const take = Math.min(room, remaining);
      shared.push({ id: item.id, quantity: take });
      sharedCount += take;
      remaining -= take;
      if (sharedCount >= rates.printsPerPackage) flushShared();
    }
  }

  flushShared();

  const fittingRolls: PackItem[] = [];
  const longerRolls: PackItem[] = [];

  for (const item of rolls) {
    if (item.shorterInches !== null && item.shorterInches <= usable) fittingRolls.push(item);
    else longerRolls.push(item);
  }

  let tube: { id: string; quantity: number }[] = [];
  let tubeCount = 0;
  const flushTube = () => {
    if (tubeCount === 0) return;
    push(
      "tube",
      true,
      rates.sharedPackageCents,
      `Tube. The shorter side fits the ${usable} in usable length of a ${rates.tubeInsideInches} in tube, so these prints share one tube.`,
      tube,
    );
    tube = [];
    tubeCount = 0;
  };

  for (const item of fittingRolls) {
    let remaining = item.quantity;
    while (remaining > 0) {
      const room = rates.printsPerPackage - tubeCount;
      const take = Math.min(room, remaining);
      tube.push({ id: item.id, quantity: take });
      tubeCount += take;
      remaining -= take;
      if (tubeCount >= rates.printsPerPackage) flushTube();
    }
  }

  flushTube();

  for (const item of longerRolls) {
    for (let count = 0; count < item.quantity; count += 1) {
      push(
        "tube",
        false,
        rates.sharedPackageCents,
        `Longer tube. The shorter side is over the ${usable} in usable length, so this print needs its own longer tube.`,
        [{ id: item.id, quantity: 1 }],
      );
    }
  }

  return boxes;
}

export function packageCharge(items: PackItem[], rates: PackageRates): number {
  return packItems(items, rates).reduce((sum, box) => sum + box.chargeCents, 0);
}

function measuredSides(size: string) {
  const match = size.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { longer: Math.max(width, height), shorter: Math.min(width, height) };
}

export function longerSideInches(size: string): number | null {
  return measuredSides(size)?.longer ?? null;
}

export function shorterSideInches(size: string): number | null {
  return measuredSides(size)?.shorter ?? null;
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
    ...(line.shipsRolled ? { shipsRolled: true } : {}),
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
  return packageCharge(
    items.map((item, index) => ({
      id: String(index),
      quantity: item.quantity,
      shipsRolled: item.shipsRolled,
      longerInches: item.longerInches,
      shorterInches: item.shorterInches,
    })),
    pricing.rates,
  );
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
