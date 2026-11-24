import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageShell, PageTitle } from "@/components/page-shell";
import { PrintCart } from "@/components/print-cart";
import { readCart, resolveCart } from "@/lib/cart";
import { quotePrintCart } from "@/lib/print-shipping";
import { packageRates, printShippingCents } from "@/lib/shipping-rate";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

const NOTICES = new Set([
  "Enter a quantity from 1 to 10.",
  "That print is no longer in the cart.",
  "The cart can hold 12 print sizes.",
]);

type CartPageProps = {
  searchParams: Promise<{ checkout?: string | string[]; notice?: string | string[] }>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function Page({ searchParams }: CartPageProps) {
  return (
    <Suspense
      fallback={
        <PageShell narrow>
          <PageTitle>Cart</PageTitle>
          <p className="mt-4 text-sm text-muted">Loading cart…</p>
        </PageShell>
      }
    >
      <CartDetails searchParams={searchParams} />
    </Suspense>
  );
}

async function CartDetails({ searchParams }: CartPageProps) {
  await connection();
  const query = await searchParams;
  const stored = await readCart();
  const resolved = await resolveCart(stored);
  const quote = quotePrintCart(resolved.lines, {
    singleCents: printShippingCents(),
    rates: packageRates(),
  });
  const notice = one(query.notice);
  const knownNotice = notice && NOTICES.has(notice) ? notice : null;

  return (
    <PageShell narrow>
      <PageTitle>Cart</PageTitle>
      <PrintCart
        lines={quote.lines}
        missing={resolved.missing}
        merchandiseCents={quote.merchandiseCents}
        mixed={quote.mixed}
        plans={quote.plans}
        canceled={one(query.checkout) === "canceled"}
        notice={knownNotice}
      />
    </PageShell>
  );
}
