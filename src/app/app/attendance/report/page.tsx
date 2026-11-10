import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { Card, Empty, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { teachableSectionIds } from "@/lib/permissions";
import { monthDays, pct, today } from "@/lib/utils";

const CODE: Record<string, [string, string]> = {
  PRESENT: ["P", "text-emerald-600"],
  ABSENT: ["A", "bg-rose-100 text-rose-700 font-semibold"],
  LATE: ["L", "text-amber-600"],
  LEAVE: ["Lv", "text-sky-600"],
};

export default async function AttendanceReport({ searchParams }: PageProps<"/app/attendance/report">) {
  const { db, user } = await requireSchoolUser(["ADMIN", "TEACHER"]);
  const sp = await searchParams;
  const allowed = await teachableSectionIds(db, user);
  const sections = await db.section.findMany({
    where: allowed === "ALL" ? {} : { id: { in: allowed } },
    include: { class: true },
    orderBy: [{ class: { order: "asc" } }, { name: "asc" }],
  });
  const sectionId = typeof sp.section === "string" && sections.some((s) => s.id === sp.section) ? sp.section : sections[0]?.id;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today().slice(0, 7);
  const days = monthDays(month);
  const section = sections.find((s) => s.id === sectionId);

  const students = sectionId
    ? await db.student.findMany({
        where: { sectionId, status: "ACTIVE" },
        include: { attendance: { where: { date: { startsWith: month } } } },
        orderBy: [{ rollNo: "asc" }, { firstName: "asc" }],
      })
    : [];
  const workingDays = new Set(students.flatMap((s) => s.attendance.map((a) => a.date)));

  // Section-wise summary for the month (admin overview).
  const summary = await db.attendance.groupBy({ by: ["sectionId", "status"], where: { date: { startsWith: month }, sectionId: { in: sections.map((s) => s.id) } }, _count: true });
  const secStats = sections.map((s) => {
    const rows = summary.filter((r) => r.sectionId === s.id);
    const total = rows.reduce((a, r) => a + r._count, 0);
    const present = rows.filter((r) => r.status !== "ABSENT").reduce((a, r) => a + r._count, 0);
    return { s, total, p: pct(present, total) };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance register"
        subtitle={`${section ? `${section.class.name} – ${section.name}` : ""} · ${new Date(month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })} · ${workingDays.size} working days`}
        actions={<PrintButton />}
      />
      <Card className="no-print">
        <form className="flex flex-wrap items-end gap-2">
          <label><span className="label">Section</span>
            <select name="section" defaultValue={sectionId} className="input w-52">
              {sections.map((s) => <option key={s.id} value={s.id}>{s.class.name} – {s.name}</option>)}
            </select>
          </label>
          <label><span className="label">Month</span><input type="month" name="month" defaultValue={month} className="input" /></label>
          <button className="btn-secondary">Show</button>
        </form>
      </Card>

      <Card>
        {students.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 bg-slate-50 px-2 py-2 text-left">Student</th>
                  {days.map((d) => <th key={d} className="w-7 px-0.5 py-2 text-center font-medium text-slate-500">{Number(d.slice(8))}</th>)}
                  <th className="px-2">P</th><th className="px-2">A</th><th className="px-2">%</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const map = new Map(s.attendance.map((a) => [a.date, a.status]));
                  const absent = s.attendance.filter((a) => a.status === "ABSENT").length;
                  const present = s.attendance.length - absent;
                  const p = pct(present, s.attendance.length);
                  return (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="sticky left-0 whitespace-nowrap bg-surface px-2 py-1.5">
                        <Link href={`/app/students/${s.id}`} className="hover:underline">{s.rollNo}. {s.firstName} {s.lastName}</Link>
                      </td>
                      {days.map((d) => {
                        const st = map.get(d);
                        const [c, cl] = st ? CODE[st] : ["", ""];
                        return <td key={d} className={`text-center ${cl}`}>{c || (new Date(d + "T00:00:00").getDay() === 0 ? <span className="text-slate-300">·</span> : "")}</td>;
                      })}
                      <td className="px-2 text-center">{present}</td>
                      <td className="px-2 text-center">{absent}</td>
                      <td className={`px-2 text-center font-semibold ${p < 75 ? "text-rose-600" : ""}`}>{s.attendance.length ? p : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">P = present, A = absent, L = late, Lv = leave. Students below 75% are highlighted.</p>
          </div>
        ) : (
          <Empty>No students.</Empty>
        )}
      </Card>

      <Card title="Section summary for the month" className="no-print">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {secStats.map(({ s, total, p }) => (
            <Link key={s.id} href={`?section=${s.id}&month=${month}`} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <div className="text-sm font-medium">{s.class.name} – {s.name}</div>
              <div className={`text-xl font-semibold ${total && p < 75 ? "text-rose-600" : ""}`}>{total ? `${p}%` : "—"}</div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
