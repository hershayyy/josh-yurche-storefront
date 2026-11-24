import "server-only";
import Stripe from "stripe";
import { AdminError } from "@/lib/admin-error";

let client: Stripe | null = null;
let clientKey = "";

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";

  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
    throw new AdminError("Live Stripe keys are not enabled. Use a test secret key.");
  }

  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new AdminError("Set STRIPE_SECRET_KEY to a Stripe test secret key.");
  }

  if (!client || clientKey !== key) {
    client = new Stripe(key);
    clientKey = key;
  }

  return client;
}

export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

  if (!secret) {
    throw new Error("Set STRIPE_WEBHOOK_SECRET before accepting Stripe webhooks.");
  }

  return secret;
}
