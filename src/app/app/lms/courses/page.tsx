import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { LMS_ROLES } from "@/lib/constants";
import { Badge, Card, Empty, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ChildPicker, NO_CHILD, ProgressBar } from "@/components/lms";
import { createCourse } from "@/app/actions/lms";
import { lmsAudience } from "@/lib/lms";
import { teachableSectionIds } from "@/lib/permissions";

export default async function CoursesPage({ searchParams }: PageProps<"/app/lms/courses">) {
  const { db, user } = await requireSchoolUser(LMS_ROLES);
  const sp = await searchParams;
  const audience = await lmsAudience(db, user, sp.child);
  if (audience.family && !audience.child) return <Empty>{NO_CHILD}</Empty>;

  const courses = await db.course.findMany({
    where: audience.courseWhere,
    include: { subject: true, teacher: true, section: { include: { class: true } }, lessons: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Only the family view shows progress, and only staff need the form's options.
  const done = new Map<string, number>();
  if (audience.child) {
    const rows = await db.lessonProgress.findMany({ where: { studentId: audience.child.id, lesson: { courseId: { in: courses.map((c) => c.id) } } }, select: { lesson: { select: { courseId: true } } } });
    for (const r of rows) done.set(r.lesson.courseId, (done.get(r.lesson.courseId) ?? 0) + 1);
  }
  const sectionIds = audience.family ? [] : await teachableSectionIds(db, user);
  const [sections, subjects, teachers] = audience.family
    ? [[], [], []]
    : await Promise.all([
        db.section.findMany({ where: sectionIds === "ALL" ? {} : { id: { in: sectionIds } }, include: { class: true }, orderBy: [{ class: { order: "asc" } }, { name: "asc" }] }),
        db.subject.findMany({ orderBy: { name: "asc" } }),
        db.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        subtitle={audience.family ? "Published courses for this class" : "Create courses for the sections you teach"}
        actions={audience.family ? <ChildPicker kids={audience.kids} currentId={audience.child?.id} /> : undefined}
      />
      {!audience.family && sections.length > 0 && (
        <Card title="New course">
          <ActionForm action={createCourse} className="grid gap-3 sm:grid-cols-4">
            <Field label="Section"><select name="sectionId" className="input" required>{sections.map((s) => <option key={s.id} value={s.id}>{s.class.name} – {s.name}</option>)}</select></Field>
            <Field label="Subject"><select name="subjectId" className="input"><option value="">—</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Title" className="sm:col-span-2"><input name="title" className="input" required /></Field>
            {user.role === "ADMIN" && <Field label="Teacher"><select name="teacherId" className="input"><option value="">—</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
            <Field label="Description" className={user.role === "ADMIN" ? "sm:col-span-3" : "sm:col-span-4"}><input name="description" className="input" /></Field>
            <div><Submit>Create course</Submit></div>
          </ActionForm>
        </Card>
      )}
      {courses.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Link key={c.id} href={`/app/lms/courses/${c.id}${audience.childQuery}`}>
              <Card className="h-full transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{c.title}</div>
                  {!audience.family && <Badge color={c.published ? "green" : "gray"}>{c.published ? "Published" : "Draft"}</Badge>}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {c.section.class.name}-{c.section.name} · {c.subject?.name ?? "General"}{c.teacher ? ` · ${c.teacher.name}` : ""}
                </div>
                {c.description && <p className="mt-2 text-sm text-slate-600">{c.description}</p>}
                <div className="mt-3">
                  {audience.family ? <ProgressBar done={done.get(c.id) ?? 0} total={c.lessons.length} /> : <div className="text-xs text-slate-500">{c.lessons.length} lessons</div>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Empty>{audience.family ? "No courses have been published for this class yet." : "No courses yet."}</Empty>
      )}
    </div>
  );
}
