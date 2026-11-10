import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, Field, PageHeader, Stat, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { createSchool, enterSchool, resetSchoolAdmin, updateSchoolPlan } from "@/app/actions/super";
import { logoutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { fmtDate } from "@/lib/utils";

const PRICE: Record<string, number> = { BASIC: 15, STANDARD: 25, PREMIUM: 40 }; // per student / month (edit to your pricing)

export default async function SuperAdminPage() {
  const me = await requireSuperAdmin();
  const schools = await prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { students: { where: { status: "ACTIVE" } }, staff: true, users: true } } },
  });
  const active = schools.filter((s) => s.status === "ACTIVE");
  const totalStudents = schools.reduce((a, s) => a + s._count.students, 0);
  const mrr = active.reduce((a, s) => a + s._count.students * (PRICE[s.plan] ?? 0), 0);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-surface px-6 py-3">
        <div className="flex items-center gap-2 font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">🎓</span> Radix ERP · Platform console</div>
        <div className="flex items-center gap-3 text-sm">{me.email}<ThemeToggle /><form action={logoutAction}><button className="btn-secondary btn-sm">Log out</button></form></div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <PageHeader title="Schools" subtitle="Onboard schools, manage plans and subscriptions." />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Schools" tone="blue" value={schools.length} hint={`${active.length} active`} />
          <Stat label="Students (all schools)" tone="violet" value={totalStudents.toLocaleString()} />
          <Stat label="Est. monthly revenue" tone="green" value={`₹${mrr.toLocaleString("en-IN")}`} hint="students × plan price" />
          <Stat label="Suspended" tone="pink" value={schools.length - active.length} />
        </div>

        <Card title="Onboard a new school">
          <ActionForm action={createSchool} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="School name *"><input name="name" className="input" required /></Field>
            <Field label="Short code * (unique)"><input name="code" className="input" placeholder="stxaviers" required /></Field>
            <Field label="Plan">
              <select name="plan" className="input" defaultValue="STANDARD">{Object.keys(PRICE).map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <Field label="Max students"><input name="maxStudents" type="number" defaultValue={1000} className="input" /></Field>
            <Field label="Admin name"><input name="adminName" className="input" /></Field>
            <Field label="Admin email *"><input name="adminEmail" type="email" className="input" required /></Field>
            <Field label="School phone"><input name="phone" className="input" /></Field>
            <Field label="Address"><input name="address" className="input" /></Field>
            <div className="sm:col-span-2 lg:col-span-4"><Submit>Create school & admin</Submit></div>
          </ActionForm>
        </Card>

        <Card>
          <Table head={["School", "Code", "Since", "Students", "Staff", "Users", "Plan / limit / status", "Admin", "Portal"]}>
            {schools.map((s) => (
              <tr key={s.id}>
                <td><div className="font-medium">{s.name}</div><div className="text-xs text-slate-500">{s.email ?? ""}</div></td>
                <td className="font-mono text-xs">{s.code}</td>
                <td className="text-xs">{fmtDate(s.createdAt)}</td>
                <td>{s._count.students}</td>
                <td>{s._count.staff}</td>
                <td>{s._count.users}</td>
                <td>
                  <ActionForm action={updateSchoolPlan} reset={false} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={s.id} />
                    <select name="plan" defaultValue={s.plan} className="input w-28 py-1">{Object.keys(PRICE).map((p) => <option key={p}>{p}</option>)}</select>
                    <input name="maxStudents" type="number" defaultValue={s.maxStudents} className="input w-20 py-1" />
                    <select name="status" defaultValue={s.status} className="input w-28 py-1"><option>ACTIVE</option><option>SUSPENDED</option></select>
                    <Submit className="btn-secondary btn-sm" pendingText="…">Save</Submit>
                    <Badge color={s.status === "ACTIVE" ? "green" : "red"}>{s.status}</Badge>
                  </ActionForm>
                </td>
                <td>
                  <ActionForm action={resetSchoolAdmin}>
                    <input type="hidden" name="id" value={s.id} />
                    <Submit className="text-xs text-indigo-600 hover:underline dark:text-indigo-400" pendingText="…">Reset admin password</Submit>
                  </ActionForm>
                </td>
                <td>
                  <form action={enterSchool}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn-primary btn-sm whitespace-nowrap">Open portal</button>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </main>
    </div>
  );
}
