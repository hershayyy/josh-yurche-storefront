import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { AdminError } from "@/lib/admin-error";
import { addBlobOriginal } from "@/lib/artwork-mutations";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json()) as { slug?: unknown; url?: unknown };

  if (typeof body.slug !== "string" || typeof body.url !== "string") {
    return NextResponse.json({ error: "That upload could not be saved." }, { status: 400 });
  }

  try {
    await addBlobOriginal(body.slug, body.url);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}
