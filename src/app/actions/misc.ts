"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionGuard } from "@/lib/auth";
import { canTeachSection } from "@/lib/permissions";
import { failed, num, optStr, str, today, type ActionState } from "@/lib/utils";

// ------------------------------------------------------------ Timetable

export async function saveSlot(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const sectionId = str(fd, "sectionId");
    const day = num(fd, "day");
    const period = num(fd, "period");
    const subjectId = optStr(fd, "subjectId");
    const teacherId = optStr(fd, "teacherId");
    if (!(await db.section.findFirst({ where: { id: sectionId } }))) return { ok: false, message: "Invalid section." };
    if (day < 1 || day > 6 || period < 1 || period > 12) return { ok: false, message: "Invalid day or period." };
    if (subjectId && !(await db.subject.findFirst({ where: { id: subjectId } }))) return { ok: false, message: "Invalid subject." };
    if (teacherId) {
      if (!(await db.staff.findFirst({ where: { id: teacherId } }))) return { ok: false, message: "Invalid teacher." };
      const clash = await db.timetableSlot.findFirst({ where: { teacherId, day, period, sectionId: { not: sectionId } }, include: { section: { include: { class: true } } } });
      if (clash) return { ok: false, message: `Teacher clash: already teaching ${clash.section.class.name}-${clash.section.name} in that period.` };
    }
    const data = { startTime: str(fd, "startTime"), endTime: str(fd, "endTime"), subjectId, teacherId };
    if (fd.get("clear")) {
      await db.timetableSlot.deleteMany({ where: { sectionId, day, period } });
    } else {
      await db.timetableSlot.upsert({
        where: { sectionId_day_period: { sectionId, day, period } },
        create: { schoolId, sectionId, day, period, ...data },
        update: data,
      });
    }
    revalidatePath("/app/timetable");
    return { ok: true, message: "Timetable updated." };
  } catch (e) {
    return failed(e);
  }
}

// ------------------------------------------------------------ Notices

export async function postNotice(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(["ADMIN", "TEACHER", "ACCOUNTANT"]);
    const title = str(fd, "title");
    const body = str(fd, "body");
    if (!title || !body) return { ok: false, message: "Title and message are required." };
    const audience = str(fd, "audience");
    await db.notice.create({ data: { schoolId, title, body, audience: ["ALL", "STAFF", "STUDENTS", "PARENTS"].includes(audience) ? audience : "ALL", createdById: user.id } });
    revalidatePath("/app/notices");
    return { ok: true, message: "Notice published." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteNotice(fd: FormData) {
  const { db, user } = await actionGuard(["ADMIN", "TEACHER", "ACCOUNTANT"]);
  // Admin can delete any; others only their own.
  await db.notice.deleteMany({ where: { id: str(fd, "id"), ...(user.role === "ADMIN" ? {} : { createdById: user.id }) } });
  revalidatePath("/app/notices");
}

// ------------------------------------------------------------ Homework

export async function addHomework(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(["ADMIN", "TEACHER"]);
    const sectionId = str(fd, "sectionId");
    if (!(await canTeachSection(db, user, sectionId))) return { ok: false, message: "You are not assigned to this section." };
    const subjectId = optStr(fd, "subjectId");
    if (subjectId && !(await db.subject.findFirst({ where: { id: subjectId } }))) return { ok: false, message: "Invalid subject." };
    await db.homework.create({ data: { schoolId, sectionId, subjectId, title: str(fd, "title"), description: optStr(fd, "description"), dueDate: str(fd, "dueDate") || today() } });
    revalidatePath("/app/homework");
    return { ok: true, message: "Homework posted." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteHomework(fd: FormData) {
  const { db, user } = await actionGuard(["ADMIN", "TEACHER"]);
  const hw = await db.homework.findFirst({ where: { id: str(fd, "id") } });
  if (hw && (await canTeachSection(db, user, hw.sectionId))) await db.homework.delete({ where: { id: hw.id } });
  revalidatePath("/app/homework");
}

// ------------------------------------------------------------ Calendar

export async function addEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const type = str(fd, "type");
    await db.schoolEvent.create({
      data: { schoolId, title: str(fd, "title"), date: str(fd, "date"), endDate: optStr(fd, "endDate"), type: ["EVENT", "HOLIDAY", "MEETING", "EXAM"].includes(type) ? type : "EVENT", details: optStr(fd, "details") },
    });
    revalidatePath("/app/calendar");
    return { ok: true, message: "Added to calendar." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteEvent(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  await db.schoolEvent.deleteMany({ where: { id: str(fd, "id") } });
  revalidatePath("/app/calendar");
}

// ------------------------------------------------------------ Library

export async function addBook(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN", "TEACHER"]);
    await db.book.create({ data: { schoolId, title: str(fd, "title"), author: optStr(fd, "author"), isbn: optStr(fd, "isbn"), copies: Math.max(1, num(fd, "copies", 1)) } });
    revalidatePath("/app/library");
    return { ok: true, message: "Book added." };
  } catch (e) {
    return failed(e);
  }
}

export async function issueBook(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN", "TEACHER"]);
    const book = await db.book.findFirst({ where: { id: str(fd, "bookId") }, include: { issues: { where: { returnedOn: null } } } });
    if (!book) return { ok: false, message: "Book not found." };
    if (book.issues.length >= book.copies) return { ok: false, message: "No copies available." };
    const student = await db.student.findFirst({ where: { admissionNo: str(fd, "admissionNo"), status: "ACTIVE" } });
    if (!student) return { ok: false, message: "No active student with that admission number." };
    const due = new Date();
    due.setDate(due.getDate() + Math.max(1, num(fd, "days", 14)));
    await db.bookIssue.create({ data: { schoolId, bookId: book.id, studentId: student.id, issuedOn: today(), dueOn: today(due) } });
    revalidatePath("/app/library");
    return { ok: true, message: `Issued to ${student.firstName} ${student.lastName}.` };
  } catch (e) {
    return failed(e);
  }
}

export async function returnBook(fd: FormData) {
  const { db } = await actionGuard(["ADMIN", "TEACHER"]);
  await db.bookIssue.updateMany({ where: { id: str(fd, "id"), returnedOn: null }, data: { returnedOn: today() } });
  revalidatePath("/app/library");
}

// ------------------------------------------------------------ School settings

export async function updateSchool(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { schoolId } = await actionGuard(["ADMIN"]);
    const color = str(fd, "primaryColor");
    const logoUrl = optStr(fd, "logoUrl");
    if (logoUrl && !/^https:\/\/[^\s"'<>]+$/i.test(logoUrl)) return { ok: false, message: "Logo must be an https:// image URL." };
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        name: str(fd, "name") || undefined, address: optStr(fd, "address"), phone: optStr(fd, "phone"), email: optStr(fd, "email"),
        logoUrl, primaryColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined,
      },
    });
    revalidatePath("/app", "layout");
    return { ok: true, message: "School profile saved." };
  } catch (e) {
    return failed(e);
  }
}
