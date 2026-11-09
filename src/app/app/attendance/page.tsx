import { requireSchoolUser } from "@/lib/auth";
import { Card, Empty, PageHeader } from "@/components/ui";
import { AttendanceSheet } from "@/components/attendance-sheet";
import { teachableSectionIds } from "@/lib/permissions";
import { fmtDate, today } from "@/lib/utils";

export default async function AttendancePage({ searchParams }: PageProps<"/app/attendance">) {
  const { db, user } = await requireSchoolUser(["ADMIN", "TEACHER"]);
  const sp = await searchParams;
  const allowed = await teachableSectionIds(db, user);
  const sections = await db.section.findMany({
    where: allowed === "ALL" ? {} : { id: { in: allowed } },
    include: { class: true },
    orderBy: [{ class: { order: "asc" } }, { name: "asc" }],
  });
  const sectionId = typeof sp.section === "string" && sections.some((s) => s.id === sp.section) ? sp.section : sections[0]?.id;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today() ? sp.date : today();

  // Status of every section for the chosen date (admin overview).
  const marked = await db.attendance.groupBy({ by: ["sectionId"], where: { date }, _count: true });
  const markedSet = new Set(marked.map((m) => m.sectionId));

  const students = sectionId
    ? await db.student.findMany({
        where: { sectionId, status: "ACTIVE" },
        include: { attendance: { where: { date } } },
        orderBy: [{ rollNo: "asc" }, { firstName: "asc" }],
      })
    : [];
  const isSunday = new Date(date + "T00:00:00").getDay() === 0;
  const holiday = await db.schoolEvent.findFirst({ where: { type: "HOLIDAY", date: { lte: date }, OR: [{ endDate: { gte: date } }, { endDate: null, date }] } });

  return (
    <div className="space-y-6">
      <PageHeader title="Mark attendance" subtitle={fmtDate(date)} />
      <Card>
        <form className="flex flex-wrap items-end gap-2">
          <label><span className="label">Section</span>
            <select name="section" defaultValue={sectionId} className="input w-52">
              {sections.map((s) => <option key={s.id} value={s.id}>{s.class.name} – {s.name} {markedSet.has(s.id) ? "✓" : ""}</option>)}
            </select>
          </label>
          <label><span className="label">Date</span><input type="date" name="date" defaultValue={date} max={today()} className="input" /></label>
          <button className="btn-secondary">Load</button>
        </form>
        {(isSunday || holiday) && (
          <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">⚠ {holiday ? `${holiday.title} (holiday)` : "Sunday"} — are you sure you want to mark attendance?</p>
        )}
      </Card>
      <Card title={sectionId ? `${students.length} students` : undefined}>
        {!sections.length ? (
          <Empty>You are not assigned to any section.</Empty>
        ) : students.length ? (
          <AttendanceSheet
            key={`${sectionId}-${date}`}
            sectionId={sectionId!}
            date={date}
            rows={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, rollNo: s.rollNo, status: s.attendance[0]?.status ?? null, note: s.attendance[0]?.note ?? null }))}
          />
        ) : (
          <Empty>No students in this section.</Empty>
        )}
      </Card>
    </div>
  );
}
