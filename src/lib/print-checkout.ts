import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { AdminError } from "@/lib/admin-error";
import { readCart, resolveCart } from "@/lib/cart";
import { validateContiguousAddress, type DeliveryAddress } from "@/lib/contiguous-us";
import {
  encodeShipments,
  shipmentsFromMetadata,
  type OrderLine,
  type PrintOrder,
  type ShippingChoice,
} from "@/lib/order-status";
import { getOrderBySession, recordOrderEvent, savePendingOrder } from "@/lib/orders";
import { orderShipments, quotePrintCart } from "@/lib/print-shipping";
import { formatPrintChoice } from "@/lib/print-type";
import { packageRates, printShippingCents } from "@/lib/shipping-rate";
import { stripeClient } from "@/lib/stripe-server";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

async function requestOrigin() {
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "")
    .split(",")[0]
    ?.trim();

  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    throw new AdminError("Checkout could not start. Try again.");
  }

  const forwarded = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = local ? "http" : forwarded === "http" ? "http" : "https";
  return `${proto}://${host}`;
}

export async function createCartCheckout(formData: FormData): Promise<string> {
  const stored = await readCart();
  if (stored.length === 0) throw new AdminError("Your cart is empty.");

  const resolved = await resolveCart(stored);

  if (resolved.missing.length > 0) {
    throw new AdminError("A print in your cart is no longer available.");
  }

  if (resolved.lines.length === 0) throw new AdminError("Your cart is empty.");

  const quote = quotePrintCart(resolved.lines, {
    singleCents: printShippingCents(),
    rates: packageRates(),
  });

  if (!quote.plans || quote.plans.length === 0) {
    throw new AdminError(
      "Set PRINT_SHIPPING_CENTS, PRINT_SOLO_SHIPPING_CENTS, PRINTS_PER_PACKAGE, PRINT_PACKAGE_MAX_INCHES, and PRINT_TUBE_INSIDE_INCHES before checkout.",
    );
  }

  const requested = text(formData, "shippingChoice");
  const plan = quote.mixed
    ? quote.plans.find((item) => item.id === requested)
    : quote.plans[0];

  if (!plan) throw new AdminError("Choose how these prints should ship.");

  const checked = validateContiguousAddress({
    name: text(formData, "name"),
    line1: text(formData, "line1"),
    line2: text(formData, "line2"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    postalCode: text(formData, "postalCode"),
  });

  if (!checked.ok) throw new AdminError(checked.error);

  const shipments = orderShipments(plan);
  const lines = shipments.flatMap((shipment) => shipment.lines);
  const summary = summarizeLines(lines);
  const shippingChoice: ShippingChoice | undefined =
    plan.id === "ship-as-available" || plan.id === "wait-together" ? plan.id : undefined;

  let encoded: Record<string, string>;

  try {
    encoded = encodeShipments(shipments);
  } catch {
    throw new AdminError("Remove a print before checkout.");
  }

  const order: PrintOrder = {
    id: randomUUID(),
    stripeSessionId: "",
    status: "pending",
    createdAt: new Date().toISOString(),
    artworkSlug: summary.artworkSlug,
    artworkTitle: summary.artworkTitle,
    size: summary.size,
    unitPriceCents: summary.unitPriceCents,
    shippingCents: plan.shippingCents,
    shipWindow: summary.shipWindow,
    shippingAddress: checked.address,
    eventIds: [],
    shipments,
  };

  if (shippingChoice) order.shippingChoice = shippingChoice;

  const metadata: Record<string, string> = {
    orderId: order.id,
    artworkSlug: order.artworkSlug,
    artworkTitle: order.artworkTitle.slice(0, 200),
    size: order.size.slice(0, 80),
    unitPriceCents: String(order.unitPriceCents),
    shippingCents: String(order.shippingCents),
    shipWindow: order.shipWindow.slice(0, 450),
    address: addressMetadata(checked.address),
    ...encoded,
  };

  if (shippingChoice) metadata.shippingChoice = shippingChoice;

  const origin = await requestOrigin();
  const shippingDescription =
    shippingChoice === "wait-together"
      ? "Wait and ship together. Contiguous United States"
      : shippingChoice === "ship-as-available"
        ? "Ship as available. Contiguous United States"
        : "Contiguous United States";

  let session: Stripe.Checkout.Session;

  try {
    session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      success_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?checkout=canceled`,
      line_items: [
        ...lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: "usd" as const,
            unit_amount: line.unitPriceCents,
            product_data: {
              name: `${line.artworkTitle} — ${formatPrintChoice(line.printType, line.size)}`.slice(0, 200),
              description: lineDescription(line).slice(0, 500),
            },
          },
        })),
        {
          quantity: 1,
          price_data: {
            currency: "usd" as const,
            unit_amount: plan.shippingCents,
            product_data: {
              name: "Shipping",
              description: shippingDescription,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        metadata: { orderId: order.id },
        shipping: stripeShipping(checked.address),
      },
    });
  } catch (error) {
    if (error instanceof AdminError) throw error;
    console.error(error instanceof Error ? error.message : "Stripe checkout failed");
    throw new AdminError("Checkout could not start. Try again.");
  }

  if (!session.url || !session.id.startsWith("cs_test_")) {
    throw new AdminError("Checkout could not start. Try again.");
  }

  order.stripeSessionId = session.id;
  await savePendingOrder(order);
  return session.url;
}

function addressMetadata(address: DeliveryAddress) {
  const encoded = JSON.stringify(address);
  if (encoded.length > 500) throw new AdminError("Enter a shorter delivery address.");
  return encoded;
}

function stripeShipping(address: DeliveryAddress) {
  return {
    name: address.name,
    address: {
      line1: address.line1,
      line2: address.line2 || undefined,
      city: address.city,
      state: address.state,
      postal_code: address.postalCode,
      country: "US" as const,
    },
  };
}

function lineDescription(line: OrderLine) {
  return [
    formatPrintChoice(line.printType, line.size),
    line.kind === "in-stock" && !line.shipWindow ? "Ready to ship" : "",
    line.shipWindow ? `Estimated shipping: ${line.shipWindow}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

function summarizeLines(lines: OrderLine[]) {
  const titles = [...new Set(lines.map((line) => line.artworkTitle))];

  return {
    artworkSlug: lines[0]?.artworkSlug ?? "",
    artworkTitle: titles.length === 1 ? titles[0] : "Print order",
    size: lines.length === 1 ? lines[0].size : "Multiple sizes",
    unitPriceCents:
      lines.length === 1
        ? lines[0].unitPriceCents
        : lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
    shipWindow: [...new Set(lines.map((line) => line.shipWindow).filter(Boolean))]
      .join(" · ")
      .slice(0, 450),
  };
}

function sessionCartOrder(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
): PrintOrder | null {
  const shipments = shipmentsFromMetadata(metadata);
  const address = addressFromMetadata(metadata.address);
  const shippingCents = Number(metadata.shippingCents);
  const unitPriceCents = Number(metadata.unitPriceCents);

  if (
    !shipments ||
    !address ||
    !metadata.orderId ||
    !session.id.startsWith("cs_test_") ||
    !Number.isInteger(shippingCents) ||
    !Number.isInteger(unitPriceCents)
  ) {
    return null;
  }

  const lines = shipments.flatMap((shipment) => shipment.lines);
  const summary = summarizeLines(lines);
  const choice = metadata.shippingChoice;
  const order: PrintOrder = {
    id: metadata.orderId,
    stripeSessionId: session.id,
    status: "pending",
    createdAt: new Date().toISOString(),
    artworkSlug: metadata.artworkSlug || summary.artworkSlug,
    artworkTitle: metadata.artworkTitle || summary.artworkTitle,
    size: metadata.size || summary.size,
    unitPriceCents,
    shippingCents,
    shipWindow: metadata.shipWindow ?? summary.shipWindow,
    shippingAddress: address,
    eventIds: [],
    shipments,
  };

  if (choice === "ship-as-available" || choice === "wait-together") {
    order.shippingChoice = choice;
  }

  return order;
}

function addressFromMetadata(value: string | undefined): DeliveryAddress | null {
  if (!value) return null;

  let addressJson: unknown;

  try {
    addressJson = JSON.parse(value);
  } catch {
    return null;
  }

  const checked = validateContiguousAddress({
    name: String((addressJson as { name?: unknown }).name ?? ""),
    line1: String((addressJson as { line1?: unknown }).line1 ?? ""),
    line2: String((addressJson as { line2?: unknown }).line2 ?? ""),
    city: String((addressJson as { city?: unknown }).city ?? ""),
    state: String((addressJson as { state?: unknown }).state ?? ""),
    postalCode: String((addressJson as { postalCode?: unknown }).postalCode ?? ""),
  });

  return checked.ok ? checked.address : null;
}

function sessionOrder(session: Stripe.Checkout.Session): PrintOrder | null {
  const metadata = session.metadata ?? {};

  if (metadata.ship0) return sessionCartOrder(session, metadata);

  if (!metadata.orderId || !metadata.artworkTitle || !metadata.size || !metadata.address) {
    return null;
  }

  let addressJson: unknown;

  try {
    addressJson = JSON.parse(metadata.address);
  } catch {
    return null;
  }

  const checked = validateContiguousAddress({
    name: String((addressJson as { name?: unknown }).name ?? ""),
    line1: String((addressJson as { line1?: unknown }).line1 ?? ""),
    line2: String((addressJson as { line2?: unknown }).line2 ?? ""),
    city: String((addressJson as { city?: unknown }).city ?? ""),
    state: String((addressJson as { state?: unknown }).state ?? ""),
    postalCode: String((addressJson as { postalCode?: unknown }).postalCode ?? ""),
  });

  if (!checked.ok || !session.id.startsWith("cs_test_")) return null;

  const unitPriceCents = Number(metadata.unitPriceCents);
  const shippingCents = Number(metadata.shippingCents);

  if (!Number.isInteger(unitPriceCents) || !Number.isInteger(shippingCents)) return null;

  return {
    id: metadata.orderId,
    stripeSessionId: session.id,
    status: "pending",
    createdAt: new Date().toISOString(),
    artworkSlug: metadata.artworkSlug ?? "",
    artworkTitle: metadata.artworkTitle,
    size: metadata.size,
    unitPriceCents,
    shippingCents,
    shipWindow: metadata.shipWindow ?? "",
    shippingAddress: checked.address,
    eventIds: [],
  };
}

export async function handleStripeEvent(event: Stripe.Event) {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded" &&
    event.type !== "checkout.session.async_payment_failed" &&
    event.type !== "checkout.session.expired"
  ) {
    return;
  }

  const session = event.data.object;
  if (session.object !== "checkout.session" || !session.id.startsWith("cs_test_")) return;

  const existing = await getOrderBySession(session.id);
  const fallback = existing ?? sessionOrder(session);
  if (!fallback) return;

  const at = new Date().toISOString();
  const email = session.customer_details?.email || undefined;

  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    await recordOrderEvent(fallback, {
      eventId: event.id,
      next: event.type === "checkout.session.expired" ? "expired" : "canceled",
      at,
    });
    return;
  }

  if (session.payment_status !== "paid") return;

  await recordOrderEvent(fallback, {
    eventId: event.id,
    next: "paid",
    at,
    email,
  });
}
