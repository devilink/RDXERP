"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { clearEmailFailures, isLockedOut, loginKeys, recordFailure } from "@/lib/login-throttle";
import { str, type ActionState } from "@/lib/utils";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || !password) return { ok: false, message: "Enter email and password." };

  const keys = await loginKeys(email);
  if (await isLockedOut(keys)) return { ok: false, message: "Too many failed attempts. Try again in 15 minutes." };

  const user = await prisma.user.findUnique({ where: { email }, include: { school: true } });
  // Same message for unknown user and wrong password, to avoid account enumeration.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await recordFailure(keys);
    return { ok: false, message: "Invalid email or password." };
  }
  if (!user.active) return { ok: false, message: "This account is disabled. Contact your school admin." };
  if (user.role !== "SUPER_ADMIN" && user.school?.status !== "ACTIVE") {
    return { ok: false, message: "Your school's subscription is inactive. Contact support." };
  }
  await clearEmailFailures(keys);
  await createSession(user.id);
  redirect(user.role === "SUPER_ADMIN" ? "/super" : "/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not logged in." };
  const current = str(fd, "current");
  const next = str(fd, "next");
  if (next.length < 8) return { ok: false, message: "New password must be at least 8 characters." };
  if (!(await bcrypt.compare(current, user.passwordHash))) return { ok: false, message: "Current password is incorrect." };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: true, message: "Password updated." };
}
