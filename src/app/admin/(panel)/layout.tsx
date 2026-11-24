import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/admin/actions";
import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/admin-auth";
import { getStorageMode, type StorageMode } from "@/lib/catalog-store";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <PageShell narrow>
          <p className="text-sm text-muted">Loading admin…</p>
        </PageShell>
      }
    >
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}

async function AdminFrame({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <PageShell narrow>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-x-4">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Artwork
          </Link>
          <Link
            href="/admin/orders"
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Paid orders
          </Link>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center text-sm underline"
          >
            Sign out
          </button>
        </form>
      </div>
      <StorageNote mode={getStorageMode()} />
      <div className="mt-8">{children}</div>
    </PageShell>
  );
}

function StorageNote({ mode }: { mode: StorageMode }) {
  if (mode === "cloud") {
    return (
      <p className="mt-4 text-sm leading-6 text-muted">
        Photos are stored in Vercel Blob. Artwork details are stored in Postgres.
      </p>
    );
  }

  if (mode === "local") {
    return (
      <p className="mt-4 text-sm leading-6 text-muted">
        Saving on this computer. Connect Vercel Blob and Postgres before deploying.
      </p>
    );
  }

  return (
    <p className="mt-4 text-sm leading-6" role="alert">
      Set POSTGRES_URL and BLOB_READ_WRITE_TOKEN before editing artwork on Vercel.
    </p>
  );
}
