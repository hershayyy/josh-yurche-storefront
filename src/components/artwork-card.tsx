import Link from "next/link";
import { ArtworkMedia } from "@/components/artwork-media";
import {
  formatDimensions,
  leadImage,
  offeringLabels,
  statusLabel,
  type Artwork,
} from "@/lib/artwork";

export function ArtworkCard({
  artwork,
  heading = "h2",
  compact = false,
}: {
  artwork: Artwork;
  heading?: "h2" | "h3";
  compact?: boolean;
}) {
  const image = leadImage(artwork);
  const offerings = offeringLabels(artwork);
  const TitleTag = heading;

  return (
    <Link href={`/artwork/${artwork.slug}`} className="group block">
      <div
        className="relative overflow-hidden border border-line bg-mat"
        style={{
          aspectRatio: `${artwork.widthInches} / ${artwork.heightInches}`,
        }}
      >
        <ArtworkMedia
          src={image?.src}
          alt={image?.alt ?? `${artwork.title}, progress photo not yet added`}
          placeholder="Progress photo"
          sizes={
            compact
              ? "(max-width: 640px) 45vw, 240px"
              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
          }
        />
      </div>
      <TitleTag
        className={`mt-3 font-serif leading-tight tracking-tight group-hover:underline ${
          compact ? "text-base" : "text-xl"
        }`}
      >
        {artwork.title}
      </TitleTag>
      <p className={`mt-1 text-muted ${compact ? "text-xs leading-5" : "text-sm"}`}>
        {statusLabel(artwork)}
        <span aria-hidden="true"> · </span>
        <span className="sr-only">, </span>
        {formatDimensions(artwork)}
      </p>
      {offerings.map((label) => (
        <p key={label} className={compact ? "mt-1 text-xs" : "mt-1 text-sm"}>
          {label}
        </p>
      ))}
    </Link>
  );
}
