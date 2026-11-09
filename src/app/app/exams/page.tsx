import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { createExam, deleteExam } from "@/app/actions/exams";
import { fmtDate } from "@/lib/utils";

export default async function ExamsPage() {
  const { db, user } = await requireSchoolUser(["ADMIN", "TEACHER"]);
  const exams = await db.exam.findMany({
    orderBy: { createdAt: "desc" },
    include: { academicYear: true, _count: { select: { schedules: true } } },
  });
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader title="Exams & Results" subtitle="Create exams, publish the routine, enter marks and publish results." />
      {isAdmin && (
        <Card title="Create exam">
          <ActionForm action={createExam} className="flex flex-wrap items-end gap-3">
            <Field label="Exam name"><input name="name" placeholder="Unit Test 2" className="input w-64" required /></Field>
            <Field label="Start date"><input name="startDate" type="date" className="input" /></Field>
            <Field label="End date"><input name="endDate" type="date" className="input" /></Field>
            <Submit>Create</Submit>
          </ActionForm>
        </Card>
      )}
      <Card>
        {exams.length ? (
          <Table head={["Exam", "Year", "Dates", "Papers", "Results", ""]}>
            {exams.map((e) => (
              <tr key={e.id}>
                <td><Link href={`/app/exams/${e.id}`} className="link">{e.name}</Link></td>
                <td>{e.academicYear?.name ?? "—"}</td>
                <td className="text-xs">{fmtDate(e.startDate)} – {fmtDate(e.endDate)}</td>
                <td>{e._count.schedules}</td>
                <td><Badge color={e.published ? "green" : "amber"}>{e.published ? "Published" : "Draft"}</Badge></td>
                <td className="text-right">
                  {isAdmin && (
                    <ConfirmForm action={deleteExam} message={`Delete ${e.name} with its routine and all marks?`}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className="text-xs text-rose-600 hover:underline">Delete</button>
                    </ConfirmForm>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No exams yet.</Empty>
        )}
      </Card>
    </div>
  );
}
