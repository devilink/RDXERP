import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { LMS_ROLES } from "@/lib/constants";
import { Card, Empty, PageHeader, Stat, Table } from "@/components/ui";
import { ChildPicker, NO_CHILD } from "@/components/lms";
import { lmsAudience } from "@/lib/lms";
import { fmtDate, fullName, pct, today } from "@/lib/utils";

export default async function LmsOverviewPage({ searchParams }: PageProps<"/app/lms">) {
  const { db, user } = await requireSchoolUser(LMS_ROLES);
  const sp = await searchParams;
  const audience = await lmsAudience(db, user, sp.child);
  const { courseWhere } = audience;

  if (audience.family) {
    const { child, kids, childQuery: q } = audience;
    if (!child) return <Empty>{NO_CHILD}</Empty>;
    const [courseCount, lessonCount, doneCount, upcoming, quizzes] = await Promise.all([
      db.course.count({ where: courseWhere }),
      db.lesson.count({ where: { course: courseWhere } }),
      db.lessonProgress.count({ where: { studentId: child.id, lesson: { course: courseWhere } } }),
      db.assignment.findMany({
        where: { course: courseWhere, dueDate: { gte: today() }, submissions: { none: { studentId: child.id } } },
        include: { course: true },
        orderBy: { dueDate: "asc" },
        take: 8,
      }),
      db.quiz.count({ where: { course: courseWhere, published: true, attempts: { none: { studentId: child.id } } } }),
    ]);
    return (
      <div className="space-y-6">
        <PageHeader title="Learning" subtitle={`${child.firstName}'s courses and coursework`} actions={<ChildPicker kids={kids} currentId={child.id} />} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Courses" value={courseCount} href={`/app/lms/courses${q}`} tone="violet" />
          <Stat label="Lessons done" value={`${pct(doneCount, lessonCount)}%`} hint={`${doneCount} of ${lessonCount}`} tone="green" />
          <Stat label="Assignments to do" value={upcoming.length} href={`/app/lms/assignments${q}`} tone="amber" />
          <Stat label="Quizzes to take" value={quizzes} href={`/app/lms/quizzes${q}`} tone="teal" />
        </div>
        <Card title="Coming up">
          {upcoming.length ? (
            <Table head={["Assignment", "Course", "Due"]}>
              {upcoming.map((a) => (
                <tr key={a.id}>
                  <td><Link className="link" href={`/app/lms/assignments/${a.id}${q}`}>{a.title}</Link></td>
                  <td>{a.course.title}</td>
                  <td>{fmtDate(a.dueDate)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>Nothing due right now.</Empty>
          )}
        </Card>
      </div>
    );
  }

  const [courses, published, toGrade, quizzes, pending] = await Promise.all([
    db.course.count({ where: courseWhere }),
    db.course.count({ where: { AND: [courseWhere, { published: true }] } }),
    db.submission.count({ where: { gradedAt: null, assignment: { course: courseWhere } } }),
    db.quiz.count({ where: { course: courseWhere } }),
    db.submission.findMany({
      where: { gradedAt: null, assignment: { course: courseWhere } },
      include: { student: true, assignment: { include: { course: true } } },
      orderBy: { submittedAt: "asc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Learning" subtitle="Courses, coursework and marking" actions={<Link className="btn-primary" href="/app/lms/courses">Manage courses</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Courses" value={courses} href="/app/lms/courses" tone="violet" />
        <Stat label="Published" value={published} hint="Visible to students" tone="green" />
        <Stat label="Waiting to mark" value={toGrade} href="/app/lms/assignments" tone="amber" />
        <Stat label="Quizzes" value={quizzes} href="/app/lms/quizzes" tone="teal" />
      </div>
      <Card title="Waiting to mark">
        {pending.length ? (
          <Table head={["Student", "Assignment", "Course", "Submitted"]}>
            {pending.map((s) => (
              <tr key={s.id}>
                <td>{fullName(s.student)}</td>
                <td><Link className="link" href={`/app/lms/assignments/${s.assignmentId}`}>{s.assignment.title}</Link></td>
                <td>{s.assignment.course.title}</td>
                <td>{fmtDate(s.submittedAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Nothing is waiting to be marked.</Empty>
        )}
      </Card>
    </div>
  );
}
