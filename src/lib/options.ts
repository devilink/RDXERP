import "server-only";
import type { TenantDb } from "./db";

export async function sectionOptions(db: TenantDb) {
  const rows = await db.section.findMany({ include: { class: true }, orderBy: [{ class: { order: "asc" } }, { name: "asc" }] });
  return rows.map((s) => ({ id: s.id, label: `${s.class.name} – ${s.name}`, classId: s.classId }));
}

export async function stopOptions(db: TenantDb) {
  const rows = await db.busStop.findMany({ include: { route: true }, orderBy: [{ route: { name: "asc" } }, { order: "asc" }] });
  return rows.map((s) => ({ id: s.id, label: `${s.route.name} · ${s.name}` }));
}
