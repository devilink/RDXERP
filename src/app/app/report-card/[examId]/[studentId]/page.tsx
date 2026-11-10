import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { Empty } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { computeClassResults } from "@/lib/results";
import { getFamilyStudents } from "@/lib/family";
import { fmtDate, pct } from "@/lib/utils";

export default async function ReportCard({ params }: PageProps<"/app/report-card/[examId]/[studentId]">) {
  const { db, user, school } = await requireSchoolUser(["ADMIN", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT"]);
  const { examId, studentId } = await params;
  const family = user.role === "PARENT" || user.role === "STUDENT";

  if (family) {
    const kids = await getFamilyStudents(db, user);
    if (!kids.some((k) => k.id === studentId)) notFound();
  }
  const [exam, student] = await Promise.all([
    db.exam.findFirst({ where: { id: examId }, include: { academicYear: true } }),
    db.student.findFirst({ where: { id: studentId }, include: { section: { include: { class: true, classTeacher: true } }, guardian: true } }),
  ]);
  if (!exam || !student?.section) notFound();
  if (family && !exam.published) return <Empty>Results for {exam.name} have not been published yet.</Empty>;

  const { results, scale } = await computeClassResults(db, exam.id, student.section.classId);
  const r = results.find((x) => x.studentId === student.id);
  if (!r) notFound();

  const yearFilter = exam.academicYear ? { date: { gte: exam.academicYear.startDate, lte: exam.endDate ?? exam.academicYear.endDate } } : {};
  const att = await db.attendance.groupBy({ by: ["status"], where: { studentId, ...yearFilter }, _count: true });
  const attTotal = att.reduce((a, x) => a + x._count, 0);
  const attPresent = att.filter((x) => x.status !== "ABSENT").reduce((a, x) => a + x._count, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex justify-end"><PrintButton label="Print report card" /></div>
      <div className="card border-2 p-8" style={{ borderColor: "var(--brand)" }}>
        <header className="border-b pb-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {school.logoUrl && <img src={school.logoUrl} alt="" className="mx-auto mb-2 h-16" />}
          <h1 className="text-brand text-2xl font-bold">{school.name}</h1>
          {school.address && <p className="text-sm text-slate-500">{school.address}</p>}
          <p className="mt-2 text-lg font-semibold uppercase tracking-wide">Progress Report — {exam.name}</p>
          {exam.academicYear && <p className="text-sm text-slate-500">Academic year {exam.academicYear.name}</p>}
        </header>

        <dl className="my-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div><dt className="inline text-slate-500">Student: </dt><dd className="inline font-semibold">{r.name}</dd></div>
          <div><dt className="inline text-slate-500">Admission no: </dt><dd className="inline">{student.admissionNo}</dd></div>
          <div><dt className="inline text-slate-500">Class: </dt><dd className="inline">{student.section.class.name} – {student.section.name}</dd></div>
          <div><dt className="inline text-slate-500">Roll no: </dt><dd className="inline">{student.rollNo ?? "—"}</dd></div>
          <div><dt className="inline text-slate-500">Guardian: </dt><dd className="inline">{student.guardian?.name ?? "—"}</dd></div>
          <div><dt className="inline text-slate-500">Date of birth: </dt><dd className="inline">{fmtDate(student.dob)}</dd></div>
        </dl>

        <table className="w-full border text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="border px-3 py-2 text-left">Subject</th>
              <th className="border px-3 py-2">Max</th>
              <th className="border px-3 py-2">Pass</th>
              <th className="border px-3 py-2">Obtained</th>
              <th className="border px-3 py-2">Grade</th>
            </tr>
          </thead>
          <tbody>
            {r.subjects.map((s) => (
              <tr key={s.scheduleId}>
                <td className="border px-3 py-1.5">{s.subject}</td>
                <td className="border px-3 py-1.5 text-center">{s.maxMarks}</td>
                <td className="border px-3 py-1.5 text-center">{s.passMarks}</td>
                <td className={`border px-3 py-1.5 text-center font-medium ${s.obtained !== null && !s.passed ? "text-rose-600" : ""}`}>{s.absent ? "AB" : s.obtained ?? "—"}</td>
                <td className="border px-3 py-1.5 text-center">{s.grade}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="border px-3 py-2">Total</td>
              <td className="border px-3 py-2 text-center">{r.max}</td>
              <td className="border px-3 py-2" />
              <td className="border px-3 py-2 text-center">{r.total}</td>
              <td className="border px-3 py-2 text-center">{r.grade}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Box label="Percentage" value={`${r.percent}%`} />
          <Box label="Result" value={r.passed ? "PASS" : "FAIL"} color={r.passed ? "text-emerald-600" : "text-rose-600"} />
          <Box label="Class rank" value={r.rank ? `${r.rank} / ${results.length}` : "—"} />
          <Box label="Attendance" value={attTotal ? `${pct(attPresent, attTotal)}%` : "—"} />
        </div>
        <p className="mt-4 text-sm"><span className="text-slate-500">Remarks: </span>{r.remark}</p>

        <div className="mt-12 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t pt-2">Class Teacher{student.section.classTeacher ? <><br />{student.section.classTeacher.name}</> : null}</div>
          <div className="border-t pt-2">Principal</div>
          <div className="border-t pt-2">Parent / Guardian</div>
        </div>

        <footer className="mt-6 border-t pt-3 text-[11px] text-slate-500">
          Grading: {[...scale].sort((a, b) => b.minPercent - a.minPercent).map((g) => `${g.grade} ≥ ${g.minPercent}%`).join(" · ")}
        </footer>
      </div>
    </div>
  );
}

function Box({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${color ?? ""}`}>{value}</div>
    </div>
  );
}
