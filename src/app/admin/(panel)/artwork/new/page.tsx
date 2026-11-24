import type { Metadata } from "next";
import { Suspense } from "react";
import { createArtwork } from "@/app/admin/actions";
import { ArtworkForm } from "@/components/admin/artwork-form";
import { PageTitle } from "@/components/page-shell";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Add artwork",
};

export default function NewArtworkPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading form…</p>}>
      <NewArtwork />
    </Suspense>
  );
}

async function NewArtwork() {
  await requireAdmin();

  return (
    <>
      <PageTitle>Add artwork</PageTitle>
      <p className="mt-4 text-sm leading-6 text-muted">
        After this is saved, you can upload photos from your camera roll.
      </p>
      <div className="mt-8">
        <ArtworkForm action={createArtwork} submitLabel="Add artwork" />
      </div>
    </>
  );
}
