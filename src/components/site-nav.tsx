"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNav } from "@/lib/navigation";

export function SiteNav() {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} />;
}

export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Primary"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
    >
      {primaryNav.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "underline underline-offset-4"
                : "underline-offset-4 hover:underline"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function isCurrent(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/gallery") {
    return pathname === "/gallery" || pathname.startsWith("/artwork/");
  }
  return pathname === href;
}
