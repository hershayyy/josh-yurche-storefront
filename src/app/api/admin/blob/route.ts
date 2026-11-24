import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { isSlug } from "@/lib/artwork-mutations";
import { readCatalog } from "@/lib/catalog-store";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "application/octet-stream",
];

const MAX_BYTES = 30 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadPresignedBody;

  try {
    const result = await handleUploadPresigned({
      request,
      body,
      getSignedToken: async (pathname, clientPayload) => {
        const slug = clientPayload ?? "";

        if (!isSlug(slug)) {
          throw new Error("Choose a painting before uploading.");
        }

        const catalog = await readCatalog();

        if (!catalog.artworks.some((artwork) => artwork.slug === slug)) {
          throw new Error("Choose a painting before uploading.");
        }

        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
        });

        return {
          token,
          urlOptions: {
            addRandomSuffix: true,
            allowedContentTypes: ALLOWED_TYPES,
            maximumSizeInBytes: MAX_BYTES,
            tokenPayload: slug,
          },
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
