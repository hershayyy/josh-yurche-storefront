import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getIronSession, type SessionOptions } from "iron-session";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AdminSession = {
  isAdmin?: boolean;
};

export const ADMIN_COOKIE = "jy_admin";

function sessionPassword() {
  const password = process.env.SESSION_PASSWORD ?? "";
  return password.length >= 32 ? password : null;
}

export function adminAuthConfigured() {
  const email = process.env.ADMIN_EMAIL?.trim() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  return email.includes("@") && password.length >= 8 && sessionPassword() !== null;
}

function sessionOptions(): SessionOptions {
  const password = sessionPassword();

  if (!password) {
    throw new Error("SESSION_PASSWORD must be at least 32 characters.");
  }

  return {
    password,
    cookieName: ADMIN_COOKIE,
    ttl: 60 * 60 * 24 * 14,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getAdminSession() {
  if (!sessionPassword()) return null;

  return getIronSession<AdminSession>(await cookies(), sessionOptions());
}

export async function isAdmin() {
  "use cache: private";
  cacheLife({ stale: 60 });

  const session = await getAdminSession();
  return session?.isAdmin === true;
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
}

function matches(input: string, expected: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function signInAdmin(email: string, password: string) {
  if (!adminAuthConfigured()) {
    return "Set ADMIN_EMAIL, ADMIN_PASSWORD, and SESSION_PASSWORD before signing in.";
  }

  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
  const emailMatches = matches(email.trim().toLowerCase(), expectedEmail);
  const passwordMatches = matches(password, expectedPassword);

  if (!emailMatches || !passwordMatches) {
    return "That email or password is incorrect.";
  }

  const session = await getAdminSession();

  if (!session) {
    return "Set ADMIN_EMAIL, ADMIN_PASSWORD, and SESSION_PASSWORD before signing in.";
  }

  session.isAdmin = true;
  await session.save();
  return null;
}

export async function signOutAdmin() {
  const session = await getAdminSession();
  session?.destroy();
}
