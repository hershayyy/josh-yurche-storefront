import type { OrderLine, PrintOrder } from "@/lib/order-status";
import { formatPrintChoice } from "@/lib/print-type";

export type SalesRange = {
  from: string | null;
  to: string | null;
};

export type SalesTotals = {
  orderCount: number;
  printsSold: number;
  printSalesCents: number;
  shippingCents: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isTestOrder(order: Pick<PrintOrder, "stripeSessionId">) {
  return order.stripeSessionId.startsWith("cs_test_");
}

export function orderLines(order: PrintOrder): OrderLine[] {
  if (order.shipments && order.shipments.length > 0) {
    return order.shipments.flatMap((shipment) => shipment.lines);
  }

  return [
    {
      artworkSlug: order.artworkSlug,
      artworkTitle: order.artworkTitle,
      printId: "legacy",
      printType: order.printType,
      size: order.size,
      quantity: 1,
      unitPriceCents: order.unitPriceCents,
      kind: order.shipWindow ? "preorder" : "in-stock",
      shipWindow: order.shipWindow,
    },
  ];
}

export function printsInOrder(order: PrintOrder) {
  return orderLines(order).reduce((sum, line) => sum + line.quantity, 0);
}

export function printSalesCents(order: PrintOrder) {
  return orderLines(order).reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
}

export function parseSalesRange(from: string | undefined, to: string | undefined): SalesRange {
  return {
    from: from && DAY.test(from) ? from : null,
    to: to && DAY.test(to) ? to : null,
  };
}

export function paidDay(order: PrintOrder) {
  if (!order.paidAt) return null;
  const time = Date.parse(order.paidAt);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

export function inSalesRange(order: PrintOrder, range: SalesRange) {
  if (!range.from && !range.to) return true;
  const day = paidDay(order);
  if (!day) return false;
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

function emptyTotals(): SalesTotals {
  return { orderCount: 0, printsSold: 0, printSalesCents: 0, shippingCents: 0 };
}

function addOrder(totals: SalesTotals, order: PrintOrder): SalesTotals {
  return {
    orderCount: totals.orderCount + 1,
    printsSold: totals.printsSold + printsInOrder(order),
    printSalesCents: totals.printSalesCents + printSalesCents(order),
    shippingCents: totals.shippingCents + order.shippingCents,
  };
}

export function salesReport(orders: PrintOrder[], range: SalesRange) {
  let live = emptyTotals();
  let test = emptyTotals();

  for (const order of orders) {
    if (order.status !== "paid" || !inSalesRange(order, range)) continue;
    if (isTestOrder(order)) test = addOrder(test, order);
    else live = addOrder(live, order);
  }

  return { live, test };
}

const CSV_COLUMNS = [
  "Order number",
  "Paid date",
  "Artwork",
  "Print size",
  "Quantity",
  "Unit price",
  "Line subtotal",
] as const;

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** Live sales only. One row per print line. No customer or address fields. */
export function salesCsv(orders: PrintOrder[], range: SalesRange) {
  const rows = [CSV_COLUMNS.join(",")];
  const selected = orders
    .filter((order) => order.status === "paid" && !isTestOrder(order) && inSalesRange(order, range))
    .sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? ""));

  for (const order of selected) {
    for (const line of orderLines(order)) {
      rows.push(
        [
          order.id,
          order.paidAt ?? "",
          line.artworkTitle,
          formatPrintChoice(line.printType, line.size),
          line.quantity,
          dollars(line.unitPriceCents),
          dollars(line.unitPriceCents * line.quantity),
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }

  return `${rows.join("\r\n")}\r\n`;
}
