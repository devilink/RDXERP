import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "./db";
import type { CurrentUser } from "./auth";
import { getFamilyStudent } from "./family";
import { teachableSectionIds } from "./permissions";
import { today } from "./utils";

const NOTHING: Prisma.CourseWhereInput = { id: { in: [] } };

/**
 * Who is looking at the LMS and which courses they may see. Combine `courseWhere`
 * with other filters using AND, never a spread, or an id filter could replace it.
 */
export async function lmsAudience(db: TenantDb, user: CurrentUser, childId?: unknown) {
  if (user.role === "STUDENT" || user.role === "PARENT") {
    const { kids, child } = await getFamilyStudent(db, user, typeof childId === "string" ? childId : undefined);
    const courseWhere: Prisma.CourseWhereInput = child?.sectionId ? { sectionId: child.sectionId, published: true } : NOTHING;
    return { family: true as const, kids, child, courseWhere, childQuery: child && kids.length > 1 ? `?child=${child.id}` : "" };
  }
  const sectionIds = await teachableSectionIds(db, user);
  const courseWhere: Prisma.CourseWhereInput = sectionIds === "ALL" ? {} : { sectionId: { in: sectionIds } };
  return { family: false as const, kids: [], child: null, courseWhere, childQuery: "" };
}

/** For actions only a student can take: the student, if this published course is in their section. */
export async function learnerForCourse(db: TenantDb, user: CurrentUser, courseId: string) {
  if (user.role !== "STUDENT") return null;
  const student = await db.student.findFirst({ where: { userId: user.id, status: "ACTIVE" } });
  if (!student?.sectionId) return null;
  const course = await db.course.findFirst({ where: { id: courseId, sectionId: student.sectionId, published: true } });
  return course ? student : null;
}

export function isHttpsUrl(url: string | null) {
  return !url || /^https:\/\/[^\s"'<>]+$/i.test(url);
}

/** Compares in the school's timezone, so work handed in on the due date is never late. */
export function isLate(submittedAt: Date, dueDate: string) {
  return today(submittedAt) > dueDate;
}

export function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** The video id of a YouTube link, so it can be embedded. Null for any other site. */
export function youTubeId(url: string | null) {
  if (!url) return null;
  const m = url.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:[?&#/]|$)/);
  return m ? m[1] : null;
}
