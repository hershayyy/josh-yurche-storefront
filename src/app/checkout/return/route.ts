import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  CART_COOKIE,
  CART_MAX_AGE,
  cartReleaseUpdate,
  cookieOptions,
  purchasedLines,
  SETTLED_COOKIE,
} from "@/lib/cart-release";
import { getOrderBySession } from "@/lib/orders";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const destination = new URL("/checkout/confirmed", url);

  if (sessionId) destination.searchParams.set("session_id", sessionId);

  const response = NextResponse.redirect(destination);
  const order = sessionId.startsWith("cs_test_") ? await getOrderBySession(sessionId) : null;

  if (order?.status !== "paid") return response;

  const jar = await cookies();
  const update = cartReleaseUpdate({
    cartRaw: jar.get(CART_COOKIE)?.value,
    settledRaw: jar.get(SETTLED_COOKIE)?.value,
    purchased: purchasedLines(order),
    sessionId,
  });

  if (!update) return response;

  response.cookies.set(CART_COOKIE, update.cartValue, cookieOptions(update.cartMaxAge));
  response.cookies.set(SETTLED_COOKIE, update.settledValue, cookieOptions(CART_MAX_AGE));
  revalidatePath("/", "layout");
  return response;
}
