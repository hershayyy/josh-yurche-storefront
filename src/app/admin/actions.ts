"use server";

import { redirect } from "next/navigation";
import { signInAdmin, signOutAdmin } from "@/lib/admin-auth";
import { AdminError } from "@/lib/admin-error";
import {
  addPrintRecord,
  createArtworkRecord,
  deleteArtworkRecord,
  featureArtworkRecord,
  isSlug,
  makeArtworkLead,
  moveArtworkPhoto,
  removeArtworkPhoto,
  removePrintRecord,
  saveArtworkRecord,
  updatePrintRecord,
} from "@/lib/artwork-mutations";

export type FormState = { error?: string } | null;

function redirectError(error: unknown, slug: string): never {
  if (!(error instanceof AdminError) || !isSlug(slug)) throw error;
  redirect(
    `/admin/artwork/${slug}?uploadError=${encodeURIComponent(error.message)}#photos`,
  );
}

export async function signIn(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const message = await signInAdmin(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );

  if (message) return { error: message };
  redirect("/admin");
}

export async function signOut() {
  await signOutAdmin();
  redirect("/admin/login");
}

export async function createArtwork(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const slug = await createArtworkRecord(formData);
    redirect(`/admin/artwork/${slug}`);
  } catch (error) {
    if (!(error instanceof AdminError)) throw error;
    return { error: error.message };
  }
}

export async function saveArtwork(
  slug: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await saveArtworkRecord(slug, formData);
  } catch (error) {
    if (!(error instanceof AdminError)) throw error;
    return { error: error.message };
  }

  redirect(`/admin/artwork/${slug}?saved=1`);
}

export async function featureArtwork(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");

  try {
    await featureArtworkRecord(slug);
  } catch (error) {
    redirectError(error, slug);
  }

  redirect("/admin");
}

export async function deleteArtwork(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  await deleteArtworkRecord(slug);
  redirect("/admin");
}

export async function movePhoto(formData: FormData) {
  try {
    const slug = await moveArtworkPhoto(formData);
    redirect(`/admin/artwork/${slug}#photos`);
  } catch (error) {
    redirectError(error, String(formData.get("slug") ?? ""));
  }
}

export async function makeLeadPhoto(formData: FormData) {
  try {
    const slug = await makeArtworkLead(formData);
    redirect(`/admin/artwork/${slug}#photos`);
  } catch (error) {
    redirectError(error, String(formData.get("slug") ?? ""));
  }
}

export async function removePhoto(formData: FormData) {
  try {
    const slug = await removeArtworkPhoto(formData);
    redirect(`/admin/artwork/${slug}#photos`);
  } catch (error) {
    redirectError(error, String(formData.get("slug") ?? ""));
  }
}

function redirectPrintError(error: unknown, slug: string): void {
  if (!(error instanceof AdminError) || !isSlug(slug)) throw error;
  redirect(
    `/admin/artwork/${slug}?printError=${encodeURIComponent(error.message)}#prints`,
  );
}

export async function addPrint(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");

  try {
    await addPrintRecord(formData);
  } catch (error) {
    redirectPrintError(error, slug);
  }

  redirect(`/admin/artwork/${slug}?saved=1#prints`);
}

export async function updatePrint(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");

  try {
    await updatePrintRecord(formData);
  } catch (error) {
    redirectPrintError(error, slug);
  }

  redirect(`/admin/artwork/${slug}?saved=1#prints`);
}

export async function removePrint(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");

  try {
    await removePrintRecord(formData);
  } catch (error) {
    redirectPrintError(error, slug);
  }

  redirect(`/admin/artwork/${slug}?saved=1#prints`);
}
