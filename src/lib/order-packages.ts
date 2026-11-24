import { longerSideInches } from "@/lib/print-shipping";
import type { PackageRates } from "@/lib/shipping-rate";
import type { OrderLine, PackageTracking, PrintOrder } from "@/lib/order-status";

export type OrderPackage = {
  id: string;
  fulfillment: "pack" | "hold";
  shipWindow: string;
  lines: OrderLine[];
};

const CARRIER = /^[A-Za-z0-9][A-Za-z0-9 .&'-]{0,39}$/;
const TRACKING_NUMBER = /^[A-Za-z0-9]{8,34}$/;

/**
 * One trackable package per box. Prints that fit together fill a package up to
 * the shared limit. A longer print ships in its own package.
 */
export function orderPackages(order: PrintOrder, rates: PackageRates | null): OrderPackage[] {
  if (!order.shipments || order.shipments.length === 0) {
    return [
      {
        id: "legacy",
        fulfillment: order.shipWindow ? "hold" : "pack",
        shipWindow: order.shipWindow,
        lines: [
          {
            artworkSlug: order.artworkSlug,
            artworkTitle: order.artworkTitle,
            printId: "legacy",
            ...(order.printType ? { printType: order.printType } : {}),
            size: order.size,
            quantity: 1,
            unitPriceCents: order.unitPriceCents,
            kind: order.shipWindow ? "preorder" : "in-stock",
            shipWindow: order.shipWindow,
          },
        ],
      },
    ];
  }

  return order.shipments.flatMap((shipment, shipmentIndex) =>
    rates
      ? splitShipment(shipment.lines, shipmentIndex, shipment.fulfillment, shipment.shipWindow, rates)
      : [
          {
            id: `${shipmentIndex}:0`,
            fulfillment: shipment.fulfillment,
            shipWindow: shipment.shipWindow,
            lines: shipment.lines,
          },
        ],
  );
}

function splitShipment(
  lines: OrderLine[],
  shipmentIndex: number,
  fulfillment: "pack" | "hold",
  shipWindow: string,
  rates: PackageRates,
): OrderPackage[] {
  const packages: OrderPackage[] = [];
  let shared: OrderLine[] = [];
  let sharedCount = 0;

  const push = (packageLines: OrderLine[]) => {
    packages.push({
      id: `${shipmentIndex}:${packages.length}`,
      fulfillment,
      shipWindow,
      lines: packageLines,
    });
  };

  const flushShared = () => {
    if (sharedCount === 0) return;
    push(shared);
    shared = [];
    sharedCount = 0;
  };

  for (const line of lines) {
    const longer = longerSideInches(line.size);
    const solo = longer === null || longer > rates.maxSharedInches;

    if (solo) {
      flushShared();
      for (let count = 0; count < line.quantity; count += 1) {
        push([{ ...line, quantity: 1 }]);
      }
      continue;
    }

    let remaining = line.quantity;

    while (remaining > 0) {
      const room = rates.printsPerPackage - sharedCount;
      const take = Math.min(room, remaining);
      shared.push({ ...line, quantity: take });
      sharedCount += take;
      remaining -= take;
      if (sharedCount >= rates.printsPerPackage) flushShared();
    }
  }

  flushShared();
  return packages;
}

export function fulfillmentState(
  packages: OrderPackage[],
  tracking: PackageTracking[],
): "open" | "partial" | "shipped" {
  const shipped = new Set(tracking.map((item) => item.packageId));
  const count = packages.filter((item) => shipped.has(item.id)).length;
  if (packages.length === 0 || count === 0) return "open";
  if (count === packages.length) return "shipped";
  return "partial";
}

export function withPackageShipped(
  order: PrintOrder,
  packages: OrderPackage[],
  input: { packageId: string; carrier: string; trackingNumber: string; shippedAt: string },
): { ok: true; order: PrintOrder } | { ok: false; error: string } {
  const packageId = input.packageId;
  if (!packages.some((item) => item.id === packageId)) {
    return { ok: false, error: "That package is not on this order." };
  }

  const carrier = input.carrier.trim().replace(/\s+/g, " ");
  const trackingNumber = input.trackingNumber.replace(/[\s-]/g, "");

  if (!CARRIER.test(carrier)) return { ok: false, error: "Enter a carrier." };
  if (!TRACKING_NUMBER.test(trackingNumber)) {
    return { ok: false, error: "Enter a tracking number." };
  }

  const existing = order.packageTracking ?? [];
  if (existing.some((item) => item.packageId === packageId)) {
    return { ok: false, error: "That package is already shipped." };
  }

  const packageTracking = [
    ...existing,
    {
      packageId,
      carrier,
      trackingNumber,
      shippedAt: input.shippedAt,
    },
  ];
  const complete = fulfillmentState(packages, packageTracking) === "shipped";
  const next: PrintOrder = { ...order, packageTracking };

  if (complete) next.shippedAt = input.shippedAt;
  else delete next.shippedAt;

  return { ok: true, order: next };
}
