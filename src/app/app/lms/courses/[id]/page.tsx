import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { LMS_ROLES } from "@/lib/constants";
import { Badge, Card, Empty, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { ProgressBar } from "@/components/lms";
import { addAssignment, addLesson, addQuiz, deleteAssignment, deleteCourse, deleteLesson, deleteQuiz, setCoursePublished } from "@/app/actions/lms";
import { lmsAudience } from "@/lib/lms";
import { fmtDate } from "@/lib/utils";

export default async function CoursePage({ params, searchParams }: PageProps<"/app/lms/courses/[id]">) {
  const { db, user } = await requireSchoolUser(LMS_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const audience = await lmsAudience(db, user, sp.child);
  const course = await db.course.findFirst({
    where: { AND: [audience.courseWhere, { id }] },
    include: {
      subject: true,
      teacher: true,
      section: { include: { class: true } },
      lessons: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      assignments: { orderBy: { dueDate: "asc" } },
      quizzes: { where: audience.family ? { published: true } : {}, orderBy: { createdAt: "asc" }, include: { _count: { select: { questions: true } } } },
    },
  });
  if (!course) notFound();

  const q = audience.childQuery;
  const done = new Set(
    audience.child ? (await db.lessonProgress.findMany({ where: { studentId: audience.child.id, lessonId: { in: course.lessons.map((l) => l.id) } } })).map((p) => p.lessonId) : [],
  );
  const staff = !audience.family;

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        subtitle={`${course.section.class.name}-${course.section.name} · ${course.subject?.name ?? "General"}${course.teacher ? ` · ${course.teacher.name}` : ""}`}
        actions={
          <>
            <Link className="btn-secondary" href={`/app/lms/courses${q}`}>All courses</Link>
            {staff && (
              <>
                <form action={setCoursePublished}>
                  <input type="hidden" name="id" value={course.id} />
                  <input type="hidden" name="published" value={String(!course.published)} />
                  <button className="btn-primary">{course.published ? "Move to draft" : "Publish"}</button>
                </form>
                <ConfirmForm action={deleteCourse} message="Delete this course, with its lessons, assignments, quizzes and all student work?">
                  <input type="hidden" name="id" value={course.id} />
                  <button className="btn-danger">Delete</button>
                </ConfirmForm>
              </>
            )}
          </>
        }
      />
      {staff && !course.published && <p className="text-sm text-slate-500"><Badge>Draft</Badge> Students cannot see this course until you publish it.</p>}
      {course.description && <p className="text-sm text-slate-600">{course.description}</p>}
      {audience.family && <ProgressBar done={done.size} total={course.lessons.length} />}

      <Card title="Lessons">
        {course.lessons.length ? (
          <ol className="divide-y divide-slate-100">
            {course.lessons.map((l, i) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <Link className="link" href={`/app/lms/courses/${course.id}/lessons/${l.id}${q}`}>{i + 1}. {l.title}</Link>
                {audience.family && done.has(l.id) && <Badge color="green">Done</Badge>}
                {staff && (
                  <ConfirmForm action={deleteLesson} message="Delete this lesson?">
                    <input type="hidden" name="id" value={l.id} />
                    <button className="text-xs text-rose-600 hover:underline">Delete</button>
                  </ConfirmForm>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <Empty>No lessons yet.</Empty>
        )}
        {staff && (
          <ActionForm action={addLesson} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Lesson title" className="sm:col-span-2"><input name="title" className="input" required /></Field>
            <Field label="Lesson text" className="sm:col-span-2"><textarea name="body" rows={5} className="input" /></Field>
            <Field label="Video link (YouTube plays in the lesson)"><input name="videoUrl" type="url" placeholder="https://" className="input" /></Field>
            <Field label="Resource link (notes, slides, PDF)"><input name="resourceUrl" type="url" placeholder="https://" className="input" /></Field>
            <div><Submit>Add lesson</Submit></div>
          </ActionForm>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Assignments">
          {course.assignments.length ? (
            <ul className="divide-y divide-slate-100">
              {course.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <Link className="link" href={`/app/lms/assignments/${a.id}${q}`}>{a.title}</Link>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    Due {fmtDate(a.dueDate)}
                    {staff && (
                      <ConfirmForm action={deleteAssignment} message="Delete this assignment and all submissions?">
                        <input type="hidden" name="id" value={a.id} />
                        <button className="text-rose-600 hover:underline">Delete</button>
                      </ConfirmForm>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No assignments yet.</Empty>
          )}
          {staff && (
            <ActionForm action={addAssignment} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <input type="hidden" name="courseId" value={course.id} />
              <Field label="Title" className="sm:col-span-2"><input name="title" className="input" required /></Field>
              <Field label="Instructions" className="sm:col-span-2"><textarea name="instructions" rows={3} className="input" /></Field>
              <Field label="Due date"><input name="dueDate" type="date" className="input" required /></Field>
              <Field label="Maximum marks"><input name="maxMarks" type="number" min="1" step="any" defaultValue={100} className="input" required /></Field>
              <div><Submit>Add assignment</Submit></div>
            </ActionForm>
          )}
        </Card>

        <Card title="Quizzes">
          {course.quizzes.length ? (
            <ul className="divide-y divide-slate-100">
              {course.quizzes.map((z) => (
                <li key={z.id} className="flex items-center justify-between gap-3 py-2">
                  <Link className="link" href={`/app/lms/quizzes/${z.id}${q}`}>{z.title}</Link>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    {z._count.questions} questions
                    {staff && <Badge color={z.published ? "green" : "gray"}>{z.published ? "Published" : "Draft"}</Badge>}
                    {staff && (
                      <ConfirmForm action={deleteQuiz} message="Delete this quiz and all results?">
                        <input type="hidden" name="id" value={z.id} />
                        <button className="text-rose-600 hover:underline">Delete</button>
                      </ConfirmForm>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No quizzes yet.</Empty>
          )}
          {staff && (
            <ActionForm action={addQuiz} className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
              <input type="hidden" name="courseId" value={course.id} />
              <Field label="Quiz title"><input name="title" className="input" required /></Field>
              <div><Submit>Add quiz</Submit></div>
            </ActionForm>
          )}
        </Card>
      </div>
    </div>
  );
}
