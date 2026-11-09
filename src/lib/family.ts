import "server-only";
import type { TenantDb } from "./db";
import type { CurrentUser } from "./auth";

/** Students visible to a parent (their children) or a student (themself). */
export async function getFamilyStudents(db: TenantDb, user: CurrentUser) {
  const include = { section: { include: { class: true } }, busStop: { include: { route: true } } } as const;
  if (user.role === "STUDENT") {
    return db.student.findMany({ where: { userId: user.id }, include });
  }
  if (user.role === "PARENT") {
    return db.student.findMany({ where: { guardian: { userId: user.id } }, include, orderBy: { firstName: "asc" } });
  }
  return [];
}

/** Resolve the selected child for a family user, ensuring it belongs to them. */
export async function getFamilyStudent(db: TenantDb, user: CurrentUser, childId?: string) {
  const kids = await getFamilyStudents(db, user);
  return { kids, child: kids.find((k) => k.id === childId) ?? kids[0] ?? null };
}
