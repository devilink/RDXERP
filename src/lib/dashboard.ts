import "server-only";
import { prisma, type TenantDb } from "./db";
import { today } from "./utils";

export type GraphNodeType = "school" | "class" | "section" | "subject" | "teacher" | "route";
export type GraphNode = { id: string; label: string; type: GraphNodeType; meta: string; href?: string };
export type GraphEdge = { source: string; target: string; relation: string };

export type DashboardData = {
  today: string;
  classes: { id: string; name: string; students: number; sections: number }[];
  attendance: { classId: string; date: string; present: number; marked: number }[];
  fees: { classId: string | null; billed: number; collected: number }[];
  feeMonths: { classId: string | null; month: string; amount: number }[];
  exam: { name: string; rows: { classId: string; passed: number; total: number; average: number }[] } | null;
  totals: { students: number; staff: number; sections: number; maxStudents: number; vehicles: number; busesLive: number };
  attention: {
    unmarkedSections: number | null;
    overdueInvoices: number;
    overdueAmount: number;
    overdueBooks: number;
    lowAttendanceTotal: number;
    lowAttendance: { id: string; name: string; section: string; percent: number }[];
  };
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
};

function daysBefore(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Everything the admin dashboard needs, as plain data for the interactive client view. */
export async function getDashboardData(db: TenantDb, schoolId: string): Promise<DashboardData> {
  const t = today();
  const attendanceSince = daysBefore(t, 75);
  const lowSince = daysBefore(t, 30);
  const isSunday = new Date(`${t}T12:00:00Z`).getUTCDay() === 0;

  const [school, classes, subjects, classSubjects, teachers, routes, routeUse, students, staff, vehicles, busesLive, overdueBooks, holidayToday, exam] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, maxStudents: true } }),
    db.class.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        sections: { orderBy: { name: "asc" }, select: { id: true, name: true, classTeacherId: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } } },
      },
    }),
    db.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.classSubject.findMany({ select: { classId: true, subjectId: true, teacherId: true } }),
    db.staff.findMany({ where: { active: true }, select: { id: true, name: true, designation: true } }),
    db.busRoute.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, _count: { select: { stops: true } } } }),
    prisma.$queryRaw<{ routeId: string; classId: string; riders: number }[]>`
      SELECT bs."routeId", sec."classId", count(*)::int AS riders
      FROM "Student" s
      JOIN "BusStop" bs ON bs.id = s."busStopId"
      JOIN "Section" sec ON sec.id = s."sectionId"
      WHERE s."schoolId" = ${schoolId} AND s.status = 'ACTIVE'
      GROUP BY 1, 2`,
    db.student.count({ where: { status: "ACTIVE" } }),
    db.staff.count({ where: { active: true } }),
    db.vehicle.count(),
    db.vehicle.count({ where: { tripActive: true } }),
    db.bookIssue.count({ where: { returnedOn: null, dueOn: { lt: t } } }),
    db.schoolEvent.findFirst({ where: { type: "HOLIDAY", date: { lte: t }, OR: [{ endDate: { gte: t } }, { endDate: null, date: t }] }, select: { id: true } }),
    db.exam.findFirst({ where: { schedules: { some: { marks: { some: {} } } } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
  ]);

  const [attendance, fees, feeMonths, examRows, overdue, markedToday, low] = await Promise.all([
    prisma.$queryRaw<DashboardData["attendance"]>`
      SELECT sec."classId", a.date, count(*) FILTER (WHERE a.status IN ('PRESENT', 'LATE'))::int AS present, count(*)::int AS marked
      FROM "Attendance" a
      JOIN "Section" sec ON sec.id = a."sectionId"
      WHERE a."schoolId" = ${schoolId} AND a.date >= ${attendanceSince}
      GROUP BY 1, 2
      ORDER BY 2`,
    prisma.$queryRaw<DashboardData["fees"]>`
      SELECT sec."classId",
             sum(i.amount - i.discount)::float8 AS billed,
             coalesce(sum(p.paid), 0)::float8 AS collected
      FROM "FeeInvoice" i
      JOIN "Student" s ON s.id = i."studentId"
      LEFT JOIN "Section" sec ON sec.id = s."sectionId"
      LEFT JOIN (SELECT "invoiceId", sum(amount) AS paid FROM "FeePayment" WHERE "schoolId" = ${schoolId} GROUP BY 1) p ON p."invoiceId" = i.id
      WHERE i."schoolId" = ${schoolId}
      GROUP BY 1`,
    prisma.$queryRaw<DashboardData["feeMonths"]>`
      SELECT sec."classId", substr(p."paidOn", 1, 7) AS month, sum(p.amount)::float8 AS amount
      FROM "FeePayment" p
      JOIN "FeeInvoice" i ON i.id = p."invoiceId"
      JOIN "Student" s ON s.id = i."studentId"
      LEFT JOIN "Section" sec ON sec.id = s."sectionId"
      WHERE p."schoolId" = ${schoolId} AND p."paidOn" >= ${daysBefore(t, 200)}
      GROUP BY 1, 2
      ORDER BY 2`,
    exam
      ? prisma.$queryRaw<NonNullable<DashboardData["exam"]>["rows"]>`
          SELECT es."classId",
                 count(*) FILTER (WHERE NOT m.absent AND m."marksObtained" >= es."passMarks")::int AS passed,
                 count(*)::int AS total,
                 coalesce(avg(m."marksObtained" / es."maxMarks" * 100), 0)::float8 AS average
          FROM "Mark" m
          JOIN "ExamSchedule" es ON es.id = m."examScheduleId"
          WHERE m."schoolId" = ${schoolId} AND es."examId" = ${exam.id}
          GROUP BY 1`
      : Promise.resolve([]),
    prisma.$queryRaw<{ invoices: number; amount: number }[]>`
      SELECT count(*)::int AS invoices, coalesce(sum(balance), 0)::float8 AS amount
      FROM (
        SELECT i.amount - i.discount - coalesce(sum(p.amount), 0) AS balance
        FROM "FeeInvoice" i
        LEFT JOIN "FeePayment" p ON p."invoiceId" = i.id
        WHERE i."schoolId" = ${schoolId} AND i."dueDate" < ${t}
        GROUP BY i.id
      ) x
      WHERE balance > 0.001`,
    prisma.$queryRaw<{ sections: number }[]>`
      SELECT count(DISTINCT "sectionId")::int AS sections FROM "Attendance" WHERE "schoolId" = ${schoolId} AND date = ${t}`,
    prisma.$queryRaw<{ id: string; firstName: string; lastName: string; className: string; sectionName: string; percent: number; total: number }[]>`
      SELECT s.id, s."firstName", s."lastName", c.name AS "className", sec.name AS "sectionName",
             r.percent, count(*) OVER ()::int AS total
      FROM (
        SELECT "studentId", count(*) FILTER (WHERE status IN ('PRESENT', 'LATE'))::float8 / count(*) * 100 AS percent
        FROM "Attendance"
        WHERE "schoolId" = ${schoolId} AND date >= ${lowSince}
        GROUP BY 1
        HAVING count(*) >= 5
      ) r
      JOIN "Student" s ON s.id = r."studentId"
      JOIN "Section" sec ON sec.id = s."sectionId"
      JOIN "Class" c ON c.id = sec."classId"
      WHERE r.percent < 75 AND s.status = 'ACTIVE'
      ORDER BY r.percent
      LIMIT 5`,
  ]);

  const totalSections = classes.reduce((a, c) => a + c.sections.length, 0);
  const sectionsWithStudents = classes.reduce((a, c) => a + c.sections.filter((s) => s._count.students > 0).length, 0);

  // ---- Knowledge graph: how classes, sections, subjects, teachers and buses connect.
  const teacherById = new Map(teachers.map((s) => [s.id, s]));
  const usedTeachers = new Set<string>();
  const edges: GraphEdge[] = [];
  const schoolNode = "school";
  const classStudents = new Map<string, number>();

  for (const c of classes) {
    classStudents.set(c.id, c.sections.reduce((a, s) => a + s._count.students, 0));
    edges.push({ source: schoolNode, target: `c:${c.id}`, relation: "Runs class" });
    for (const s of c.sections) {
      edges.push({ source: `c:${c.id}`, target: `s:${s.id}`, relation: "Has section" });
      if (s.classTeacherId && teacherById.has(s.classTeacherId)) {
        usedTeachers.add(s.classTeacherId);
        edges.push({ source: `s:${s.id}`, target: `t:${s.classTeacherId}`, relation: "Class teacher" });
      }
    }
  }
  const taught = new Set<string>();
  for (const cs of classSubjects) {
    edges.push({ source: `c:${cs.classId}`, target: `j:${cs.subjectId}`, relation: "Studies" });
    if (!cs.teacherId || !teacherById.has(cs.teacherId)) continue;
    usedTeachers.add(cs.teacherId);
    const pair = `${cs.subjectId}|${cs.teacherId}`;
    if (!taught.has(pair)) {
      taught.add(pair);
      edges.push({ source: `j:${cs.subjectId}`, target: `t:${cs.teacherId}`, relation: "Taught by" });
    }
  }
  for (const r of routeUse) {
    edges.push({ source: `r:${r.routeId}`, target: `c:${r.classId}`, relation: `Carries ${r.riders} students from` });
  }

  const nodes: GraphNode[] = [
    { id: schoolNode, label: school.name, type: "school", meta: `${students} students · ${totalSections} sections`, href: "/app/settings" },
    ...classes.map((c) => ({ id: `c:${c.id}`, label: c.name, type: "class" as const, meta: `${classStudents.get(c.id) ?? 0} students · ${c.sections.length} sections`, href: "/app/students" })),
    ...classes.flatMap((c) =>
      c.sections.map((s) => ({
        id: `s:${s.id}`,
        label: `${c.name.replace("Class ", "")}${s.name}`,
        type: "section" as const,
        meta: `${c.name} section ${s.name} · ${s._count.students} students`,
        href: `/app/attendance?section=${s.id}`,
      })),
    ),
    ...subjects.map((s) => ({ id: `j:${s.id}`, label: s.name, type: "subject" as const, meta: "Subject", href: "/app/academics" })),
    ...[...usedTeachers].map((id) => ({ id: `t:${id}`, label: teacherById.get(id)!.name, type: "teacher" as const, meta: teacherById.get(id)!.designation, href: "/app/staff" })),
    ...routes.map((r) => ({ id: `r:${r.id}`, label: r.name, type: "route" as const, meta: `${r._count.stops} stops`, href: "/app/transport" })),
  ];

  return {
    today: t,
    classes: classes.map((c) => ({ id: c.id, name: c.name, students: classStudents.get(c.id) ?? 0, sections: c.sections.length })),
    attendance,
    fees,
    feeMonths,
    exam: exam ? { name: exam.name, rows: examRows } : null,
    totals: { students, staff, sections: totalSections, maxStudents: school.maxStudents, vehicles, busesLive },
    attention: {
      unmarkedSections: isSunday || holidayToday ? null : Math.max(0, sectionsWithStudents - (markedToday[0]?.sections ?? 0)),
      overdueInvoices: overdue[0]?.invoices ?? 0,
      overdueAmount: overdue[0]?.amount ?? 0,
      overdueBooks,
      lowAttendanceTotal: low[0]?.total ?? 0,
      lowAttendance: low.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), section: `${s.className.replace("Class ", "")}${s.sectionName}`, percent: Math.round(s.percent * 10) / 10 })),
    },
    graph: { nodes, edges },
  };
}
