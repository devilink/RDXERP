"use server";

import { revalidatePath } from "next/cache";
import { actionGuard } from "@/lib/auth";
import { canEnterMarks } from "@/lib/permissions";
import { failed, num, optStr, str, type ActionState } from "@/lib/utils";

export async function createExam(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const name = str(fd, "name");
    if (!name) return { ok: false, message: "Exam name is required." };
    const year = await db.academicYear.findFirst({ where: { isCurrent: true } });
    await db.exam.create({ data: { schoolId, name, startDate: optStr(fd, "startDate"), endDate: optStr(fd, "endDate"), academicYearId: year?.id } });
    revalidatePath("/app/exams");
    return { ok: true, message: `${name} created. Open it to build the routine.` };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteExam(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  await db.exam.deleteMany({ where: { id: str(fd, "id") } });
  revalidatePath("/app/exams");
}

export async function togglePublish(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  const exam = await db.exam.findFirst({ where: { id: str(fd, "id") } });
  if (!exam) return;
  await db.exam.update({ where: { id: exam.id }, data: { published: !exam.published } });
  revalidatePath(`/app/exams/${exam.id}`);
}

async function ownedExam(db: Awaited<ReturnType<typeof actionGuard>>["db"], examId: string) {
  const exam = await db.exam.findFirst({ where: { id: examId } });
  if (!exam) throw new Error("Exam not found.");
  return exam;
}

/** Add / update one row of the exam routine. */
export async function saveSchedule(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const exam = await ownedExam(db, str(fd, "examId"));
    const classId = str(fd, "classId");
    const subjectId = str(fd, "subjectId");
    const [c, s] = await Promise.all([db.class.findFirst({ where: { id: classId } }), db.subject.findFirst({ where: { id: subjectId } })]);
    if (!c || !s) return { ok: false, message: "Invalid class or subject." };
    const data = {
      date: str(fd, "date"), startTime: str(fd, "startTime") || "10:00", endTime: str(fd, "endTime") || "13:00",
      room: optStr(fd, "room"), maxMarks: num(fd, "maxMarks", 100), passMarks: num(fd, "passMarks", 33),
    };
    if (!data.date) return { ok: false, message: "Date is required." };
    if (data.passMarks > data.maxMarks) return { ok: false, message: "Pass marks cannot exceed max marks." };
    // Clash check: same class can't have two papers overlapping on one date.
    const clash = await db.examSchedule.findFirst({
      where: { examId: exam.id, classId, date: data.date, subjectId: { not: subjectId }, startTime: { lt: data.endTime }, endTime: { gt: data.startTime } },
      include: { subject: true },
    });
    if (clash) return { ok: false, message: `Clash: ${c.name} already has ${clash.subject.name} at that time.` };
    await db.examSchedule.upsert({
      where: { examId_classId_subjectId: { examId: exam.id, classId, subjectId } },
      create: { schoolId, examId: exam.id, classId, subjectId, ...data },
      update: data,
    });
    revalidatePath(`/app/exams/${exam.id}`);
    return { ok: true, message: `${s.name} scheduled for ${c.name}.` };
  } catch (e) {
    return failed(e);
  }
}

/** Generate a routine for a class: one subject per day from a start date, skipping Sundays/holidays. */
export async function autoRoutine(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const exam = await ownedExam(db, str(fd, "examId"));
    const classIds = str(fd, "classId") === "ALL" ? (await db.class.findMany({ select: { id: true } })).map((c) => c.id) : [str(fd, "classId")];
    const start = str(fd, "startDate");
    if (!start) return { ok: false, message: "Start date is required." };
    const gap = Math.max(1, num(fd, "gap", 1));
    const holidays = new Set((await db.schoolEvent.findMany({ where: { type: "HOLIDAY", date: { gte: start } } })).map((h) => h.date));
    let created = 0;
    for (const classId of classIds) {
      const subjects = await db.classSubject.findMany({ where: { classId }, include: { subject: true }, orderBy: { subject: { name: "asc" } } });
      if (!subjects.length) continue;
      const d = new Date(start + "T00:00:00");
      for (const cs of subjects) {
        while (d.getDay() === 0 || holidays.has(d.toLocaleDateString("en-CA"))) d.setDate(d.getDate() + 1);
        const date = d.toLocaleDateString("en-CA");
        const data = { date, startTime: str(fd, "startTime") || "10:00", endTime: str(fd, "endTime") || "13:00", room: optStr(fd, "room"), maxMarks: num(fd, "maxMarks", 100), passMarks: num(fd, "passMarks", 33) };
        await db.examSchedule.upsert({
          where: { examId_classId_subjectId: { examId: exam.id, classId, subjectId: cs.subjectId } },
          create: { schoolId, examId: exam.id, classId, subjectId: cs.subjectId, ...data },
          update: data,
        });
        created++;
        d.setDate(d.getDate() + gap);
      }
    }
    revalidatePath(`/app/exams/${exam.id}`);
    return { ok: true, message: `${created} papers scheduled.` };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteSchedule(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  const sc = await db.examSchedule.findFirst({ where: { id: str(fd, "id") } });
  if (!sc) return;
  await db.examSchedule.delete({ where: { id: sc.id } });
  revalidatePath(`/app/exams/${sc.examId}`);
}

export async function saveMarks(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(["ADMIN", "TEACHER"]);
    const sc = await db.examSchedule.findFirst({ where: { id: str(fd, "scheduleId") }, include: { exam: true } });
    if (!sc) return { ok: false, message: "Paper not found." };
    if (!(await canEnterMarks(db, user, sc.classId, sc.subjectId))) return { ok: false, message: "You are not assigned to this subject." };
    if (sc.exam.published && user.role !== "ADMIN") return { ok: false, message: "Results are published; only an admin can change marks." };

    const students = await db.student.findMany({ where: { status: "ACTIVE", section: { classId: sc.classId } }, select: { id: true, firstName: true } });
    let n = 0;
    const errors: string[] = [];
    for (const s of students) {
      const raw = str(fd, `m_${s.id}`).toUpperCase();
      const remarks = optStr(fd, `r_${s.id}`);
      if (raw === "" && !remarks) {
        await db.mark.deleteMany({ where: { examScheduleId: sc.id, studentId: s.id } });
        continue;
      }
      const absent = raw === "AB";
      const value = absent || raw === "" ? null : Number(raw);
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > sc.maxMarks)) {
        errors.push(s.firstName);
        continue;
      }
      await db.mark.upsert({
        where: { examScheduleId_studentId: { examScheduleId: sc.id, studentId: s.id } },
        create: { schoolId, examScheduleId: sc.id, studentId: s.id, marksObtained: value, absent, remarks },
        update: { marksObtained: value, absent, remarks },
      });
      n++;
    }
    revalidatePath(`/app/exams/${sc.examId}`);
    if (errors.length) return { ok: false, message: `Saved ${n}. Invalid marks (must be 0–${sc.maxMarks} or AB) for: ${errors.join(", ")}` };
    return { ok: true, message: `Marks saved for ${n} students.` };
  } catch (e) {
    return failed(e);
  }
}
