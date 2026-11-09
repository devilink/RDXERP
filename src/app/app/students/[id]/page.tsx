import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { StudentFields } from "@/components/student-form";
import { StudentOverview } from "@/components/student-overview";
import { resetFamilyLogin, updateStudent } from "@/app/actions/students";
import { sectionOptions, stopOptions } from "@/lib/options";
import { prisma } from "@/lib/db";

export default async function StudentPage({ params, searchParams }: PageProps<"/app/students/[id]">) {
  const { db, user, schoolId } = await requireSchoolUser(["ADMIN", "TEACHER", "ACCOUNTANT"]);
  const { id } = await params;
  const sp = await searchParams;
  const student = await db.student.findFirst({ where: { id }, include: { guardian: true } });
  if (!student) notFound();
  const isAdmin = user.role === "ADMIN";
  const [sections, stops, studentUser, parentUser] = await Promise.all([
    sectionOptions(db),
    stopOptions(db),
    student.userId ? prisma.user.findFirst({ where: { id: student.userId, schoolId } }) : null,
    student.guardian?.userId ? prisma.user.findFirst({ where: { id: student.guardian.userId, schoolId } }) : null,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={`${student.firstName} ${student.lastName}`} subtitle={`Admission no. ${student.admissionNo}`} />
      <StudentOverview db={db} studentId={student.id} family={false} month={typeof sp.month === "string" ? sp.month : undefined} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Guardian & portal access">
          {student.guardian ? (
            <dl className="space-y-1 text-sm">
              <div><dt className="inline text-slate-500">Name: </dt><dd className="inline">{student.guardian.name} ({student.guardian.relation})</dd></div>
              <div><dt className="inline text-slate-500">Phone: </dt><dd className="inline">{student.guardian.phone ?? "—"}</dd></div>
              <div><dt className="inline text-slate-500">Parent login: </dt><dd className="inline">{parentUser?.email ?? "none"}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">No guardian recorded.</p>
          )}
          <p className="mt-1 text-sm"><span className="text-slate-500">Student login: </span>{studentUser?.email ?? "none"}</p>
          {isAdmin && (
            <div className="mt-4 space-y-3">
              {student.guardian && (
                <ActionForm action={resetFamilyLogin} className="flex flex-wrap gap-2">
                  <input type="hidden" name="studentId" value={student.id} />
                  <input type="hidden" name="which" value="PARENT" />
                  {!parentUser && <input name="email" type="email" placeholder="Parent email" defaultValue={student.guardian.email ?? ""} className="input w-48 py-1" />}
                  <Submit className="btn-secondary btn-sm">{parentUser ? "Reset parent password" : "Create parent login"}</Submit>
                </ActionForm>
              )}
              <ActionForm action={resetFamilyLogin} className="flex flex-wrap gap-2">
                <input type="hidden" name="studentId" value={student.id} />
                <input type="hidden" name="which" value="STUDENT" />
                {!studentUser && <input name="email" type="email" placeholder="Student email" className="input w-48 py-1" />}
                <Submit className="btn-secondary btn-sm">{studentUser ? "Reset student password" : "Create student login"}</Submit>
              </ActionForm>
            </div>
          )}
        </Card>
        {isAdmin && (
          <Card title="Edit student" className="lg:col-span-2">
            <ActionForm action={updateStudent} reset={false}>
              <StudentFields s={student} sections={sections} stops={stops} />
              <div className="mt-4"><Submit>Save changes</Submit></div>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
