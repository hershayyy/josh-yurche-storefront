import type { DeliveryAddress } from "@/lib/contiguous-us";
import { isPrintType, type PrintType } from "@/lib/print-type";

export type OrderStatus = "pending" | "paid" | "canceled" | "expired";

export type ShippingChoice = "ship-as-available" | "wait-together";

export type OrderLine = {
  artworkSlug: string;
  artworkTitle: string;
  printId: string;
  /** Saved at checkout. Absent on orders placed before print types existed. */
  printType?: PrintType;
  /** Saved at checkout. Absent orders stay on the flat-mailer rules. */
  shipsRolled?: boolean;
  size: string;
  quantity: number;
  unitPriceCents: number;
  kind: "in-stock" | "preorder";
  /** When this line ships under the buyer's choice. Empty when it ships now. */
  shipWindow: string;
};

export type OrderShipment = {
  /** Pack now, or hold until the ship window. */
  fulfillment: "pack" | "hold";
  shipWindow: string;
  shippingCents: number;
  lines: OrderLine[];
};

export type PackageTracking = {
  packageId: string;
  carrier: string;
  trackingNumber: string;
  shippedAt: string;
};

export type PrintOrder = {
  id: string;
  stripeSessionId: string;
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  artworkSlug: string;
  artworkTitle: string;
  /** Saved for a single-print order. Cart orders keep the type on each line. */
  printType?: PrintType;
  size: string;
  unitPriceCents: number;
  shippingCents: number;
  /** The ship window shown on the page and at checkout. Empty when none was shown. */
  shipWindow: string;
  shippingAddress: DeliveryAddress;
  email?: string;
  eventIds: string[];
  /** Set when the cart mixes in-stock prints and pre-orders. */
  shippingChoice?: ShippingChoice;
  /** Present for cart checkouts. Older single-print orders omit this. */
  shipments?: OrderShipment[];
  /** Tracking saved for each package. Absent until a package is marked shipped. */
  packageTracking?: PackageTracking[];
  /** Set only after every package on the order has shipped. */
  shippedAt?: string;
};

/**
 * Paid is final. A repeated or later non-payment event cannot create a second
 * order or remove a paid order from the shipping queue.
 */
