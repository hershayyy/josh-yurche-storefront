import { randomUUID } from "node:crypto";
import { formatPrice } from "@/lib/artwork";
import type { EmailNotice, OrderLine, PrintOrder } from "@/lib/order-status";
import { formatPrintChoice } from "@/lib/print-type";

const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const FROM_ADDRESS = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const FROM_NAMED = /^[^<>\n]{1,80}\s+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/;
const STALE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 20;

export type EmailMode = "auto" | "retry";

export function confirmationNoticeKey() {
  return "confirmation";
}

export function shipmentNoticeKey(packageId: string) {
  return `package:${packageId}`;
}

export function emailDeliveryProblem(
  notices: Record<string, EmailNotice> | undefined,
): "failed" | "sending" | null {
  const values = Object.values(notices ?? {});
  if (values.some((notice) => notice.status === "failed")) return "failed";
  if (values.some((notice) => notice.status === "sending")) return "sending";
  return null;
}

/**
 * The first send claims a missing notice. A retry claims a failed notice and
 * uses a new attempt. A send still marked sending can be claimed again after
 * five minutes, or immediately from Admin, and keeps its attempt so the email
 * service sees the same idempotency key.
 */
export function applyEmailClaim(
  notices: Record<string, EmailNotice> | undefined,
  key: string,
  mode: EmailMode,
  now: string,
  claim: string,
): { notices: Record<string, EmailNotice>; attempt: number } | null {
  const current = notices?.[key];
  const nowMs = Date.parse(now);
  let attempt = 1;

  if (current?.status === "sent") return null;

  if (current?.status === "failed") {
    if (mode !== "retry" || current.attempt >= MAX_ATTEMPTS) return null;
    attempt = current.attempt + 1;
  } else if (current?.status === "sending") {
    const stale = Number.isFinite(nowMs) && nowMs - Date.parse(current.at) > STALE_MS;
    if (mode === "auto" && !stale) return null;
    if (mode !== "auto" && mode !== "retry") return null;
    attempt = current.attempt;
  } else if (current || mode !== "auto") {
    return null;
  }

  return {
    attempt,
    notices: {
      ...notices,
      [key]: { status: "sending", at: now, attempt, claim },
    },
  };
}

export function beginEmailClaim(
  notices: Record<string, EmailNotice> | undefined,
  key: string,
  mode: EmailMode,
  now: string,
) {
  const claim = randomUUID();
  const next = applyEmailClaim(notices, key, mode, now, claim);
  if (!next) return null;
  return { notices: next.notices, claim, attempt: next.attempt };
}

export function orderEmailLines(order: PrintOrder): OrderLine[] {
  if (order.shipments && order.shipments.length > 0) {
    return order.shipments.flatMap((shipment) => shipment.lines);
  }

  return [
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
  ];
}

export function orderTotalCents(order: PrintOrder) {
  const merchandise =
    order.shipments && order.shipments.length > 0
      ? order.shipments.reduce(
          (sum, shipment) =>
            sum +
            shipment.lines.reduce(
              (lineSum, line) => lineSum + line.unitPriceCents * line.quantity,
              0,
            ),
          0,
        )
      : order.unitPriceCents;

  return merchandise + order.shippingCents;
}

export function estimatedShipWindows(order: PrintOrder) {
  const windows = [
    ...new Set(
      orderEmailLines(order)
        .map((line) => line.shipWindow.trim())
        .filter(Boolean),
    ),
  ];

  if (windows.length > 0) return windows;
  if (order.shipWindow.trim()) return [order.shipWindow.trim()];
  return ["Ready to ship"];
}

export function emailRecipient(
  checkoutEmail: string | undefined,
  env: { vercelEnv?: string; previewInbox?: string },
): { ok: true; to: string; preview: boolean } | { ok: false; error: string } {
  if (env.vercelEnv === "preview") {
    const inbox = env.previewInbox?.trim() ?? "";
    if (!isEmail(inbox)) {
      return {
        ok: false,
        error: "Set PREVIEW_ORDER_EMAIL to the inbox that should receive preview order email.",
      };
    }
    return { ok: true, to: inbox, preview: true };
  }

  const to = checkoutEmail?.trim() ?? "";
  if (!isEmail(to)) return { ok: false, error: "This order has no customer email." };
  return { ok: true, to, preview: false };
}

export function emailFromAddress(value: string | undefined) {
  const from = value?.trim().replace(/\s+/g, " ") ?? "";
  if (FROM_ADDRESS.test(from) || FROM_NAMED.test(from)) return from;
  return null;
}

export type OrderEmailMessage = {
  subject: string;
  text: string;
  html: string;
};

export function confirmationMessage(order: PrintOrder, preview: boolean): OrderEmailMessage {
  const lines = orderEmailLines(order).map(describeLine);
  const sections = [
    "Your print order is confirmed.",
    block("Order number", [order.id]),
    block("Prints", lines.flat()),
    block("Total", [formatPrice(orderTotalCents(order) / 100)]),
    block("Estimated ship window", estimatedShipWindows(order)),
  ];

  return message("Your order is confirmed", sections, preview);
}

export function shipmentMessage(
  order: PrintOrder,
  lines: OrderLine[],
  carrier: string,
  trackingNumber: string,
  preview: boolean,
): OrderEmailMessage {
  const sections = [
    "A package from your order has shipped.",
    block("Order number", [order.id]),
    block("Prints", lines.flatMap(describeLine)),
    block("Carrier", [carrier]),
    block("Tracking number", [trackingNumber]),
  ];

  return message("A package from your order has shipped", sections, preview);
}

function describeLine(line: OrderLine) {
  return [
    line.artworkTitle,
    formatPrintChoice(line.printType, line.size),
    `Quantity ${line.quantity}`,
  ];
}

function message(subject: string, sections: string[], preview: boolean): OrderEmailMessage {
  const body = [
    ...(preview ? ["Preview test. This message was sent to the configured preview inbox."] : []),
    ...sections,
  ];
  const text = body.join("\n\n");

  return {
    subject: preview ? `[Preview] ${subject}` : subject,
    text,
    html: body
      .map((section) => `<p>${escapeHtml(section).replaceAll("\n", "<br>")}</p>`)
      .join(""),
  };
}

function block(label: string, lines: string[]) {
  return [label, ...lines].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isEmail(value: string) {
  return value.length <= 254 && EMAIL.test(value);
}
