"use server";

import { revalidatePath } from "next/cache";
import { actionGuard } from "@/lib/auth";
import { failed, num, optStr, str, type ActionState } from "@/lib/utils";

export async function addClass(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const name = str(fd, "name");
    if (!name) return { ok: false, message: "Class name is required." };
    const klass = await db.class.create({ data: { schoolId, name, order: num(fd, "order") } });
    const sections = str(fd, "sections").split(",").map((s) => s.trim()).filter(Boolean);
    for (const s of sections.length ? sections : ["A"]) {
      await db.section.create({ data: { schoolId, classId: klass.id, name: s } });
    }
    revalidatePath("/app/academics");
    return { ok: true, message: `${name} created.` };
  } catch (e) {
    return failed(e);
  }
}

export async function addSection(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const klass = await db.class.findFirst({ where: { id: str(fd, "classId") } });
    if (!klass) return { ok: false, message: "Class not found." };
    await db.section.create({ data: { schoolId, classId: klass.id, name: str(fd, "name"), room: optStr(fd, "room") } });
    revalidatePath("/app/academics");
    return { ok: true, message: "Section added." };
  } catch (e) {
    return failed(e);
  }
}

export async function updateSection(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db } = await actionGuard(["ADMIN"]);
    const teacherId = optStr(fd, "classTeacherId");
    if (teacherId && !(await db.staff.findFirst({ where: { id: teacherId } }))) return { ok: false, message: "Teacher not found." };
    await db.section.update({ where: { id: str(fd, "id") }, data: { classTeacherId: teacherId, room: optStr(fd, "room") } });
    revalidatePath("/app/academics");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteClass(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  await db.class.deleteMany({ where: { id: str(fd, "id") } });
  revalidatePath("/app/academics");
}

export async function addSubject(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const name = str(fd, "name");
    if (!name) return { ok: false, message: "Subject name is required." };
    const subject = await db.subject.create({ data: { schoolId, name, code: optStr(fd, "code") } });
    // Optionally attach to every class right away.
    if (fd.get("allClasses")) {
      const classes = await db.class.findMany();
      for (const c of classes) await db.classSubject.create({ data: { schoolId, classId: c.id, subjectId: subject.id } });
    }
    revalidatePath("/app/academics");
    return { ok: true, message: `${name} added.` };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteSubject(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  await db.subject.deleteMany({ where: { id: str(fd, "id") } });
  revalidatePath("/app/academics");
}

/** Assign (or re-assign) a subject + teacher to a class. */
export async function assignClassSubject(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const classId = str(fd, "classId");
    const subjectId = str(fd, "subjectId");
    const teacherId = optStr(fd, "teacherId");
    const [c, s, t] = await Promise.all([
      db.class.findFirst({ where: { id: classId } }),
      db.subject.findFirst({ where: { id: subjectId } }),
      teacherId ? db.staff.findFirst({ where: { id: teacherId } }) : Promise.resolve(true),
    ]);
    if (!c || !s || !t) return { ok: false, message: "Invalid class, subject or teacher." };
    await db.classSubject.upsert({
      where: { classId_subjectId: { classId, subjectId } },
      create: { schoolId, classId, subjectId, teacherId },
      update: { teacherId },
    });
    revalidatePath("/app/academics");
    return { ok: true, message: "Assignment saved." };
  } catch (e) {
    return failed(e);
  }
}

export async function removeClassSubject(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  await db.classSubject.deleteMany({ where: { id: str(fd, "id") } });
  revalidatePath("/app/academics");
}

export async function addAcademicYear(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const isCurrent = !!fd.get("isCurrent");
    if (isCurrent) await db.academicYear.updateMany({ data: { isCurrent: false } });
    await db.academicYear.create({ data: { schoolId, name: str(fd, "name"), startDate: str(fd, "startDate"), endDate: str(fd, "endDate"), isCurrent } });
    revalidatePath("/app/academics");
    return { ok: true, message: "Academic year added." };
  } catch (e) {
    return failed(e);
  }
}

export async function saveGradeScale(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const grade = str(fd, `grade_${i}`);
      if (!grade) continue;
      rows.push({ schoolId, grade, minPercent: num(fd, `min_${i}`), gradePoint: num(fd, `gp_${i}`), remark: optStr(fd, `remark_${i}`) });
    }
    if (!rows.length) return { ok: false, message: "Add at least one grade." };
    await db.gradeScale.deleteMany({});
    await db.gradeScale.createMany({ data: rows });
    revalidatePath("/app/academics");
    return { ok: true, message: "Grading scale saved." };
  } catch (e) {
    return failed(e);
  }
}
