import type { Metadata } from "next";
import { Suspense } from "react";
import { ArtworkCard } from "@/components/artwork-card";
import { PageShell, PageTitle } from "@/components/page-shell";
import { getArtworks } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Paintings by Josh Yurche.",
};

export default function GalleryPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <PageTitle>Gallery</PageTitle>
          <p className="mt-4 text-sm text-muted">Loading paintings…</p>
        </PageShell>
      }
    >
      <GalleryContent />
    </Suspense>
  );
}

async function GalleryContent() {
  const artworks = await getArtworks();

  return (
    <PageShell>
      <PageTitle>Gallery</PageTitle>
      <p className="mt-4 max-w-prose text-base leading-7 text-muted">
        Paintings by Josh Yurche.
      </p>
      {artworks.length > 0 ? (
        <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {artworks.map((artwork) => (
            <li key={artwork.slug}>
              <ArtworkCard artwork={artwork} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-sm text-muted">No paintings listed yet.</p>
      )}
    </PageShell>
  );
}
