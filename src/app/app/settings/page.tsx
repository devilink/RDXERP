import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { changePasswordAction } from "@/app/actions/auth";
import { updateSchool } from "@/app/actions/misc";
import { ROLE_LABEL, type Role } from "@/lib/constants";

export default async function SettingsPage() {
  const { user, school, db } = await requireSchoolUser();
  const students = user.role === "ADMIN" ? await db.student.count({ where: { status: "ACTIVE" } }) : 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="My account">
          <p className="text-sm">{user.name} · {user.email} · <Badge color="indigo">{ROLE_LABEL[user.role as Role]}</Badge></p>
          <ActionForm action={changePasswordAction} className="mt-4 space-y-3">
            <Field label="Current password"><input name="current" type="password" className="input" required autoComplete="current-password" /></Field>
            <Field label="New password (min 8 characters)"><input name="next" type="password" minLength={8} className="input" required autoComplete="new-password" /></Field>
            <Submit>Change password</Submit>
          </ActionForm>
        </Card>
        {user.role === "ADMIN" && (
          <Card title="School profile & branding">
            <p className="mb-3 text-sm text-slate-500">Plan: <Badge color="green">{school.plan}</Badge> · {students}/{school.maxStudents} students · code <span className="font-mono">{school.code}</span></p>
            <ActionForm action={updateSchool} reset={false} className="grid gap-3 sm:grid-cols-2">
              <Field label="School name" className="sm:col-span-2"><input name="name" defaultValue={school.name} className="input" required /></Field>
              <Field label="Address" className="sm:col-span-2"><input name="address" defaultValue={school.address ?? ""} className="input" /></Field>
              <Field label="Phone"><input name="phone" defaultValue={school.phone ?? ""} className="input" /></Field>
              <Field label="Email"><input name="email" defaultValue={school.email ?? ""} className="input" /></Field>
              <Field label="Logo URL (https)"><input name="logoUrl" defaultValue={school.logoUrl ?? ""} className="input" /></Field>
              <Field label="Brand colour"><input name="primaryColor" type="color" defaultValue={school.primaryColor} className="h-10 w-full rounded-lg border" /></Field>
              <div><Submit>Save</Submit></div>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
