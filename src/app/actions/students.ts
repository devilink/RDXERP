"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { actionGuard } from "@/lib/auth";
import { failed, optStr, randomPassword, str, type ActionState } from "@/lib/utils";

async function checkRefs(db: Awaited<ReturnType<typeof actionGuard>>["db"], sectionId: string | null, busStopId: string | null) {
  if (sectionId && !(await db.section.findFirst({ where: { id: sectionId } }))) throw new Error("Invalid section.");
  if (busStopId && !(await db.busStop.findFirst({ where: { id: busStopId } }))) throw new Error("Invalid bus stop.");
}

/** Create a login for a parent / student. Emails are global, so check across all schools. */
async function createLogin(schoolId: string, name: string, email: string, role: "PARENT" | "STUDENT") {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new Error(`The email ${email} is already in use.`);
  const password = randomPassword();
  const user = await prisma.user.create({ data: { schoolId, name, email, role, passwordHash: await bcrypt.hash(password, 10) } });
  return { user, password };
}

export async function createStudent(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  try {
    const { db, schoolId, school } = await actionGuard(["ADMIN"]);
    const count = await db.student.count({ where: { status: "ACTIVE" } });
    if (count >= school.maxStudents) return { ok: false, message: `Your plan allows ${school.maxStudents} students. Contact support to upgrade.` };

    const firstName = str(fd, "firstName");
    const lastName = str(fd, "lastName");
    const admissionNo = str(fd, "admissionNo");
    if (!firstName || !admissionNo) return { ok: false, message: "First name and admission number are required." };
    const sectionId = optStr(fd, "sectionId");
    const busStopId = optStr(fd, "busStopId");
    await checkRefs(db, sectionId, busStopId);

    const credentials: string[] = [];

    // Guardian: reuse an existing one by phone (siblings), or create.
    let guardianId: string | null = null;
    const gName = str(fd, "guardianName");
    const gPhone = optStr(fd, "guardianPhone");
    const gEmail = optStr(fd, "guardianEmail")?.toLowerCase() ?? null;
    if (gName) {
      const existing = gPhone ? await db.guardian.findFirst({ where: { phone: gPhone } }) : null;
      if (existing) guardianId = existing.id;
      else {
        let userId: string | null = null;
        if (gEmail && fd.get("parentLogin")) {
          const { user, password } = await createLogin(schoolId, gName, gEmail, "PARENT");
          userId = user.id;
          credentials.push(`Parent login: ${gEmail} / ${password}`);
        }
        const g = await db.guardian.create({ data: { schoolId, name: gName, phone: gPhone, email: gEmail, relation: str(fd, "relation") || "Parent", userId } });
        guardianId = g.id;
      }
    }

    let userId: string | null = null;
    const sEmail = optStr(fd, "studentEmail")?.toLowerCase();
    if (sEmail) {
      const { user, password } = await createLogin(schoolId, `${firstName} ${lastName}`, sEmail, "STUDENT");
      userId = user.id;
      credentials.push(`Student login: ${sEmail} / ${password}`);
    }

    const st = await db.student.create({
      data: {
        schoolId, admissionNo, firstName, lastName, sectionId, busStopId, guardianId, userId,
        rollNo: optStr(fd, "rollNo") ? Number(str(fd, "rollNo")) : null,
        gender: optStr(fd, "gender"), dob: optStr(fd, "dob"), bloodGroup: optStr(fd, "bloodGroup"),
        address: optStr(fd, "address"), phone: optStr(fd, "phone"), admittedOn: optStr(fd, "admittedOn"),
      },
    });
    id = st.id;
    if (credentials.length) {
      // Show generated passwords once; admin should hand them over securely.
      revalidatePath("/app/students");
      return { ok: true, message: `Student admitted. ${credentials.join(" · ")} — note these down now, they won't be shown again.` };
    }
  } catch (e) {
    return failed(e);
  }
  revalidatePath("/app/students");
  redirect(`/app/students/${id}`);
}

