import Link from "next/link";
import type { TenantDb } from "@/lib/db";
import { Badge, Card, Empty, STATUS_COLOR, Table } from "@/components/ui";
import { fmtDate, money, monthDays, pct, today } from "@/lib/utils";
import { computeClassResults } from "@/lib/results";
import { DAYS } from "@/lib/constants";

/**
 * Read-only 360° view of one student. Used by staff (student profile) and by
 * parents/students (My Child). `family` hides unpublished exam results.
 */
export async function StudentOverview({ db, studentId, family, month }: { db: TenantDb; studentId: string; family: boolean; month?: string }) {
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : today().slice(0, 7);
  const student = await db.student.findFirst({
    where: { id: studentId },
    include: { section: { include: { class: true } }, busStop: { include: { route: { include: { vehicles: true } } } } },
  });
  if (!student) return <Empty>Student not found.</Empty>;
  const classId = student.section?.classId;

  const [att, allAtt, invoices, exams, upcoming, homework, issues] = await Promise.all([
    db.attendance.findMany({ where: { studentId, date: { startsWith: m } } }),
    db.attendance.groupBy({ by: ["status"], where: { studentId }, _count: true }),
    db.feeInvoice.findMany({ where: { studentId }, include: { payments: true }, orderBy: { dueDate: "desc" } }),
    classId
      ? db.exam.findMany({ where: { ...(family ? { published: true } : {}), schedules: { some: { classId } } }, orderBy: { startDate: "desc" } })
      : [],
    classId
      ? db.examSchedule.findMany({ where: { classId, date: { gte: today() } }, include: { subject: true, exam: true }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 12 })
      : [],
    student.sectionId
      ? db.homework.findMany({ where: { sectionId: student.sectionId, dueDate: { gte: today() } }, include: { subject: true }, orderBy: { dueDate: "asc" } })
      : [],
    db.bookIssue.findMany({ where: { studentId, returnedOn: null }, include: { book: true } }),
  ]);

  const examResults = await Promise.all(
    exams.map(async (e) => {
      const { results } = await computeClassResults(db, e.id, classId!);
      return { exam: e, r: results.find((x) => x.studentId === studentId), outOf: results.length };
    }),
  );

  const byDate = new Map(att.map((a) => [a.date, a.status]));
  const totalAll = allAtt.reduce((a, r) => a + r._count, 0);
  const presentAll = allAtt.filter((r) => r.status !== "ABSENT").reduce((a, r) => a + r._count, 0);
  const monthPresent = att.filter((a) => a.status !== "ABSENT").length;
  const firstDow = new Date(m + "-01T00:00:00").getDay();
  const vehicle = student.busStop?.route.vehicles[0];

  const fees = invoices.map((i) => {
    const paid = i.payments.reduce((a, p) => a + p.amount, 0);
    const due = i.amount - i.discount - paid;
    return { ...i, paid, due, status: due <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : i.dueDate < today() ? "OVERDUE" : "DUE" };
  });
  const totalDue = fees.reduce((a, f) => a + Math.max(0, f.due), 0);
  const prev = new Date(m + "-01T00:00:00"); prev.setMonth(prev.getMonth() - 1);
  const next = new Date(m + "-01T00:00:00"); next.setMonth(next.getMonth() + 1);
  const mk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card"><div className="label">Class</div><div className="text-lg font-semibold">{student.section ? `${student.section.class.name} – ${student.section.name}` : "—"}</div><div className="text-xs text-slate-500">Roll {student.rollNo ?? "—"} · Adm. {student.admissionNo}</div></div>
        <div className="card"><div className="label">Overall attendance</div><div className="text-lg font-semibold">{totalAll ? `${pct(presentAll, totalAll)}%` : "—"}</div><div className="text-xs text-slate-500">{presentAll}/{totalAll} days</div></div>
        <div className="card"><div className="label">Fee dues</div><div className={`text-lg font-semibold ${totalDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>{money(totalDue)}</div></div>
        <div className="card">
          <div className="label">School bus</div>
          {student.busStop ? (
            <>
              <div className="text-sm font-semibold">{student.busStop.route.name}</div>
              <div className="text-xs text-slate-500">{student.busStop.name} · pickup {student.busStop.pickupTime ?? "—"}{vehicle ? ` · ${vehicle.regNo}` : ""}</div>
              {family && <Link href={`/app/transport/live?child=${student.id}`} className="link text-xs">Track live →</Link>}
            </>
          ) : (
            <div className="text-sm text-slate-500">Not using transport</div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title={`Attendance — ${new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`}
          actions={
            <div className="flex gap-1 text-sm">
              <Link className="btn-secondary btn-sm" href={`?child=${student.id}&month=${mk(prev)}`}>‹</Link>
              <Link className="btn-secondary btn-sm" href={`?child=${student.id}&month=${mk(next)}`}>›</Link>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="font-medium text-slate-400">{d}</div>)}
            {Array.from({ length: firstDow }).map((_, i) => <div key={"b" + i} />)}
            {monthDays(m).map((d) => {
              const s = byDate.get(d);
              const c = s === "PRESENT" ? "bg-emerald-100 text-emerald-800" : s === "ABSENT" ? "bg-rose-100 text-rose-700" : s === "LATE" ? "bg-amber-100 text-amber-800" : s === "LEAVE" ? "bg-sky-100 text-sky-700" : "bg-slate-50 text-slate-400";
              return <div key={d} title={s ?? "Not marked"} className={`rounded-md py-2 ${c}`}>{Number(d.slice(8))}</div>;
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
            <span>Present/late/leave: {monthPresent}</span><span>Absent: {att.length - monthPresent}</span>
            <span>Month: {att.length ? `${pct(monthPresent, att.length)}%` : "—"}</span>
          </div>
        </Card>

        <Card title="Exam results">
          {examResults.length ? (
            <Table head={["Exam", "Total", "%", "Grade", "Rank", ""]}>
              {examResults.map(({ exam, r, outOf }) => (
                <tr key={exam.id}>
                  <td>{exam.name} {!exam.published && <Badge color="amber">Unpublished</Badge>}</td>
                  <td>{r ? `${r.total}/${r.max}` : "—"}</td>
                  <td>{r?.percent ?? "—"}</td>
                  <td>{r ? <Badge color={r.passed ? "green" : "red"}>{r.grade}</Badge> : "—"}</td>
                  <td>{r?.rank ? `${r.rank}/${outOf}` : "—"}</td>
                  <td><Link className="link text-xs" href={`/app/report-card/${exam.id}/${student.id}`}>Report card</Link></td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No results yet.</Empty>
          )}
        </Card>

        <Card title="Upcoming exam routine">
          {upcoming.length ? (
            <Table head={["Date", "Exam", "Subject", "Time", "Room"]}>
              {upcoming.map((u) => (
                <tr key={u.id}>
                  <td className="whitespace-nowrap">{fmtDate(u.date)} <span className="text-xs text-slate-400">{DAYS[new Date(u.date + "T00:00:00").getDay()]?.slice(0, 3) || "Sun"}</span></td>
                  <td className="text-xs">{u.exam.name}</td>
                  <td className="font-medium">{u.subject.name}</td>
                  <td className="whitespace-nowrap">{u.startTime}–{u.endTime}</td>
                  <td>{u.room ?? "—"}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No upcoming exams.</Empty>
          )}
        </Card>

        <Card title="Fees">
          {fees.length ? (
            <Table head={["Invoice", "Due date", "Amount", "Paid", "Status"]}>
              {fees.map((f) => (
                <tr key={f.id}>
                  <td><div className="text-sm">{f.title}</div><div className="font-mono text-xs text-slate-400">{f.invoiceNo}</div></td>
                  <td>{fmtDate(f.dueDate)}</td>
                  <td>{money(f.amount - f.discount)}</td>
                  <td>{money(f.paid)}</td>
                  <td><Badge color={STATUS_COLOR[f.status]}>{f.status}</Badge></td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No invoices.</Empty>
          )}
        </Card>

        <Card title="Homework due">
          {homework.length ? (
            <ul className="space-y-2 text-sm">
              {homework.map((h) => (
                <li key={h.id} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex justify-between"><span className="font-medium">{h.title}</span><span className="text-xs text-slate-500">Due {fmtDate(h.dueDate)}</span></div>
                  <div className="text-xs text-slate-500">{h.subject?.name}</div>
                  {h.description && <p className="mt-1 text-slate-600">{h.description}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No pending homework.</Empty>
          )}
        </Card>

        <Card title="Library books issued">
          {issues.length ? (
            <ul className="space-y-1 text-sm">
              {issues.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.book.title}</span>
                  <span className={i.dueOn < today() ? "text-rose-600" : "text-slate-500"}>Due {fmtDate(i.dueOn)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No books issued.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
