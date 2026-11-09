"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionGuard } from "@/lib/auth";
import { failed, num, optStr, randomPassword, str, type ActionState } from "@/lib/utils";

const LOGIN_ROLES = ["ADMIN", "ACCOUNTANT", "TEACHER", "DRIVER"];

export async function createStaff(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const name = str(fd, "name");
    const employeeNo = str(fd, "employeeNo");
    if (!name || !employeeNo) return { ok: false, message: "Name and employee no are required." };
    const email = optStr(fd, "email")?.toLowerCase() ?? null;
    const loginRole = str(fd, "loginRole");
    let userId: string | null = null;
    let note = "";
    if (loginRole) {
      if (!LOGIN_ROLES.includes(loginRole)) return { ok: false, message: "Invalid role." };
      if (!email) return { ok: false, message: "Email is required to create a login." };
      if (await prisma.user.findUnique({ where: { email } })) return { ok: false, message: "That email is already in use." };
      const password = randomPassword();
      const u = await prisma.user.create({ data: { schoolId, name, email, phone: optStr(fd, "phone"), role: loginRole, passwordHash: await bcrypt.hash(password, 10) } });
      userId = u.id;
      note = ` Login: ${email} / ${password} — share it securely; it won't be shown again.`;
    }
    await db.staff.create({
      data: {
        schoolId, userId, name, employeeNo, email, designation: str(fd, "designation") || "Teacher",
        phone: optStr(fd, "phone"), joinDate: optStr(fd, "joinDate"), salary: num(fd, "salary"),
      },
    });
    revalidatePath("/app/staff");
    return { ok: true, message: `${name} added.${note}` };
  } catch (e) {
    return failed(e);
  }
}

export async function toggleStaff(fd: FormData) {
  const { db, schoolId } = await actionGuard(["ADMIN"]);
  const s = await db.staff.findFirst({ where: { id: str(fd, "id") } });
  if (!s) return;
  await db.staff.update({ where: { id: s.id }, data: { active: !s.active } });
  // Deactivating staff also blocks their login.
  if (s.userId) await prisma.user.update({ where: { id: s.userId, schoolId }, data: { active: !s.active } });
  revalidatePath("/app/staff");
}

export async function resetStaffPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const s = await db.staff.findFirst({ where: { id: str(fd, "id") } });
    if (!s?.userId) return { ok: false, message: "This staff member has no login." };
    const password = randomPassword();
    const u = await prisma.user.update({ where: { id: s.userId, schoolId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    return { ok: true, message: `New password for ${u.email}: ${password}` };
  } catch (e) {
    return failed(e);
  }
}
