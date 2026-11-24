import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { AdminError } from "@/lib/admin-error";
import { validateContiguousAddress, type DeliveryAddress } from "@/lib/contiguous-us";
import {
  applyOrderEvent,
  parsePackageTracking,
  parseShipments,
  type OrderStatus,
  type PrintOrder,
} from "@/lib/order-status";
import { isPrintType } from "@/lib/print-type";
import { storageTarget } from "@/lib/catalog-store";

const LOCAL_PATH = path.join(process.cwd(), ".data", "orders.json");

type OrderFile = { orders: PrintOrder[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function target() {
  try {
    return storageTarget();
  } catch (error) {
    throw new AdminError(
      error instanceof Error ? error.message : "Artwork storage is not configured.",
    );
  }
}

function parseAddress(value: unknown): DeliveryAddress | null {
  if (!isRecord(value)) return null;
  const checked = validateContiguousAddress({
    name: String(value.name ?? ""),
    line1: String(value.line1 ?? ""),
    line2: String(value.line2 ?? ""),
    city: String(value.city ?? ""),
    state: String(value.state ?? ""),
    postalCode: String(value.postalCode ?? ""),
  });
  return checked.ok ? checked.address : null;
}

function parseOrder(value: unknown): PrintOrder {
  if (!isRecord(value)) throw new Error("Print order is invalid.");

  const status = value.status;
  const address = parseAddress(value.shippingAddress);
  const statuses = new Set<OrderStatus>(["pending", "paid", "canceled", "expired"]);

  if (
    typeof value.id !== "string" ||
    typeof value.stripeSessionId !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.artworkSlug !== "string" ||
    typeof value.artworkTitle !== "string" ||
    typeof value.size !== "string" ||
    typeof value.unitPriceCents !== "number" ||
    typeof value.shippingCents !== "number" ||
    typeof value.shipWindow !== "string" ||
    !statuses.has(status as OrderStatus) ||
    !address ||
    !Array.isArray(value.eventIds)
  ) {
    throw new Error("Print order is invalid.");
  }

  const order: PrintOrder = {
    id: value.id,
    stripeSessionId: value.stripeSessionId,
    status: status as OrderStatus,
    createdAt: value.createdAt,
    artworkSlug: value.artworkSlug,
    artworkTitle: value.artworkTitle,
    size: value.size,
    unitPriceCents: value.unitPriceCents,
    shippingCents: value.shippingCents,
    shipWindow: value.shipWindow,
    shippingAddress: address,
    eventIds: value.eventIds.filter((item): item is string => typeof item === "string"),
  };

  if (isPrintType(value.printType)) order.printType = value.printType;
  if (typeof value.paidAt === "string" && value.paidAt) order.paidAt = value.paidAt;
  if (typeof value.email === "string" && value.email) order.email = value.email;
  if (typeof value.shippedAt === "string" && value.shippedAt) order.shippedAt = value.shippedAt;

  if (value.packageTracking !== undefined) {
    const tracking = parsePackageTracking(value.packageTracking);
    if (!tracking) throw new Error("Print order is invalid.");
    order.packageTracking = tracking;
  }

  if (
    value.shippingChoice !== undefined &&
    value.shippingChoice !== "ship-as-available" &&
    value.shippingChoice !== "wait-together"
  ) {
    throw new Error("Print order is invalid.");
  }

  if (value.shipments !== undefined) {
    const shipments = parseShipments(value.shipments);
    if (!shipments) throw new Error("Print order is invalid.");
    order.shipments = shipments;
  }

  if (
    value.shippingChoice === "ship-as-available" ||
    value.shippingChoice === "wait-together"
  ) {
    order.shippingChoice = value.shippingChoice;
  }

  return order;
}

async function readLocal(): Promise<PrintOrder[]> {
  try {
    const raw = await readFile(LOCAL_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.orders)) {
      throw new Error("Print orders are invalid.");
    }
    return parsed.orders.map(parseOrder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeLocal(orders: PrintOrder[]) {
  const file: OrderFile = { orders };
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  const temporary = `${LOCAL_PATH}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(file, null, 2)}\n`);
  await rename(temporary, LOCAL_PATH);
}

async function ensureTable(url: string) {
  const sql = neon(url);
  await sql.query(
    `CREATE TABLE IF NOT EXISTS print_orders (
      stripe_session_id text PRIMARY KEY,
      status text NOT NULL,
      document jsonb NOT NULL
    )`,
  );
  await sql.query(
    "CREATE INDEX IF NOT EXISTS print_orders_status ON print_orders (status)",
  );
}

function documentOf(row: Record<string, unknown> | undefined): unknown {
  const document = row?.document;
  return typeof document === "string" ? (JSON.parse(document) as unknown) : document;
}

async function readCloud(url: string): Promise<PrintOrder[]> {
  await ensureTable(url);
  const sql = neon(url);
  const rows = await sql.query("SELECT document FROM print_orders");
  return rows.map((row) => parseOrder(documentOf(row as Record<string, unknown>)));
}

async function upsertCloud(url: string, order: PrintOrder) {
  await ensureTable(url);
  const sql = neon(url);
  await sql.query(
    `INSERT INTO print_orders (stripe_session_id, status, document)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (stripe_session_id) DO UPDATE
     SET status = CASE
           WHEN print_orders.status = 'paid' THEN print_orders.status
           ELSE EXCLUDED.status
         END,
         document = CASE
           WHEN print_orders.status = 'paid' THEN print_orders.document
           ELSE EXCLUDED.document
         END`,
    [order.stripeSessionId, order.status, JSON.stringify(order)],
  );
}

let writeQueue: Promise<void> = Promise.resolve();

async function updateLocal(mutate: (orders: PrintOrder[]) => void) {
  const run = async () => {
    const orders = await readLocal();
    mutate(orders);
    await writeLocal(orders);
  };

  const result = writeQueue.then(run, run);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  await result;
}

export async function savePendingOrder(order: PrintOrder) {
  const storage = target();

  if (storage.mode === "unconfigured") {
    throw new AdminError("Connect Postgres before taking print pre-orders.");
  }

  if (storage.mode === "local") {
    await updateLocal((orders) => {
      if (orders.some((item) => item.stripeSessionId === order.stripeSessionId)) return;
      orders.push(order);
    });
    return;
  }

  await upsertCloud(storage.databaseUrl, order);
}

export async function recordOrderEvent(
  fallback: PrintOrder,
  event: {
    eventId: string;
    next: "paid" | "canceled" | "expired";
    at: string;
    email?: string;
  },
) {
  const storage = target();

  if (storage.mode === "unconfigured") {
    throw new AdminError("Connect Postgres before recording print pre-orders.");
  }

  if (storage.mode === "local") {
    await updateLocal((orders) => {
      const index = orders.findIndex(
        (item) => item.stripeSessionId === fallback.stripeSessionId,
      );
      const current = index === -1 ? fallback : orders[index];
      const next = applyOrderEvent(current, event);

      if (index === -1) orders.push(next);
      else orders[index] = next;
    });
    return;
  }

  await ensureTable(storage.databaseUrl);
  const sql = neon(storage.databaseUrl);
  const rows = await sql.query(
    "SELECT document FROM print_orders WHERE stripe_session_id = $1",
    [fallback.stripeSessionId],
  );
  const existing = rows[0]
    ? parseOrder(documentOf(rows[0] as Record<string, unknown>))
    : fallback;
  await upsertCloud(storage.databaseUrl, applyOrderEvent(existing, event));
}

export async function listPaidOrders(): Promise<PrintOrder[]> {
  const storage = target();
  const orders =
    storage.mode === "cloud"
      ? await readCloud(storage.databaseUrl)
      : storage.mode === "local"
        ? await readLocal()
        : [];

  return orders
    .filter((order) => order.status === "paid")
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
}

const ORDER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPaidOrder(orderId: string): Promise<PrintOrder | null> {
  if (!ORDER_ID.test(orderId)) return null;
  const orders = await listPaidOrders();
  return orders.find((order) => order.id === orderId) ?? null;
}

export async function updatePaidOrder(
  orderId: string,
  update: (order: PrintOrder) => PrintOrder,
): Promise<void> {
  if (!ORDER_ID.test(orderId)) {
    throw new AdminError("That paid order could not be found.");
  }

  const storage = target();

  if (storage.mode === "unconfigured") {
    throw new AdminError("Connect Postgres before updating paid orders.");
  }

  if (storage.mode === "local") {
    let found = false;

    await updateLocal((orders) => {
      const index = orders.findIndex((item) => item.id === orderId && item.status === "paid");
      if (index === -1) return;
      found = true;
      const next = update(orders[index]);

      if (next.status !== "paid" || next.id !== orderId) {
        throw new Error("Paid order update is invalid.");
      }

      orders[index] = next;
    });

    if (!found) throw new AdminError("That paid order could not be found.");
    return;
  }

  await ensureTable(storage.databaseUrl);
  const sql = neon(storage.databaseUrl);
  const rows = await sql.query(
    "SELECT document FROM print_orders WHERE status = 'paid'",
  );
  const current = rows
    .map((row) => parseOrder(documentOf(row as Record<string, unknown>)))
    .find((order) => order.id === orderId);

  if (!current) throw new AdminError("That paid order could not be found.");

  const next = update(current);

  if (next.status !== "paid" || next.id !== orderId || next.stripeSessionId !== current.stripeSessionId) {
    throw new Error("Paid order update is invalid.");
  }

  await sql.query(
    `UPDATE print_orders
     SET document = $2::jsonb
     WHERE stripe_session_id = $1 AND status = 'paid'`,
    [current.stripeSessionId, JSON.stringify(next)],
  );
}

export async function getOrderBySession(sessionId: string): Promise<PrintOrder | null> {
  if (!sessionId.startsWith("cs_test_")) return null;

  const storage = target();
  const orders =
    storage.mode === "cloud"
      ? await readCloud(storage.databaseUrl)
      : storage.mode === "local"
        ? await readLocal()
        : [];

  return orders.find((order) => order.stripeSessionId === sessionId) ?? null;
}
