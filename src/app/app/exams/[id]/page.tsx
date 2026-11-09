import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { PrintButton } from "@/components/print-button";
import { autoRoutine, deleteSchedule, saveSchedule, togglePublish } from "@/app/actions/exams";
import { fmtDate } from "@/lib/utils";

export default async function ExamPage({ params, searchParams }: PageProps<"/app/exams/[id]">) {
  const { db, user } = await requireSchoolUser(["ADMIN", "TEACHER"]);
  const { id } = await params;
  const sp = await searchParams;
  const exam = await db.exam.findFirst({ where: { id } });
  if (!exam) notFound();
  const isAdmin = user.role === "ADMIN";

  const [classes, subjects, schedules, studentCounts] = await Promise.all([
    db.class.findMany({ orderBy: { order: "asc" } }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.examSchedule.findMany({
      where: { examId: exam.id },
      include: { subject: true, class: true, _count: { select: { marks: true } } },
      orderBy: [{ class: { order: "asc" } }, { date: "asc" }, { startTime: "asc" }],
    }),
    db.student.groupBy({ by: ["sectionId"], where: { status: "ACTIVE" }, _count: true }),
  ]);
  const sections = await db.section.findMany({ select: { id: true, classId: true } });
  const perClass = new Map<string, number>();
  for (const r of studentCounts) {
    const cid = sections.find((s) => s.id === r.sectionId)?.classId;
    if (cid) perClass.set(cid, (perClass.get(cid) ?? 0) + r._count);
  }
  const classFilter = typeof sp.class === "string" ? sp.class : "";
  const shown = classFilter ? classes.filter((c) => c.id === classFilter) : classes;

  return (
    <div className="space-y-6">
      <PageHeader
        title={exam.name}
        subtitle={`${fmtDate(exam.startDate)} – ${fmtDate(exam.endDate)} · ${schedules.length} papers`}
        actions={
          <>
            <PrintButton label="Print routine" />
            {isAdmin && (
              <form action={togglePublish}>
                <input type="hidden" name="id" value={exam.id} />
                <button className={exam.published ? "btn-secondary" : "btn-primary"}>{exam.published ? "Unpublish results" : "Publish results"}</button>
              </form>
            )}
          </>
        }
      />
      <div className="no-print flex flex-wrap items-center gap-2 text-sm">
        <Badge color={exam.published ? "green" : "amber"}>{exam.published ? "Results visible to students & parents" : "Results hidden (draft)"}</Badge>
        <span className="text-slate-400">|</span>
        <Link href={`?`} className={!classFilter ? "font-semibold" : "link"}>All classes</Link>
        {classes.map((c) => <Link key={c.id} href={`?class=${c.id}`} className={classFilter === c.id ? "font-semibold" : "link"}>{c.name}</Link>)}
      </div>

      {isAdmin && (
        <div className="no-print grid gap-6 lg:grid-cols-2">
          <Card title="Auto-generate routine">
            <ActionForm action={autoRoutine} className="grid grid-cols-2 gap-3">
              <input type="hidden" name="examId" value={exam.id} />
              <Field label="Class">
                <select name="classId" className="input"><option value="ALL">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </Field>
              <Field label="First paper date"><input name="startDate" type="date" defaultValue={exam.startDate ?? ""} className="input" required /></Field>
              <Field label="Start time"><input name="startTime" type="time" defaultValue="10:00" className="input" /></Field>
              <Field label="End time"><input name="endTime" type="time" defaultValue="13:00" className="input" /></Field>
              <Field label="Max / pass marks"><div className="flex gap-1"><input name="maxMarks" type="number" defaultValue={100} className="input" /><input name="passMarks" type="number" defaultValue={33} className="input" /></div></Field>
              <Field label="Days between papers"><input name="gap" type="number" min={1} defaultValue={1} className="input" /></Field>
              <p className="col-span-2 text-xs text-slate-500">One paper per day for each subject assigned to the class; Sundays and holidays are skipped. Existing rows are updated.</p>
              <div className="col-span-2"><Submit>Generate</Submit></div>
            </ActionForm>
          </Card>
          <Card title="Add / edit a paper">
            <ActionForm action={saveSchedule} className="grid grid-cols-2 gap-3">
              <input type="hidden" name="examId" value={exam.id} />
              <Field label="Class"><select name="classId" className="input" required>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Subject"><select name="subjectId" className="input" required>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Date"><input name="date" type="date" className="input" required /></Field>
              <Field label="Room"><input name="room" className="input" /></Field>
              <Field label="Start"><input name="startTime" type="time" defaultValue="10:00" className="input" /></Field>
              <Field label="End"><input name="endTime" type="time" defaultValue="13:00" className="input" /></Field>
              <Field label="Max marks"><input name="maxMarks" type="number" defaultValue={100} className="input" /></Field>
              <Field label="Pass marks"><input name="passMarks" type="number" defaultValue={33} className="input" /></Field>
              <div className="col-span-2"><Submit>Save paper</Submit></div>
            </ActionForm>
          </Card>
        </div>
      )}

      {shown.map((c) => {
        const rows = schedules.filter((s) => s.classId === c.id);
        const total = perClass.get(c.id) ?? 0;
        return (
          <Card
            key={c.id}
            title={`${c.name} — exam routine`}
            actions={rows.length > 0 && <Link className="btn-secondary btn-sm no-print" href={`/app/exams/${exam.id}/results?class=${c.id}`}>Results & ranks →</Link>}
          >
            {rows.length ? (
              <Table head={["Date", "Day", "Subject", "Time", "Room", "Max / Pass", <span key="m" className="no-print">Marks entered</span>, ""]}>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td>{new Date(r.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" })}</td>
                    <td className="font-medium">{r.subject.name}</td>
                    <td className="whitespace-nowrap">{r.startTime} – {r.endTime}</td>
                    <td>{r.room ?? "—"}</td>
                    <td>{r.maxMarks} / {r.passMarks}</td>
                    <td className="no-print">
                      <Badge color={r._count.marks >= total && total > 0 ? "green" : r._count.marks ? "amber" : "gray"}>{r._count.marks}/{total}</Badge>
                    </td>
                    <td className="no-print whitespace-nowrap text-right">
                      <Link href={`/app/exams/${exam.id}/marks/${r.id}`} className="link mr-3 text-xs">Enter marks</Link>
                      {isAdmin && (
                        <ConfirmForm action={deleteSchedule} message="Remove this paper and its marks?" className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-xs text-rose-600 hover:underline">Remove</button>
                        </ConfirmForm>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>No papers scheduled for {c.name}.</Empty>
            )}
          </Card>
        );
      })}
    </div>
  );
}
