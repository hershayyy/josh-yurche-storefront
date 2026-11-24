import type { Metadata } from "next";
import { ArtworkMedia } from "@/components/artwork-media";
import { PageShell, PageTitle } from "@/components/page-shell";
import { artistBiography, artistIntro, artistPortrait } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: artistIntro,
};

export default function AboutPage() {
  const biography = artistBiography.trim();

  return (
    <PageShell narrow>
      <PageTitle>About</PageTitle>
      <p className="mt-4 text-base leading-7">{artistIntro}</p>
      <figure className="mt-8 max-w-sm">
        <div className="relative aspect-[4/5] overflow-hidden border border-line bg-mat">
          <ArtworkMedia
            src={artistPortrait?.src}
            alt={artistPortrait?.alt ?? "Josh Yurche painting"}
            placeholder="Photo of Josh painting"
            sizes="(max-width: 768px) 80vw, 384px"
          />
        </div>
      </figure>
      <section className="mt-12 border-t border-line pt-8" aria-labelledby="biography-heading">
        <h2 id="biography-heading" className="font-serif text-2xl tracking-tight">
          Biography
        </h2>
        {biography ? (
          <div className="mt-4 whitespace-pre-wrap text-base leading-7">
            {biography}
          </div>
        ) : (
          <p className="mt-4 text-base leading-7 text-muted">
            This space is reserved for Josh’s biography.
          </p>
        )}
      </section>
    </PageShell>
  );
}
