import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Permission, SessionUser } from "@/types/user";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { can, homeFor } from "./permissions";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** For server components/pages: redirects to login or to the user's own home when not permitted. */
export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!can(user.role, permission)) redirect(homeFor(user.role));
  return user;
}

/** For route handlers: returns the user or a ready-made error response. */
export async function requireApiPermission(permission: Permission): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "Please sign in to continue." }, { status: 401 }) };
  if (!can(user.role, permission)) return { error: NextResponse.json({ message: "You do not have permission to do that." }, { status: 403 }) };
  return { user };
}
