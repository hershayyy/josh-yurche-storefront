"use client";

import { deleteArtwork } from "@/app/admin/actions";

export function DeleteArtwork({ slug, title }: { slug: string; title: string }) {
  return (
    <form
      action={deleteArtwork}
      className="mt-12 border-t border-line pt-6"
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${title} from the gallery?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <button type="submit" className="inline-flex min-h-11 items-center text-sm underline">
        Remove from gallery
      </button>
    </form>
  );
}
