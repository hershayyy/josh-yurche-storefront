"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  makeLeadPhoto,
  movePhoto,
  removePhoto,
} from "@/app/admin/actions";
import type { ArtworkImage } from "@/lib/artwork";

const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center border border-line px-3 text-sm disabled:opacity-40";
const primaryClass =
  "inline-flex min-h-11 w-full items-center justify-center bg-foreground px-4 text-sm text-background disabled:opacity-60";

function RemovePhotoForm({
  slug,
  index,
}: {
  slug: string;
  index: number;
}) {
  return (
    <form
      action={removePhoto}
      onSubmit={(event) => {
        if (!window.confirm("Remove this photo?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="index" value={index} />
      <button type="submit" className={buttonClass} aria-label={`Remove photo ${index + 1}`}>
        Remove
      </button>
    </form>
  );
}

function PhotoUpload({
  slug,
  mode,
}: {
  slug: string;
  mode: "local" | "blob";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (mode === "local") {
    return (
      <form
        action="/api/admin/uploads"
        method="post"
        encType="multipart/form-data"
        className="grid gap-3"
      >
        <input type="hidden" name="slug" value={slug} />
        <FileInput />
        <button type="submit" className={primaryClass}>
          Upload photos
        </button>
      </form>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("files");

        if (!(input instanceof HTMLInputElement) || !input.files?.length) {
          setError("Choose at least one photo.");
          return;
        }

        setPending(true);
        setError(null);

        try {
          const { upload } = await import("@vercel/blob/client");

          for (const file of [...input.files]) {
            const blob = await upload(file.name, file, {
              access: "public",
              handleUploadUrl: "/api/admin/blob",
              clientPayload: slug,
            });
            const response = await fetch("/api/admin/blob/finish", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ slug, url: blob.url }),
            });

            if (!response.ok) {
              const body = (await response.json().catch(() => null)) as {
                error?: string;
              } | null;
              throw new Error(body?.error || "Could not save that photo.");
            }
          }

          event.currentTarget.reset();
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not upload that photo.");
        } finally {
          setPending(false);
        }
      }}
    >
      <FileInput />
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Uploading…" : "Upload photos"}
      </button>
    </form>
  );
}

function FileInput() {
  return (
    <input
      type="file"
      name="files"
      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
      multiple
      className="block w-full text-base file:mr-3 file:inline-flex file:min-h-11 file:items-center file:border file:border-foreground file:bg-background file:px-4"
    />
  );
}

export function PhotoManager({
  slug,
  images,
  widthInches,
  heightInches,
  mode,
  uploadError,
}: {
  slug: string;
  images: ArtworkImage[];
  widthInches: number;
  heightInches: number;
  mode: "local" | "blob";
  uploadError?: string;
}) {
  return (
    <section id="photos" className="scroll-mt-6">
      <h2 className="font-serif text-2xl tracking-tight">Photos</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        The first photo is the lead. Upload from your camera roll, then reorder
        or choose a different lead. The full painting is kept in the frame.
      </p>
      {uploadError ? (
        <p role="alert" className="mt-3 text-sm">
          {uploadError}
        </p>
      ) : null}
      {images.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No photos yet.</p>
      ) : (
        <ul className="mt-5 grid gap-6">
          {images.map((image, index) => (
            <li key={`${image.src}-${index}`} className="border border-line p-3">
              <div
                className="relative w-full max-w-xs overflow-hidden border border-line bg-mat"
                style={{ aspectRatio: `${widthInches} / ${heightInches}` }}
              >
                {/* Admin thumbs use the stored URL directly, including Blob URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.src}
                  alt={image.alt}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
              <p className="mt-3 text-sm text-muted">
                {index === 0 ? "Lead" : `Photo ${index + 1}`}
                <span className="sr-only"> of {images.length}</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <form action={movePhoto}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="index" value={index} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    className={buttonClass}
                    disabled={index === 0}
                    aria-label={`Move photo ${index + 1} earlier`}
                  >
                    Move up
                  </button>
                </form>
                <form action={movePhoto}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="index" value={index} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    className={buttonClass}
                    disabled={index === images.length - 1}
                    aria-label={`Move photo ${index + 1} later`}
                  >
                    Move down
                  </button>
                </form>
                <form action={makeLeadPhoto}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="index" value={index} />
                  <button
                    type="submit"
                    className={buttonClass}
                    disabled={index === 0}
                    aria-label={`Make photo ${index + 1} the lead`}
                  >
                    Make lead
                  </button>
                </form>
                <RemovePhotoForm slug={slug} index={index} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <PhotoUpload slug={slug} mode={mode} />
      </div>
    </section>
  );
}
