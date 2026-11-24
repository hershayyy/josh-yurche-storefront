import Link from "next/link";
import { ArtworkCarousel } from "@/components/artwork-carousel";
import { PageTitle } from "@/components/page-shell";
import {
  formatDimensions,
  offeringLabels,
  showsPrintSection,
  statusLabel,
  type Artwork,
} from "@/lib/artwork";

export function FeaturedPainting({ artwork }: { artwork: Artwork }) {
  const offerings = offeringLabels(artwork);
  const prints = showsPrintSection(artwork);

  return (
    <section
      aria-labelledby="featured-title"
      className="grid items-start gap-6 md:grid-cols-2 md:gap-16"
    >
      <ArtworkCarousel
        images={artwork.images}
        label={artwork.title}
        widthInches={artwork.widthInches}
        heightInches={artwork.heightInches}
        preloadLead
      />
      <div className="md:max-w-md md:pt-2">
        <PageTitle id="featured-title">
          <Link
            href={`/artwork/${artwork.slug}`}
            className="underline-offset-4 hover:underline"
          >
            {artwork.title}
          </Link>
        </PageTitle>
        <p className="mt-3 text-sm leading-6 text-muted">
          {statusLabel(artwork)}
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, </span>
          {formatDimensions(artwork)}
          {offerings.map((label) => (
            <span key={label}>
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              {label}
            </span>
          ))}
        </p>
        <Link
          href={
            prints
              ? `/artwork/${artwork.slug}#prints`
              : `/artwork/${artwork.slug}`
          }
          className="mt-4 inline-flex min-h-11 w-full items-center text-sm sm:w-auto"
        >
          <span className="underline underline-offset-4">
            {prints ? "View print options" : "View artwork"}
          </span>
          <span aria-hidden="true" className="ml-2">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
