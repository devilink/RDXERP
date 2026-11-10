import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { LMS_ROLES } from "@/lib/constants";
import { Badge, Card, Empty, PageHeader, Table } from "@/components/ui";
import { ChildPicker, NO_CHILD } from "@/components/lms";
import { lmsAudience } from "@/lib/lms";

export default async function QuizzesPage({ searchParams }: PageProps<"/app/lms/quizzes">) {
  const { db, user } = await requireSchoolUser(LMS_ROLES);
  const sp = await searchParams;
  const audience = await lmsAudience(db, user, sp.child);
  const { child, childQuery: q } = audience;
  if (audience.family && !child) return <Empty>{NO_CHILD}</Empty>;

  const quizzes = await db.quiz.findMany({
    where: { course: audience.courseWhere, ...(audience.family ? { published: true } : {}) },
    include: {
      course: { include: { section: { include: { class: true } } } },
      attempts: child ? { where: { studentId: child.id } } : { select: { id: true, score: true, total: true } },
      _count: { select: { questions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Quizzes" subtitle={audience.family ? "Multiple-choice quizzes, marked automatically" : "Results across your courses"} actions={audience.family ? <ChildPicker kids={audience.kids} currentId={child?.id} /> : undefined} />
      {quizzes.length ? (
        <Card>
          {audience.family ? (
            <Table head={["Quiz", "Course", "Questions", "Result"]}>
              {quizzes.map((z) => (
                <tr key={z.id}>
                  <td><Link className="link" href={`/app/lms/quizzes/${z.id}${q}`}>{z.title}</Link></td>
                  <td>{z.course.title}</td>
                  <td>{z._count.questions}</td>
                  <td>{z.attempts[0] ? <Badge color="green">{z.attempts[0].score} / {z.attempts[0].total}</Badge> : <Badge>Not taken</Badge>}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Table head={["Quiz", "Course", "Section", "Questions", "Status", "Attempts"]}>
              {quizzes.map((z) => (
                <tr key={z.id}>
                  <td><Link className="link" href={`/app/lms/quizzes/${z.id}`}>{z.title}</Link></td>
                  <td>{z.course.title}</td>
                  <td>{z.course.section.class.name}-{z.course.section.name}</td>
                  <td>{z._count.questions}</td>
                  <td><Badge color={z.published ? "green" : "gray"}>{z.published ? "Published" : "Draft"}</Badge></td>
                  <td>{z.attempts.length}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
        <Empty>No quizzes yet. They are added from inside a course.</Empty>
      )}
    </div>
  );
}