export async function updateStudent(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db } = await actionGuard(["ADMIN"]);
    const sectionId = optStr(fd, "sectionId");
    const busStopId = optStr(fd, "busStopId");
    await checkRefs(db, sectionId, busStopId);
    await db.student.update({
      where: { id: str(fd, "id") },
      data: {
        firstName: str(fd, "firstName"), lastName: str(fd, "lastName"), admissionNo: str(fd, "admissionNo"),
        rollNo: optStr(fd, "rollNo") ? Number(str(fd, "rollNo")) : null, sectionId, busStopId,
        gender: optStr(fd, "gender"), dob: optStr(fd, "dob"), bloodGroup: optStr(fd, "bloodGroup"),
        address: optStr(fd, "address"), phone: optStr(fd, "phone"), status: str(fd, "status") || "ACTIVE",
      },
    });
    revalidatePath(`/app/students/${str(fd, "id")}`);
    return { ok: true, message: "Student updated." };
  } catch (e) {
    return failed(e);
  }
}

/** Create (or reset) the parent portal login for a student's guardian. */
export async function resetFamilyLogin(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const student = await db.student.findFirst({ where: { id: str(fd, "studentId") }, include: { guardian: true } });
    if (!student) return { ok: false, message: "Student not found." };
    const which = str(fd, "which");
    const password = randomPassword();
    const hash = await bcrypt.hash(password, 10);

    if (which === "PARENT") {
      if (!student.guardian) return { ok: false, message: "Add a guardian first." };
      if (student.guardian.userId) {
        const u = await prisma.user.update({ where: { id: student.guardian.userId, schoolId }, data: { passwordHash: hash } });
        return { ok: true, message: `New parent password for ${u.email}: ${password}` };
      }
      const email = optStr(fd, "email")?.toLowerCase() ?? student.guardian.email;
      if (!email) return { ok: false, message: "Enter the parent's email." };
      const { user, password: p } = await createLogin(schoolId, student.guardian.name, email, "PARENT");
      await db.guardian.update({ where: { id: student.guardian.id }, data: { userId: user.id, email } });
      revalidatePath(`/app/students/${student.id}`);
      return { ok: true, message: `Parent login created: ${email} / ${p}` };
    }
    if (student.userId) {
      const u = await prisma.user.update({ where: { id: student.userId, schoolId }, data: { passwordHash: hash } });
      return { ok: true, message: `New student password for ${u.email}: ${password}` };
    }
    const email = optStr(fd, "email")?.toLowerCase();
    if (!email) return { ok: false, message: "Enter the student's email." };
    const { user, password: p } = await createLogin(schoolId, `${student.firstName} ${student.lastName}`, email, "STUDENT");
    await db.student.update({ where: { id: student.id }, data: { userId: user.id } });
    revalidatePath(`/app/students/${student.id}`);
    return { ok: true, message: `Student login created: ${email} / ${p}` };
  } catch (e) {
    return failed(e);
  }
}

/** Move every active student of one section into another (year-end promotion). */
export async function promoteSection(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db } = await actionGuard(["ADMIN"]);
    const from = await db.section.findFirst({ where: { id: str(fd, "from") } });
    const toId = str(fd, "to");
    if (!from) return { ok: false, message: "Choose a source section." };
    if (toId === "GRADUATE") {
      const r = await db.student.updateMany({ where: { sectionId: from.id, status: "ACTIVE" }, data: { status: "GRADUATED", sectionId: null } });
      revalidatePath("/app/students");
      return { ok: true, message: `${r.count} students marked as graduated.` };
    }
    const to = await db.section.findFirst({ where: { id: toId } });
    if (!to || to.id === from.id) return { ok: false, message: "Choose a different target section." };
    const r = await db.student.updateMany({ where: { sectionId: from.id, status: "ACTIVE" }, data: { sectionId: to.id } });
    revalidatePath("/app/students");
    return { ok: true, message: `${r.count} students promoted.` };
  } catch (e) {
    return failed(e);
  }
}
