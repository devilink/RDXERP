import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { LMS_ROLES } from "@/lib/constants";
import { Badge, Card, Empty, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { gradeSubmission, submitAssignment } from "@/app/actions/lms";
import { isLate, lmsAudience } from "@/lib/lms";
import { fmtDate, fullName } from "@/lib/utils";

function Answer({ text, linkUrl }: { text: string | null; linkUrl: string | null }) {
  return (
    <>
      {text && <div className="whitespace-pre-wrap text-sm">{text}</div>}
      {linkUrl && <a className="link text-sm" href={linkUrl} target="_blank" rel="noopener noreferrer">Open link</a>}
    </>
  );
}

export default async function AssignmentPage({ params, searchParams }: PageProps<"/app/lms/assignments/[id]">) {
  const { db, user } = await requireSchoolUser(LMS_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const audience = await lmsAudience(db, user, sp.child);
  const assignment = await db.assignment.findFirst({ where: { id, course: audience.courseWhere }, include: { course: { include: { section: { include: { class: true } } } } } });
  if (!assignment) notFound();

  const header = (
    <>
      <PageHeader
        title={assignment.title}
        subtitle={`${assignment.course.title} · Due ${fmtDate(assignment.dueDate)} · ${assignment.maxMarks} marks`}
        actions={<Link className="btn-secondary" href={`/app/lms/courses/${assignment.courseId}${audience.childQuery}`}>Back to course</Link>}
      />
      {assignment.instructions && <Card title="Instructions"><div className="whitespace-pre-wrap text-sm">{assignment.instructions}</div></Card>}
    </>
  );

  if (audience.family) {
    if (!audience.child) notFound();
    const mine = await db.submission.findFirst({ where: { assignmentId: assignment.id, studentId: audience.child.id } });
    const canSubmit = user.role === "STUDENT" && !mine?.gradedAt;
    return (
      <div className="space-y-6">
        {header}
        {mine?.gradedAt && (
          <Card title="Result">
            <div className="text-2xl font-semibold">{mine.marks} / {assignment.maxMarks}</div>
            {mine.feedback && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{mine.feedback}</p>}
          </Card>
        )}
        {mine && (
          <Card title={`Submitted ${fmtDate(mine.submittedAt)}${isLate(mine.submittedAt, assignment.dueDate) ? " (late)" : ""}`}>
            <Answer text={mine.text} linkUrl={mine.linkUrl} />
          </Card>
        )}
        {canSubmit && (
          <Card title={mine ? "Update your work" : "Hand in your work"}>
            <ActionForm action={submitAssignment} reset={false} className="grid gap-3">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <Field label="Your answer"><textarea name="text" rows={6} className="input" defaultValue={mine?.text ?? ""} /></Field>
              <Field label="Link to your work (Google Doc, Drive, etc.)"><input name="linkUrl" type="url" placeholder="https://" className="input" defaultValue={mine?.linkUrl ?? ""} /></Field>
              <div><Submit pendingText="Submitting…">{mine ? "Update" : "Submit"}</Submit></div>
            </ActionForm>
          </Card>
        )}
        {!mine && user.role === "PARENT" && <Empty>{audience.child.firstName} has not handed this in yet.</Empty>}
      </div>
    );
  }

  const [students, submissions] = await Promise.all([
    db.student.findMany({ where: { sectionId: assignment.course.sectionId, status: "ACTIVE" }, orderBy: [{ rollNo: "asc" }, { firstName: "asc" }] }),
    db.submission.findMany({ where: { assignmentId: assignment.id } }),
  ]);
  const byStudent = new Map(submissions.map((s) => [s.studentId, s]));

  return (
    <div className="space-y-6">
      {header}
      <Card title={`Submissions (${submissions.length} of ${students.length})`}>
        {students.length ? (
          <Table head={["Student", "Work", "Marks and feedback"]}>
            {students.map((st) => {
              const s = byStudent.get(st.id);
              return (
                <tr key={st.id}>
                  <td className="whitespace-nowrap">
                    {fullName(st)}
                    {s && isLate(s.submittedAt, assignment.dueDate) && <div><Badge color="amber">Late</Badge></div>}
                  </td>
                  <td className="min-w-64">{s ? <Answer text={s.text} linkUrl={s.linkUrl} /> : <span className="text-sm text-slate-400">Not submitted</span>}</td>
                  <td className="min-w-72">
                    {s && (
                      <ActionForm action={gradeSubmission} reset={false} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <input name="marks" type="number" min="0" max={assignment.maxMarks} step="any" aria-label="Marks" defaultValue={s.marks ?? ""} className="input w-20!" required />
                        <input name="feedback" aria-label="Feedback" placeholder="Feedback" defaultValue={s.feedback ?? ""} className="input min-w-0 flex-1" />
                        <Submit className="btn-primary btn-sm">{s.gradedAt ? "Update" : "Save"}</Submit>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty>No active students in this section.</Empty>
        )}
      </Card>
    </div>
  );
}
