import "server-only";
import type { TenantDb } from "./db";
import type { CurrentUser } from "./auth";

/** Sections a user may manage academically. Admin: all. Teacher: class-teacher sections + sections of classes they teach. */
export async function teachableSectionIds(db: TenantDb, user: CurrentUser): Promise<string[] | "ALL"> {
  if (user.role === "ADMIN") return "ALL";
  if (user.role !== "TEACHER") return [];
  const staff = await db.staff.findFirst({ where: { userId: user.id } });
  if (!staff) return [];
  const sections = await db.section.findMany({
    where: {
      OR: [
        { classTeacherId: staff.id },
        { class: { classSubjects: { some: { teacherId: staff.id } } } },
        { timetable: { some: { teacherId: staff.id } } },
      ],
    },
    select: { id: true },
  });
  return sections.map((s) => s.id);
}

export async function canTeachSection(db: TenantDb, user: CurrentUser, sectionId: string) {
  const ids = await teachableSectionIds(db, user);
  if (ids === "ALL") return !!(await db.section.findFirst({ where: { id: sectionId } }));
  return ids.includes(sectionId);
}

/** Can this user enter marks for a given exam schedule row (class + subject)? */
export async function canEnterMarks(db: TenantDb, user: CurrentUser, classId: string, subjectId: string) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "TEACHER") return false;
  const staff = await db.staff.findFirst({ where: { userId: user.id } });
  if (!staff) return false;
  const cs = await db.classSubject.findFirst({ where: { classId, subjectId, teacherId: staff.id } });
  if (cs) return true;
  // Class teachers may enter marks for any subject of their own class.
  return !!(await db.section.findFirst({ where: { classId, classTeacherId: staff.id } }));
}
