import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { saveMarks } from "@/app/actions/exams";
import { canEnterMarks } from "@/lib/permissions";
import { fmtDate } from "@/lib/utils";

export default async function MarksPage({ params }: PageProps<"/app/exams/[id]/marks/[scheduleId]">) {
  const { db, user } = await requireSchoolUser(["ADMIN", "TEACHER"]);
  const { id, scheduleId } = await params;
  const sc = await db.examSchedule.findFirst({ where: { id: scheduleId, examId: id }, include: { exam: true, class: true, subject: true } });
  if (!sc) notFound();
  const allowed = await canEnterMarks(db, user, sc.classId, sc.subjectId);
  const locked = sc.exam.published && user.role !== "ADMIN";

  const students = await db.student.findMany({
    where: { status: "ACTIVE", section: { classId: sc.classId } },
    include: { section: true, marks: { where: { examScheduleId: sc.id } } },
    orderBy: [{ section: { name: "asc" } }, { rollNo: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Marks: ${sc.subject.name} — ${sc.class.name}`}
        subtitle={`${sc.exam.name} · ${fmtDate(sc.date)} · Max ${sc.maxMarks}, pass ${sc.passMarks}`}
        actions={<Link href={`/app/exams/${id}`} className="btn-secondary">← Back to exam</Link>}
      />
      {!allowed ? (
        <Empty>You are not assigned to teach {sc.subject.name} in {sc.class.name}.</Empty>
      ) : (
        <Card>
          {locked && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Results are published. Ask an admin to unpublish to edit marks.</p>}
          {students.length ? (
            <ActionForm action={saveMarks} reset={false}>
              <input type="hidden" name="scheduleId" value={sc.id} />
              <p className="mb-3 text-xs text-slate-500">Enter a number between 0 and {sc.maxMarks}, or <b>AB</b> for absent. Leave blank to clear.</p>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Sec</th><th>Roll</th><th>Student</th><th>Marks</th><th>Remarks</th><th>Status</th></tr></thead>
                  <tbody>
                    {students.map((s) => {
                      const m = s.marks[0];
                      const val = m ? (m.absent ? "AB" : m.marksObtained ?? "") : "";
                      const pass = m && !m.absent && (m.marksObtained ?? 0) >= sc.passMarks;
                      return (
                        <tr key={s.id}>
                          <td>{s.section?.name}</td>
                          <td>{s.rollNo}</td>
                          <td>{s.firstName} {s.lastName}</td>
                          <td><input name={`m_${s.id}`} defaultValue={String(val)} disabled={locked} className="input w-24 py-1" inputMode="decimal" /></td>
                          <td><input name={`r_${s.id}`} defaultValue={m?.remarks ?? ""} disabled={locked} className="input py-1" /></td>
                          <td>{m ? <Badge color={m.absent ? "gray" : pass ? "green" : "red"}>{m.absent ? "Absent" : pass ? "Pass" : "Fail"}</Badge> : <span className="text-xs text-slate-400">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!locked && <div className="mt-4"><Submit>Save marks</Submit></div>}
            </ActionForm>
          ) : (
            <Empty>No students in this class.</Empty>
          )}
        </Card>
      )}
    </div>
  );
}
