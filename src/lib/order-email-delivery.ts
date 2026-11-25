import "server-only";
import { AdminError } from "@/lib/admin-error";
import {
  confirmationMessage,
  confirmationNoticeKey,
  emailFromAddress,
  emailRecipient,
  shipmentMessage,
  shipmentNoticeKey,
  type EmailMode,
} from "@/lib/order-email";
import { orderPackages } from "@/lib/order-packages";
import type { EmailNotice, PrintOrder } from "@/lib/order-status";
import { claimEmailNotice, getPaidOrder, settleEmailNotice } from "@/lib/orders";
import { packageRates } from "@/lib/shipping-rate";

const RESEND_URL = "https://api.resend.com/emails";

export async function sendConfirmationEmail(
  order: PrintOrder,
  mode: EmailMode,
  prepared?: { claim: string; attempt: number },
) {
  await sendNotice(
    order.id,
    confirmationNoticeKey(),
    mode,
    (current, preview) => confirmationMessage(current, preview),
    prepared,
  );
}

export async function sendShipmentEmail(
  order: PrintOrder,
  packageId: string,
  mode: EmailMode,
  prepared?: { claim: string; attempt: number },
) {
  await sendNotice(order.id, shipmentNoticeKey(packageId), mode, (current, preview) => {
    const item = orderPackages(current, packageRates()).find((pkg) => pkg.id === packageId);
    const tracking = current.packageTracking?.find((saved) => saved.packageId === packageId);

    if (!item || !tracking) {
      return { ok: false as const, error: "That package is not on this order." };
    }

    return shipmentMessage(current, item.lines, tracking.carrier, tracking.trackingNumber, preview);
  }, prepared);
}

export async function retryConfirmationEmail(orderId: string) {
  const order = await requirePaidOrder(orderId);
  await sendConfirmationEmail(order, "retry");
}

export async function retryShipmentEmail(orderId: string, packageId: string) {
  const order = await requirePaidOrder(orderId);
  await sendShipmentEmail(order, packageId, "retry");
}

async function requirePaidOrder(orderId: string) {
  const order = await getPaidOrder(orderId);
  if (!order) throw new AdminError("That paid order could not be found.");
  return order;
}

async function sendNotice(
  orderId: string,
  key: string,
  mode: EmailMode,
  build: (
    order: PrintOrder,
    preview: boolean,
  ) =>
    | { subject: string; text: string; html: string }
    | { ok: false; error: string },
  prepared?: { claim: string; attempt: number },
) {
  let claimed: { claim: string; attempt: number } | null = prepared ?? null;

  if (!claimed) {
    try {
      claimed = await claimEmailNotice(orderId, key, mode);
    } catch {
      console.error("Order email could not be recorded");
      return;
    }
  }

  if (!claimed) return;

  let outcome: { ok: true } | { ok: false; error: string; pending?: boolean };

  try {
    const order = await getPaidOrder(orderId);
    outcome = order
      ? await buildAndSend(order, claimed.attempt, key, build)
      : { ok: false, error: "That paid order could not be found." };
  } catch {
    outcome = { ok: false, error: "The email service could not be reached." };
  }

  const notice: EmailNotice = {
    status: outcome.ok ? "sent" : outcome.pending ? "sending" : "failed",
    at: new Date().toISOString(),
    attempt: claimed.attempt,
    claim: claimed.claim,
    ...(outcome.ok ? {} : { error: outcome.error }),
  };

  try {
    await settleEmailNotice(orderId, key, claimed.claim, notice);
  } catch {
    console.error("Order email result could not be saved");
  }
}

async function buildAndSend(
  order: PrintOrder,
  attempt: number,
  key: string,
  build: (
    order: PrintOrder,
    preview: boolean,
  ) =>
    | { subject: string; text: string; html: string }
    | { ok: false; error: string },
): Promise<{ ok: true } | { ok: false; error: string; pending?: boolean }> {
  const recipient = emailRecipient(order.email, {
    vercelEnv: process.env.VERCEL_ENV,
    previewInbox: process.env.PREVIEW_ORDER_EMAIL,
  });

  if (!recipient.ok) return recipient;

  const draft = build(order, recipient.preview);
  if ("ok" in draft) return draft;

  const from = emailFromAddress(process.env.ORDER_EMAIL_FROM);
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";

  if (!from || !apiKey.startsWith("re_")) {
    return {
      ok: false,
      error: "Set RESEND_API_KEY and ORDER_EMAIL_FROM before sending order email.",
    };
  }

  return postResend(apiKey, {
    from,
    to: recipient.to,
    subject: draft.subject,
    text: draft.text,
    html: draft.html,
    idempotencyKey: `${key.replaceAll(":", "-")}/${order.id}/${attempt}`,
  });
}

async function postResend(
  apiKey: string,
  message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    idempotencyKey: string;
  },
): Promise<{ ok: true } | { ok: false; error: string; pending?: boolean }> {
  let response: Response;

  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
  } catch {
    return { ok: false, error: "The email service could not be reached." };
  }

  if (response.status === 409) {
    return {
      ok: false,
      pending: true,
      error: "The email service is still processing the previous send.",
    };
  }

  if (!response.ok) {
    return { ok: false, error: await resendError(response) };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "The email service did not accept the message." };
  }

  const id = typeof payload === "object" && payload && "id" in payload ? payload.id : null;
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "The email service did not accept the message." };
  }

  return { ok: true };
}

async function resendError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload.message === "string" && payload.message.trim()) {
      return safeError(payload.message);
    }
  } catch {
    // The body was not JSON.
  }

  return "The email service did not accept the message.";
}

function safeError(message: string) {
  return message.replace(/re_[A-Za-z0-9_]+/g, "re_…").replace(/\s+/g, " ").trim().slice(0, 200);
}
