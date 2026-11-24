import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { AdminError } from "@/lib/admin-error";
import { addArtworkFiles, isSlug } from "@/lib/artwork-mutations";

export const maxDuration = 60;

export async function POST(request: Request) {
  const formData = await request.formData();
  const slug = String(formData.get("slug") ?? "");
  const login = new URL("/admin/login", request.url);

  if (!(await isAdmin())) {
    return NextResponse.redirect(login, 303);
  }

  if (!isSlug(slug)) {
    return NextResponse.json({ error: "Choose a painting before uploading." }, { status: 400 });
  }

  try {
    await addArtworkFiles(slug, formData);
  } catch (error) {
    if (error instanceof AdminError) {
      const back = new URL(`/admin/artwork/${slug}`, request.url);
      back.searchParams.set("uploadError", error.message);
      back.hash = "photos";
      return NextResponse.redirect(back, 303);
    }

    throw error;
  }

  const done = new URL(`/admin/artwork/${slug}`, request.url);
  done.hash = "photos";
  return NextResponse.redirect(done, 303);
}
