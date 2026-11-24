import Link from "next/link";
import { Suspense } from "react";
import { featureArtwork } from "@/app/admin/actions";
import { PageTitle } from "@/components/page-shell";
import { availabilitySummary, formatDimensions, statusLabel } from "@/lib/artwork";
import { requireAdmin } from "@/lib/admin-auth";
import { readCatalog } from "@/lib/catalog-store";

export default function AdminHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading paintings…</p>}>
      <PaintingList />
    </Suspense>
  );
}

async function PaintingList() {
  await requireAdmin();
  const catalog = await readCatalog();

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <PageTitle>Paintings</PageTitle>
        <Link
          href="/admin/artwork/new"
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          Add artwork
        </Link>
      </div>
      {catalog.artworks.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No paintings yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {catalog.artworks.map((artwork) => {
            const featured = artwork.slug === catalog.featuredSlug;
            const image = artwork.images[0];

            return (
              <li key={artwork.slug} className="py-5">
                <Link
                  href={`/admin/artwork/${artwork.slug}`}
                  className="flex min-h-11 gap-4"
                >
                  <span
                    className="relative w-20 shrink-0 overflow-hidden border border-line bg-mat"
                    style={{
                      aspectRatio: `${artwork.widthInches} / ${artwork.heightInches}`,
                    }}
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image.src}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif text-xl tracking-tight">
                      {artwork.title}
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      {statusLabel(artwork)} · {formatDimensions(artwork)}
                    </span>
                    <span className="mt-1 block text-sm">
                      {availabilitySummary(artwork)}
                      {featured ? " · On the homepage" : ""}
                    </span>
                  </span>
                </Link>
                {featured ? null : (
                  <form action={featureArtwork} className="mt-3">
                    <input type="hidden" name="slug" value={artwork.slug} />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 w-full items-center justify-center border border-foreground px-4 text-sm sm:w-auto"
                    >
                      Feature on homepage
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
