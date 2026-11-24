import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { saveArtwork } from "@/app/admin/actions";
import { ArtworkForm } from "@/components/admin/artwork-form";
import { DeleteArtwork } from "@/components/admin/delete-artwork";
import { PhotoManager } from "@/components/admin/photo-manager";
import { PrintManager } from "@/components/admin/print-manager";
import { PageTitle } from "@/components/page-shell";
import { requireAdmin } from "@/lib/admin-auth";
import { getStorageMode, readCatalog } from "@/lib/catalog-store";

type EditPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    saved?: string | string[];
    uploadError?: string | string[];
    printError?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Edit artwork",
};

function one(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  return text?.slice(0, 180);
}

export default function EditArtworkPage(props: EditPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading painting…</p>}>
      <Editor {...props} />
    </Suspense>
  );
}

async function Editor({ params, searchParams }: EditPageProps) {
  await requireAdmin();
  const { slug } = await params;
  const query = await searchParams;
  const catalog = await readCatalog();
  const artwork = catalog.artworks.find((item) => item.slug === slug);

  if (!artwork) notFound();

  const saved = one(query.saved) === "1";
  const uploadError = one(query.uploadError);
  const printError = one(query.printError);

  return (
    <>
      <PageTitle>{artwork.title}</PageTitle>
      <p className="mt-3 text-sm">
        <Link
          href={`/artwork/${artwork.slug}`}
          className="underline underline-offset-4"
        >
          View on the site
        </Link>
      </p>
      {saved ? (
        <p className="mt-4 text-sm" role="status">
          Saved.
        </p>
      ) : null}
      <div className="mt-8">
        <ArtworkForm
          action={saveArtwork.bind(null, artwork.slug)}
          artwork={artwork}
          featured={catalog.featuredSlug === artwork.slug}
          submitLabel="Save details"
        />
      </div>
      <div className="mt-12">
        <PrintManager
          slug={artwork.slug}
          prints={artwork.prints ?? []}
          error={printError}
        />
      </div>
      <div className="mt-12">
        <PhotoManager
          slug={artwork.slug}
          images={artwork.images}
          widthInches={artwork.widthInches}
          heightInches={artwork.heightInches}
          mode={getStorageMode() === "cloud" ? "blob" : "local"}
          uploadError={uploadError}
        />
      </div>
      <DeleteArtwork slug={artwork.slug} title={artwork.title} />
    </>
  );
}
