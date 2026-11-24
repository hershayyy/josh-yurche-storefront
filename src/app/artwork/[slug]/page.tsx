import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArtworkCarousel } from "@/components/artwork-carousel";
import { PageShell, PageTitle } from "@/components/page-shell";
import { PrintPreorder } from "@/components/print-preorder";
import {
  availablePrints,
  formatDimensions,
  hasPrintOptions,
  offeringLabels,
  printOfferKind,
  seedCatalog,
  showsPrintSection,
  statusLabel,
  type Artwork,
} from "@/lib/artwork";
import { getArtwork } from "@/lib/catalog";
import { readCatalog } from "@/lib/catalog-store";

type ArtworkRouteProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkout?: string | string[] }>;
};

export async function generateStaticParams() {
  try {
    const catalog = await readCatalog();

    if (catalog.artworks.length > 0) {
      return catalog.artworks.map((artwork) => ({ slug: artwork.slug }));
    }
  } catch {
    // The seed still gives the build a real artwork route.
  }

  return seedCatalog().artworks.map((artwork) => ({ slug: artwork.slug }));
}

export async function generateMetadata({
  params,
}: ArtworkRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const artwork = await getArtwork(slug);

  if (!artwork) {
    return { title: "Artwork" };
  }

  return {
    title: artwork.title,
    description: `${artwork.title}, a ${formatDimensions(artwork, "long")} painting by Josh Yurche. ${statusLabel(artwork)}.`,
  };
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function Page({ params, searchParams }: ArtworkRouteProps) {
  return (
    <Suspense fallback={<ArtworkFallback />}>
      <ArtworkDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ArtworkDetail({ params, searchParams }: ArtworkRouteProps) {
  const { slug } = await params;
  const query = await searchParams;
  const artwork = await getArtwork(slug);

  if (!artwork) {
    notFound();
  }

  const printsForSale = availablePrints(artwork);
  const checkoutCanceled = one(query.checkout) === "canceled";

  return (
    <PageShell>
      <article className="grid items-start gap-8 md:grid-cols-2 md:gap-16">
        <ArtworkCarousel
          images={artwork.images}
          label={artwork.title}
          widthInches={artwork.widthInches}
          heightInches={artwork.heightInches}
          preloadLead
        />
        <div className="md:max-w-md">
          <header>
            <PageTitle>{artwork.title}</PageTitle>
            <p className="mt-3 text-sm text-muted">{statusLabel(artwork)}</p>
            {offeringLabels(artwork).map((label) => (
              <p key={label} className="mt-1 text-sm">
                {label}
              </p>
            ))}
            {showsPrintSection(artwork) && !hasPrintOptions(artwork) ? (
              <p
                id={artwork.estimatedPrintShipping ? undefined : "prints"}
                className="mt-2 scroll-mt-16 text-sm leading-6"
              >
                Print pre-orders coming soon.
              </p>
            ) : null}
          </header>
          <OriginalDetails artwork={artwork} />
          {showsPrintSection(artwork) && printsForSale.length > 0 ? (
            <PrintPreorder
              slug={artwork.slug}
              prints={printsForSale}
              shipWindow={artwork.estimatedPrintShipping ?? ""}
              canceled={checkoutCanceled}
              offerKind={printOfferKind(artwork) ?? "preorder"}
            />
          ) : null}
          {showsPrintSection(artwork) &&
          printsForSale.length === 0 &&
          artwork.estimatedPrintShipping ? (
            <PrintDetails artwork={artwork} />
          ) : null}
          <p className="mt-12">
            <Link href="/gallery" className="text-sm underline underline-offset-4">
              Gallery
            </Link>
          </p>
        </div>
      </article>
    </PageShell>
  );
}

function OriginalDetails({ artwork }: { artwork: Artwork }) {
  return (
    <section className="mt-10" aria-labelledby="original-heading">
      <h2
        id="original-heading"
        className="text-xs uppercase tracking-[0.16em] text-muted"
      >
        Original
      </h2>
      <dl className="mt-4 border-t border-line text-sm">
        <div className="flex items-baseline justify-between gap-6 border-b border-line py-3">
          <dt className="text-muted">Dimensions</dt>
          <dd>{formatDimensions(artwork, "long")}</dd>
        </div>
        {artwork.estimatedCompletion ? (
          <div className="flex items-baseline justify-between gap-6 border-b border-line py-3">
            <dt className="text-muted">Estimated completion</dt>
            <dd>{artwork.estimatedCompletion}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function PrintDetails({ artwork }: { artwork: Artwork }) {
  if (!artwork.estimatedPrintShipping) return null;

  return (
    <section id="prints" className="mt-10 scroll-mt-16" aria-labelledby="prints-heading">
      <h2
        id="prints-heading"
        className="text-xs uppercase tracking-[0.16em] text-muted"
      >
        Prints
      </h2>
      <dl className="mt-4 border-t border-line text-sm">
        <div className="grid gap-1 border-b border-line py-3">
          <dt className="text-muted">Estimated shipping</dt>
          <dd>{artwork.estimatedPrintShipping}</dd>
        </div>
      </dl>
    </section>
  );
}

function ArtworkFallback() {
  return (
    <PageShell>
      <p className="sr-only">Loading artwork</p>
      <div className="artwork-stage" aria-hidden="true">
        <div className="aspect-[3/4] w-full border border-line bg-mat" />
      </div>
    </PageShell>
  );
}
