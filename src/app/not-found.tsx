import Link from "next/link";
import { PageShell, PageTitle } from "@/components/page-shell";

export default function NotFound() {
  return (
    <PageShell narrow>
      <PageTitle>Page not found</PageTitle>
      <p className="mt-4 text-base leading-7 text-muted">
        That page isn’t in the gallery.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        Back home
      </Link>
    </PageShell>
  );
}
