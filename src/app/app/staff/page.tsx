import { requireSchoolUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { createStaff, resetStaffPassword, toggleStaff } from "@/app/actions/staff";
import { fmtDate, money } from "@/lib/utils";
import { ROLE_LABEL, type Role } from "@/lib/constants";

export default async function StaffPage() {
  const { db, schoolId } = await requireSchoolUser(["ADMIN"]);
  const [staff, users] = await Promise.all([
    db.staff.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { sectionsLed: { include: { class: true } }, classSubjects: { include: { subject: true, class: true } } } }),
    prisma.user.findMany({ where: { schoolId }, select: { id: true, email: true, role: true } }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const payroll = staff.filter((s) => s.active).reduce((a, s) => a + s.salary, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" subtitle={`${staff.filter((s) => s.active).length} active · monthly payroll ${money(payroll)}`} />
      <Card title="Add staff member">
        <ActionForm action={createStaff} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Full name *"><input name="name" className="input" required /></Field>
          <Field label="Employee no *"><input name="employeeNo" defaultValue={`EMP${300 + staff.length}`} className="input" required /></Field>
          <Field label="Designation"><input name="designation" placeholder="Teacher / Driver / Clerk" className="input" /></Field>
          <Field label="Phone"><input name="phone" className="input" /></Field>
          <Field label="Email"><input name="email" type="email" className="input" /></Field>
          <Field label="Join date"><input name="joinDate" type="date" className="input" /></Field>
          <Field label="Monthly salary"><input name="salary" type="number" className="input" /></Field>
          <Field label="Portal login">
            <select name="loginRole" className="input" defaultValue="TEACHER">
              <option value="">No login</option>
              <option value="TEACHER">Teacher</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="DRIVER">Bus driver</option>
              <option value="ADMIN">School admin</option>
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-4"><Submit>Add staff</Submit></div>
        </ActionForm>
      </Card>
      <Card>
        <Table head={["Emp", "Name", "Designation", "Login", "Classes / subjects", "Joined", "Salary", "Status", ""]}>
          {staff.map((s) => {
            const u = s.userId ? userMap.get(s.userId) : null;
            return (
              <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                <td className="font-mono text-xs">{s.employeeNo}</td>
                <td><div className="font-medium">{s.name}</div><div className="text-xs text-slate-500">{s.phone}</div></td>
                <td>{s.designation}</td>
                <td className="text-xs">{u ? <>{u.email}<br /><Badge color="indigo">{ROLE_LABEL[u.role as Role]}</Badge></> : "—"}</td>
                <td className="max-w-xs text-xs text-slate-600">
                  {s.sectionsLed.map((x) => <div key={x.id}>Class teacher: {x.class.name}-{x.name}</div>)}
                  {s.classSubjects.slice(0, 4).map((x) => <span key={x.id} className="mr-1">{x.subject.name} ({x.class.name.replace("Class ", "")})</span>)}
                  {s.classSubjects.length > 4 && <span>+{s.classSubjects.length - 4}</span>}
                </td>
                <td className="text-xs">{fmtDate(s.joinDate)}</td>
                <td>{money(s.salary)}</td>
                <td><Badge color={s.active ? "green" : "gray"}>{s.active ? "Active" : "Inactive"}</Badge></td>
                <td className="space-y-1 text-right">
                  <form action={toggleStaff}><input type="hidden" name="id" value={s.id} /><button className="text-xs text-slate-600 hover:underline">{s.active ? "Deactivate" : "Activate"}</button></form>
                  {u && (
                    <ActionForm action={resetStaffPassword}>
                      <input type="hidden" name="id" value={s.id} />
                      <Submit className="text-xs text-indigo-600 hover:underline dark:text-indigo-400" pendingText="…">Reset password</Submit>
                    </ActionForm>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
