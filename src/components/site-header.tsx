import Link from "next/link";
import { Suspense } from "react";
import { CartLink } from "@/components/cart-link";
import { NavLinks, SiteNav } from "@/components/site-nav";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-x-4">
          <Link
            href="/"
            className="font-serif text-lg leading-none tracking-tight"
          >
            Josh Yurche
          </Link>
          <Suspense
            fallback={
              <Link href="/cart" className="text-sm">
                Cart
              </Link>
            }
          >
            <CartLink />
          </Suspense>
        </div>
        <Suspense fallback={<NavLinks pathname={null} />}>
          <SiteNav />
        </Suspense>
      </div>
    </header>
  );
}
