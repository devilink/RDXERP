import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { computeClassResults } from "@/lib/results";
import { pct } from "@/lib/utils";

export default async function ResultsPage({ params, searchParams }: PageProps<"/app/exams/[id]/results">) {
  const { db } = await requireSchoolUser(["ADMIN", "TEACHER"]);
  const { id } = await params;
  const sp = await searchParams;
  const exam = await db.exam.findFirst({ where: { id } });
  if (!exam) notFound();
  const classes = await db.class.findMany({ where: { examSchedules: { some: { examId: exam.id } } }, orderBy: { order: "asc" } });
  const klass = classes.find((c) => c.id === sp.class) ?? classes[0];
  if (!klass) return <Empty>No papers scheduled for this exam yet.</Empty>;

  const { schedules, results } = await computeClassResults(db, exam.id, klass.id);
  const sorted = [...results].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || b.total - a.total);
  const passed = results.filter((r) => r.passed).length;
  const avg = results.length ? Math.round((results.reduce((a, r) => a + r.percent, 0) / results.length) * 10) / 10 : 0;
  const subjectStats = schedules.map((sc) => {
    const vals = results.map((r) => r.subjects.find((s) => s.scheduleId === sc.id)).filter((s) => s && s.obtained !== null);
    const nums = vals.map((v) => v!.obtained!);
    return {
      name: sc.subject.name,
      high: nums.length ? Math.max(...nums) : 0,
      avg: nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0,
      pass: pct(vals.filter((v) => v!.passed).length, results.length),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${exam.name} — ${klass.name} results`}
        subtitle={`${results.length} students · ${passed} passed (${pct(passed, results.length)}%) · class average ${avg}%`}
        actions={<><PrintButton label="Print tabulation" /><Link href={`/app/exams/${exam.id}`} className="btn-secondary">← Exam</Link></>}
      />
      <div className="no-print flex flex-wrap gap-2 text-sm">
        {classes.map((c) => <Link key={c.id} href={`?class=${c.id}`} className={c.id === klass.id ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{c.name}</Link>)}
      </div>

      <Card title="Tabulation sheet">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th><th>Roll</th><th>Student</th>
                {schedules.map((s) => <th key={s.id} className="text-center">{s.subject.name}<div className="font-normal normal-case">/{s.maxMarks}</div></th>)}
                <th>Total</th><th>%</th><th>Grade</th><th>Result</th><th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.studentId}>
                  <td className="font-semibold">{r.rank ?? "—"}</td>
                  <td className="text-xs">{r.section}-{r.rollNo}</td>
                  <td className="whitespace-nowrap">{r.name}</td>
                  {r.subjects.map((s) => (
                    <td key={s.scheduleId} className={`text-center ${s.obtained !== null && !s.passed ? "font-semibold text-rose-600" : ""}`}>
                      {s.absent ? "AB" : s.obtained ?? "—"}
                    </td>
                  ))}
                  <td className="font-semibold">{r.total}/{r.max}</td>
                  <td>{r.percent}</td>
                  <td>{r.grade}</td>
                  <td><Badge color={r.passed ? "green" : "red"}>{r.passed ? "PASS" : "FAIL"}</Badge></td>
                  <td className="no-print"><Link href={`/app/report-card/${exam.id}/${r.studentId}`} className="link text-xs">Report card</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Subject analysis">
        <table className="table">
          <thead><tr><th>Subject</th><th>Highest</th><th>Average</th><th>Pass %</th></tr></thead>
          <tbody>
            {subjectStats.map((s) => (
              <tr key={s.name}><td>{s.name}</td><td>{s.high}</td><td>{s.avg}</td><td>{s.pass}%</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
