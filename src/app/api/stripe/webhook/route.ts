import { stripeClient, stripeWebhookSecret } from "@/lib/stripe-server";
import { handleStripeEvent } from "@/lib/print-checkout";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) return new Response("Missing Stripe signature", { status: 400 });

  const payload = await request.text();
  let event;

  try {
    event = stripeClient().webhooks.constructEvent(payload, signature, stripeWebhookSecret());
  } catch {
    return new Response("Invalid Stripe signature", { status: 400 });
  }

  if (event.livemode) return new Response("Live mode is not enabled", { status: 400 });

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Stripe webhook failed");
    return new Response("Webhook failed", { status: 500 });
  }

  return new Response("ok");
}