export function applyOrderEvent(
  order: PrintOrder,
  input: {
    eventId: string;
    next: "paid" | "canceled" | "expired";
    at: string;
    email?: string;
  },
): PrintOrder {
  if (order.eventIds.includes(input.eventId)) return order;

  const eventIds = [...order.eventIds, input.eventId].slice(-30);

  if (order.status === "paid") return { ...order, eventIds };

  if (input.next === "paid") {
    return {
      ...order,
      status: "paid",
      paidAt: order.paidAt ?? input.at,
      email: input.email || order.email,
      eventIds,
    };
  }

  if (order.status !== "pending") return { ...order, eventIds };
  return { ...order, status: input.next, eventIds };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseShipments(value: unknown): OrderShipment[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return null;

  const shipments: OrderShipment[] = [];
  let lineCount = 0;

  for (const shipment of value) {
    if (!isRecord(shipment)) return null;

    const fulfillment = shipment.fulfillment;
    const lines = shipment.lines;

    if (
      (fulfillment !== "pack" && fulfillment !== "hold") ||
      typeof shipment.shipWindow !== "string" ||
      shipment.shipWindow.length > 450 ||
      !Number.isInteger(shipment.shippingCents) ||
      Number(shipment.shippingCents) < 0 ||
      Number(shipment.shippingCents) > 5_000_000 ||
      !Array.isArray(lines) ||
      lines.length < 1
    ) {
      return null;
    }

    const parsedLines: OrderLine[] = [];

    for (const line of lines) {
      if (!isOrderLine(line)) return null;
      parsedLines.push(orderLine(line));
    }

    lineCount += parsedLines.length;
    if (lineCount > 12) return null;

    shipments.push({
      fulfillment,
      shipWindow: shipment.shipWindow,
      shippingCents: Number(shipment.shippingCents),
      lines: parsedLines,
    });
  }

  return shipments;
}

function orderLine(value: OrderLine): OrderLine {
  const line: OrderLine = {
    artworkSlug: value.artworkSlug,
    artworkTitle: value.artworkTitle,
    printId: value.printId,
    size: value.size,
    quantity: value.quantity,
    unitPriceCents: value.unitPriceCents,
    kind: value.kind,
    shipWindow: value.shipWindow,
  };

  if (isPrintType(value.printType)) line.printType = value.printType;
  if (value.shipsRolled === true) line.shipsRolled = true;
  return line;
}

function isOrderLine(value: unknown): value is OrderLine {
  if (!isRecord(value)) return false;

  return (
    typeof value.artworkSlug === "string" &&
    value.artworkSlug.length > 0 &&
    value.artworkSlug.length <= 80 &&
    typeof value.artworkTitle === "string" &&
    value.artworkTitle.length > 0 &&
    value.artworkTitle.length <= 200 &&
    typeof value.printId === "string" &&
    value.printId.length > 0 &&
    value.printId.length <= 80 &&
    typeof value.size === "string" &&
    value.size.length > 0 &&
    value.size.length <= 80 &&
    Number.isInteger(value.quantity) &&
    Number(value.quantity) >= 1 &&
    Number(value.quantity) <= 10 &&
    Number.isInteger(value.unitPriceCents) &&
    Number(value.unitPriceCents) > 0 &&
    Number(value.unitPriceCents) <= 1_000_000 &&
    (value.kind === "in-stock" || value.kind === "preorder") &&
    typeof value.shipWindow === "string" &&
    value.shipWindow.length <= 450
  );
}

const PACKAGE_ID = /^(?:legacy|\d+:\d+)$/;
const CARRIER = /^[A-Za-z0-9][A-Za-z0-9 .&'-]{0,39}$/;
const TRACKING_NUMBER = /^[A-Za-z0-9]{8,34}$/;

export function parsePackageTracking(value: unknown): PackageTracking[] | null {
  if (!Array.isArray(value) || value.length > 24) return null;

  const tracking: PackageTracking[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) return null;
    const carrier = typeof item.carrier === "string" ? item.carrier.trim() : "";
    const trackingNumber =
      typeof item.trackingNumber === "string"
        ? item.trackingNumber.replace(/[\s-]/g, "")
        : "";

    if (
      typeof item.packageId !== "string" ||
      !PACKAGE_ID.test(item.packageId) ||
      seen.has(item.packageId) ||
      !CARRIER.test(carrier) ||
      !TRACKING_NUMBER.test(trackingNumber) ||
      typeof item.shippedAt !== "string" ||
      !Number.isFinite(Date.parse(item.shippedAt))
    ) {
      return null;
    }

    seen.add(item.packageId);
    tracking.push({
      packageId: item.packageId,
      carrier,
      trackingNumber,
      shippedAt: item.shippedAt,
    });
  }

  return tracking;
}

const SHIPMENT_CHUNK = 450;

export function encodeShipments(shipments: OrderShipment[]): Record<string, string> {
  const payload = JSON.stringify(shipments);

  if (payload.length > SHIPMENT_CHUNK * 8) {
    throw new Error("Shipment snapshot is too large.");
  }

  const chunks: Record<string, string> = {};

  for (let index = 0; index * SHIPMENT_CHUNK < payload.length; index += 1) {
    chunks[`ship${index}`] = payload.slice(
      index * SHIPMENT_CHUNK,
      (index + 1) * SHIPMENT_CHUNK,
    );
  }

  return chunks;
}

export function shipmentsFromMetadata(
  metadata: Record<string, string | undefined>,
): OrderShipment[] | null {
  if (!metadata.ship0) return null;

  let payload = "";

  for (let index = 0; index < 8; index += 1) {
    const chunk = metadata[`ship${index}`];
    if (!chunk) break;
    payload += chunk;
  }

  try {
    return parseShipments(JSON.parse(payload) as unknown);
  } catch {
    return null;
  }
}
