import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageShell, PageTitle } from "@/components/page-shell";
import {
  parseSettledSessions,
  purchasedLines,
  SETTLED_COOKIE,
} from "@/lib/cart-release";
import { getOrderBySession } from "@/lib/orders";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

type ConfirmedPageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function CheckoutConfirmedPage({ searchParams }: ConfirmedPageProps) {
  return (
    <Suspense
      fallback={
        <PageShell narrow>
          <p className="text-sm text-muted">Checking payment…</p>
        </PageShell>
      }
    >
      <ConfirmedDetails searchParams={searchParams} />
    </Suspense>
  );
}

async function ConfirmedDetails({ searchParams }: ConfirmedPageProps) {
  await connection();
  const sessionId = one((await searchParams).session_id) ?? "";
  const order = sessionId.startsWith("cs_test_") ? await getOrderBySession(sessionId) : null;
  const settled = parseSettledSessions((await cookies()).get(SETTLED_COOKIE)?.value);
  const purchased = order ? purchasedLines(order) : [];

  if (order?.status === "paid" && purchased.length > 0 && !settled.includes(sessionId)) {
    redirect(`/checkout/return?session_id=${encodeURIComponent(sessionId)}`);
  }

  if (order?.status === "paid") {
    return (
      <PageShell narrow>
        <PageTitle>Order confirmed</PageTitle>
        <p className="mt-4 text-sm leading-6">
          Order number <span className="break-all">{order.id}</span>
        </p>
        <Link
          href="/gallery"
          className="mt-6 inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Continue shopping
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell narrow>
      <PageTitle>Order</PageTitle>
      <p className="mt-4 text-sm leading-6" role="status">
        {order?.status === "pending"
          ? "Confirming your payment…"
          : order
            ? "This payment was not completed."
            : "We could not find that checkout."}
      </p>
    </PageShell>
  );
}
