import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { prisma, tenantDb } from "./db";
import type { Role } from "./constants";

const COOKIE = "erp_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
// Which school the platform owner has opened. Only honoured for a SUPER_ADMIN session.
const VIEW_COOKIE = "erp_view_school";
const VIEW_MAX_AGE = 60 * 60 * 8; // 8 hours

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  if (s.startsWith("replace-with")) throw new Error("SESSION_SECRET is still the example value");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(VIEW_COOKIE);
}

export async function startViewingSchool(schoolId: string) {
  (await cookies()).set(VIEW_COOKIE, schoolId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VIEW_MAX_AGE,
  });
}

export async function stopViewingSchool() {
  (await cookies()).delete(VIEW_COOKIE);
}

/** Current user (validated against the DB on every request), or null. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await prisma.user.findUnique({
      where: { id: String(payload.uid) },
      include: { school: true },
    });
    if (!user || !user.active) return null;
    if (user.role !== "SUPER_ADMIN" && (!user.school || user.school.status !== "ACTIVE")) return null;
    return user;
  } catch {
    return null;
  }
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
export type SchoolUser = CurrentUser & { viewingAsOwner?: boolean };

/** The current user, with the platform owner acting as an admin of the school they opened. */
export const getSchoolUser = cache(async (): Promise<SchoolUser | null> => {
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN") return user;
  const id = (await cookies()).get(VIEW_COOKIE)?.value;
  const school = id ? await prisma.school.findUnique({ where: { id } }) : null;
  if (!school) return user;
  return { ...user, role: "ADMIN", schoolId: school.id, school, viewingAsOwner: true };
});

/** Require a logged-in super admin. */
export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") redirect("/app");
  return user;
}

/**
 * Require a logged-in school user, optionally restricted to roles.
 * Returns the user, their school, and a tenant-scoped db client.
 */
export async function requireSchoolUser(roles?: Role[]) {
  const user = await getSchoolUser();
  if (!user) redirect("/login");
  if (user.role === "SUPER_ADMIN" || !user.schoolId || !user.school) redirect("/super");
  if (roles && !roles.includes(user.role as Role)) redirect("/app?denied=1");
  return { user, school: user.school, schoolId: user.schoolId, db: tenantDb(user.schoolId) };
}

/** Same as requireSchoolUser but for server actions: throws instead of redirecting. */
export async function actionGuard(roles?: Role[]) {
  const user = await getSchoolUser();
  if (!user || !user.schoolId || !user.school || user.role === "SUPER_ADMIN") {
    throw new Error("Not authorised");
  }
  if (roles && !roles.includes(user.role as Role)) throw new Error("You do not have permission for this action");
  return { user, school: user.school, schoolId: user.schoolId, db: tenantDb(user.schoolId) };
}
