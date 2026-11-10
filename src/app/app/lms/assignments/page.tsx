import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { LMS_ROLES } from "@/lib/constants";
import { Badge, Card, Empty, PageHeader, Table } from "@/components/ui";
import { ChildPicker, NO_CHILD } from "@/components/lms";
import { isLate, lmsAudience } from "@/lib/lms";
import { fmtDate, today } from "@/lib/utils";

export default async function AssignmentsPage({ searchParams }: PageProps<"/app/lms/assignments">) {
  const { db, user } = await requireSchoolUser(LMS_ROLES);
  const sp = await searchParams;
  const audience = await lmsAudience(db, user, sp.child);
  const { child, childQuery: q } = audience;
  if (audience.family && !child) return <Empty>{NO_CHILD}</Empty>;

  const [assignments, roster] = await Promise.all([
    db.assignment.findMany({
      where: { course: audience.courseWhere },
      include: {
        course: { include: { section: { include: { class: true } } } },
        // A family member's query returns only that child's work.
        submissions: child ? { where: { studentId: child.id } } : true,
      },
      orderBy: { dueDate: "desc" },
      take: 200,
    }),
    audience.family ? [] : db.student.groupBy({ by: ["sectionId"], where: { status: "ACTIVE" }, _count: true }),
  ]);
  const size = new Map(roster.map((r) => [r.sectionId, r._count]));

  return (
    <div className="space-y-6">
      <PageHeader title="Assignments" subtitle={audience.family ? "Work set in published courses" : "Submissions across your courses"} actions={audience.family ? <ChildPicker kids={audience.kids} currentId={child?.id} /> : undefined} />
      {assignments.length ? (
        <Card>
          {audience.family ? (
            <Table head={["Assignment", "Course", "Due", "Status"]}>
              {assignments.map((a) => {
                const s = a.submissions[0];
                return (
                  <tr key={a.id}>
                    <td><Link className="link" href={`/app/lms/assignments/${a.id}${q}`}>{a.title}</Link></td>
                    <td>{a.course.title}</td>
                    <td>{fmtDate(a.dueDate)}</td>
                    <td>
                      {s?.gradedAt ? <Badge color="green">{s.marks} / {a.maxMarks}</Badge>
                        : s ? <Badge color={isLate(s.submittedAt, a.dueDate) ? "amber" : "blue"}>{isLate(s.submittedAt, a.dueDate) ? "Submitted late" : "Submitted"}</Badge>
                        : <Badge color={a.dueDate < today() ? "red" : "gray"}>{a.dueDate < today() ? "Overdue" : "To do"}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Table head={["Assignment", "Course", "Section", "Due", "Submitted", "To mark"]}>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td><Link className="link" href={`/app/lms/assignments/${a.id}`}>{a.title}</Link></td>
                  <td>{a.course.title}</td>
                  <td>{a.course.section.class.name}-{a.course.section.name}</td>
                  <td>{fmtDate(a.dueDate)}</td>
                  <td>{a.submissions.length} / {size.get(a.course.sectionId) ?? 0}</td>
                  <td>{a.submissions.filter((s) => !s.gradedAt).length}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
        <Empty>No assignments yet. They are added from inside a course.</Empty>
      )}
    </div>
  );
}
