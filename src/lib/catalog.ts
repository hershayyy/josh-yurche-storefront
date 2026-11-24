import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import type { Artwork } from "@/lib/artwork";
import { readCatalog } from "@/lib/catalog-store";

export const getCatalog = cache(async () => {
  await connection();
  return readCatalog();
});

export async function getArtworks(): Promise<Artwork[]> {
  return (await getCatalog()).artworks;
}

export async function getArtwork(slug: string): Promise<Artwork | null> {
  const catalog = await getCatalog();
  return catalog.artworks.find((artwork) => artwork.slug === slug) ?? null;
}

export async function getFeaturedArtwork(): Promise<Artwork | null> {
  const catalog = await getCatalog();
  return (
    catalog.artworks.find((artwork) => artwork.slug === catalog.featuredSlug) ??
    null
  );
}
