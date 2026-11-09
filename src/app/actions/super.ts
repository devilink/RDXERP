"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_GRADES } from "@/lib/constants";
import { failed, num, optStr, randomPassword, str, type ActionState } from "@/lib/utils";

async function guard() {
  const u = await getCurrentUser();
  if (!u || u.role !== "SUPER_ADMIN") throw new Error("Not authorised");
  return u;
}

const PLANS = ["BASIC", "STANDARD", "PREMIUM"];

/** Onboard a new school with its first admin login. */
export async function createSchool(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await guard();
    const name = str(fd, "name");
    const code = str(fd, "code").toLowerCase().replace(/[^a-z0-9-]/g, "");
    const adminEmail = str(fd, "adminEmail").toLowerCase();
    if (!name || !code || !adminEmail) return { ok: false, message: "School name, code and admin email are required." };
    if (await prisma.school.findUnique({ where: { code } })) return { ok: false, message: "That school code is taken." };
    if (await prisma.user.findUnique({ where: { email: adminEmail } })) return { ok: false, message: "That admin email is already in use." };
    const plan = PLANS.includes(str(fd, "plan")) ? str(fd, "plan") : "STANDARD";
    const password = randomPassword();
    const year = new Date().getFullYear();

    await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: { name, code, plan, maxStudents: num(fd, "maxStudents", 1000), phone: optStr(fd, "phone"), email: optStr(fd, "email"), address: optStr(fd, "address") },
      });
      await tx.user.create({ data: { schoolId: school.id, name: str(fd, "adminName") || "School Admin", email: adminEmail, role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) } });
      // Sensible defaults so the school can start immediately.
      await tx.academicYear.create({ data: { schoolId: school.id, name: `${year}-${String(year + 1).slice(2)}`, startDate: `${year}-04-01`, endDate: `${year + 1}-03-31`, isCurrent: true } });
      await tx.gradeScale.createMany({ data: DEFAULT_GRADES.map((g) => ({ ...g, schoolId: school.id })) });
    });
    revalidatePath("/super");
    return { ok: true, message: `School created. Admin login: ${adminEmail} / ${password} — share it securely, it won't be shown again.` };
  } catch (e) {
    return failed(e);
  }
}

export async function updateSchoolPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await guard();
    const plan = str(fd, "plan");
    await prisma.school.update({
      where: { id: str(fd, "id") },
      data: { plan: PLANS.includes(plan) ? plan : undefined, maxStudents: num(fd, "maxStudents", 1000), status: str(fd, "status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE" },
    });
    revalidatePath("/super");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return failed(e);
  }
}

export async function resetSchoolAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await guard();
    const admin = await prisma.user.findFirst({ where: { schoolId: str(fd, "id"), role: "ADMIN" }, orderBy: { createdAt: "asc" } });
    if (!admin) return { ok: false, message: "No admin found for this school." };
    const password = randomPassword();
    await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(password, 10), active: true } });
    return { ok: true, message: `${admin.email} / ${password}` };
  } catch (e) {
    return failed(e);
  }
}
