import { requireSchoolUser } from "@/lib/auth";
import { Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { StudentFields } from "@/components/student-form";
import { createStudent } from "@/app/actions/students";
import { sectionOptions, stopOptions } from "@/lib/options";

export default async function NewStudentPage() {
  const { db } = await requireSchoolUser(["ADMIN"]);
  const [sections, stops, count] = await Promise.all([sectionOptions(db), stopOptions(db), db.student.count()]);
  return (
    <div>
      <PageHeader title="New admission" subtitle="Admit a student and optionally create parent / student portal logins." />
      <ActionForm action={createStudent} className="space-y-6">
        <Card title="Student details">
          <StudentFields s={{ admissionNo: `ADM${new Date().getFullYear()}${String(count + 1).padStart(4, "0")}` }} sections={sections} stops={stops} />
        </Card>
        <Card title="Guardian">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Guardian name"><input name="guardianName" className="input" /></Field>
            <Field label="Relation"><input name="relation" defaultValue="Father" className="input" /></Field>
            <Field label="Phone (siblings share guardian by phone)"><input name="guardianPhone" className="input" /></Field>
            <Field label="Email"><input name="guardianEmail" type="email" className="input" /></Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="parentLogin" defaultChecked /> Create parent portal login (uses guardian email)</label>
        </Card>
        <Card title="Student portal login (optional)">
          <Field label="Student email" className="max-w-sm"><input name="studentEmail" type="email" className="input" /></Field>
        </Card>
        <Submit>Admit student</Submit>
      </ActionForm>
    </div>
  );
}
