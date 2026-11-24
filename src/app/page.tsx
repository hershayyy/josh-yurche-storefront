import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArtworkCard } from "@/components/artwork-card";
import { FeaturedPainting } from "@/components/featured-painting";
import { PageShell } from "@/components/page-shell";
import { formatDimensions, statusLabel } from "@/lib/artwork";
import { getArtworks, getFeaturedArtwork } from "@/lib/catalog";
import { artistIntro } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const featured = await getFeaturedArtwork();

  if (!featured) {
    return { description: "Paintings by Josh Yurche." };
  }

  return {
    description: `${featured.title}, a ${formatDimensions(featured, "long")} painting by Josh Yurche. ${statusLabel(featured)}.`,
  };
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-sm text-muted">Loading gallery…</p>
        </PageShell>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [featured, artworks] = await Promise.all([
    getFeaturedArtwork(),
    getArtworks(),
  ]);
  const preview = artworks.slice(0, 4);

  return (
    <PageShell>
      {featured ? (
        <FeaturedPainting artwork={featured} />
      ) : (
        <p className="text-sm text-muted">No featured painting yet.</p>
      )}

      <section className="mt-20 sm:mt-28" aria-labelledby="gallery-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="gallery-heading"
            className="font-serif text-2xl tracking-tight"
          >
            Gallery
          </h2>
          <Link href="/gallery" className="text-sm underline underline-offset-4">
            View gallery
          </Link>
        </div>
        {preview.length > 0 ? (
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:gap-x-8">
            {preview.map((artwork) => (
              <li key={artwork.slug}>
                <ArtworkCard artwork={artwork} heading="h3" compact />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted">No paintings listed yet.</p>
        )}
      </section>

      <section className="mt-20 max-w-xl sm:mt-28" aria-labelledby="about-heading">
        <h2 id="about-heading" className="font-serif text-2xl tracking-tight">
          About
        </h2>
        <p className="mt-4 text-base leading-7">{artistIntro}</p>
        <Link
          href="/about"
          className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          About the artist
        </Link>
      </section>
    </PageShell>
  );
}
