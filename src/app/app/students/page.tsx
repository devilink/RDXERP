import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { promoteSection } from "@/app/actions/students";

export default async function StudentsPage({ searchParams }: PageProps<"/app/students">) {
  const { db, user } = await requireSchoolUser(["ADMIN", "TEACHER", "ACCOUNTANT"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sectionId = typeof sp.section === "string" ? sp.section : "";
  const status = typeof sp.status === "string" ? sp.status : "ACTIVE";

  const sections = await db.section.findMany({ include: { class: true }, orderBy: [{ class: { order: "asc" } }, { name: "asc" }] });
  const students = await db.student.findMany({
    where: {
      status: status || undefined,
      sectionId: sectionId || undefined,
      ...(q
        ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { admissionNo: { contains: q, mode: "insensitive" } }, { guardian: { phone: { contains: q, mode: "insensitive" } } }] }
        : {}),
    },
    include: { section: { include: { class: true } }, guardian: true, busStop: { include: { route: true } } },
    orderBy: [{ section: { class: { order: "asc" } } }, { section: { name: "asc" } }, { rollNo: "asc" }],
    take: 500,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        subtitle={`${students.length} shown`}
        actions={user.role === "ADMIN" && <Link href="/app/students/new" className="btn-primary">+ New admission</Link>}
      />
      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Search name, admission no, parent phone…" className="input max-w-xs" />
          <select name="section" defaultValue={sectionId} className="input w-44">
            <option value="">All classes</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.class.name} – {s.name}</option>)}
          </select>
          <select name="status" defaultValue={status} className="input w-36">
            <option value="ACTIVE">Active</option>
            <option value="LEFT">Left</option>
            <option value="GRADUATED">Graduated</option>
            <option value="">All</option>
          </select>
          <button className="btn-secondary">Filter</button>
        </form>
        {students.length ? (
          <Table head={["Adm. No", "Roll", "Name", "Class", "Guardian", "Phone", "Bus", "Status"]}>
            {students.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.admissionNo}</td>
                <td>{s.rollNo ?? "—"}</td>
                <td><Link href={`/app/students/${s.id}`} className="link">{s.firstName} {s.lastName}</Link></td>
                <td>{s.section ? `${s.section.class.name} – ${s.section.name}` : "—"}</td>
                <td>{s.guardian?.name ?? "—"}</td>
                <td>{s.guardian?.phone ?? "—"}</td>
                <td className="text-xs">{s.busStop ? `${s.busStop.route.name.split("—")[0]} · ${s.busStop.name}` : "—"}</td>
                <td><Badge color={s.status === "ACTIVE" ? "green" : "gray"}>{s.status}</Badge></td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No students match.</Empty>
        )}
      </Card>

      {user.role === "ADMIN" && (
        <Card title="Promote / graduate a section">
          <ActionForm action={promoteSection} className="flex flex-wrap items-end gap-2" confirm="Move all active students of this section?">
            <select name="from" className="input w-48" required>
              <option value="">From section…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.class.name} – {s.name}</option>)}
            </select>
            <span className="py-2 text-slate-400">→</span>
            <select name="to" className="input w-48" required>
              <option value="">To section…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.class.name} – {s.name}</option>)}
              <option value="GRADUATE">🎓 Graduate (pass out)</option>
            </select>
            <Submit>Promote</Submit>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
