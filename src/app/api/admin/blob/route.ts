import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { isSlug } from "@/lib/artwork-mutations";
import { readCatalog } from "@/lib/catalog-store";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const slug = clientPayload ?? "";

        if (!isSlug(slug)) {
          throw new Error("Choose a painting before uploading.");
        }

        const catalog = await readCatalog();

        if (!catalog.artworks.some((artwork) => artwork.slug === slug)) {
          throw new Error("Choose a painting before uploading.");
        }

        return {
          addRandomSuffix: true,
          maximumSizeInBytes: 30 * 1024 * 1024,
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif",
            "image/heic-sequence",
            "image/heif-sequence",
            "application/octet-stream",
          ],
          tokenPayload: slug,
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
