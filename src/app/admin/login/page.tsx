import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";
import { PageShell, PageTitle } from "@/components/page-shell";
import { adminAuthConfigured, isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <PageShell narrow>
          <p className="text-sm text-muted">Loading sign in…</p>
        </PageShell>
      }
    >
      <LoginScreen />
    </Suspense>
  );
}

async function LoginScreen() {
  if (await isAdmin()) redirect("/admin");

  return (
    <PageShell narrow>
      <PageTitle>Artwork admin</PageTitle>
      <p className="mt-4 text-base leading-7 text-muted">
        Sign in to add paintings, upload photos, and choose the homepage feature.
      </p>
      {adminAuthConfigured() ? null : (
        <p className="mt-4 text-sm leading-6" role="status">
          Set ADMIN_EMAIL, ADMIN_PASSWORD, and SESSION_PASSWORD before signing in.
        </p>
      )}
      <LoginForm />
    </PageShell>
  );
}
