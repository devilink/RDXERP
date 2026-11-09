import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, Field, PageHeader, Stat, STATUS_COLOR, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { addFeeStructure, createInvoice, deleteFeeStructure, generateInvoices, recordPayment } from "@/app/actions/fees";
import { fmtDate, money, pct, today } from "@/lib/utils";

const TABS = [["invoices", "Invoices"], ["dues", "Defaulters"], ["payments", "Collections"], ["setup", "Fee heads & billing"]] as const;

export default async function FeesPage({ searchParams }: PageProps<"/app/fees">) {
  const { db } = await requireSchoolUser(["ADMIN", "ACCOUNTANT"]);
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "invoices";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";

  const [invoices, structures, classes, todayPay, monthPay] = await Promise.all([
    db.feeInvoice.findMany({
      where: q ? { OR: [{ invoiceNo: { contains: q, mode: "insensitive" } }, { student: { admissionNo: { contains: q, mode: "insensitive" } } }, { student: { firstName: { contains: q, mode: "insensitive" } } }, { student: { lastName: { contains: q, mode: "insensitive" } } }] } : {},
      include: { payments: true, student: { include: { section: { include: { class: true } }, guardian: true } } },
      orderBy: [{ dueDate: "desc" }, { invoiceNo: "desc" }],
    }),
    db.feeStructure.findMany({ include: { class: true }, orderBy: [{ class: { order: "asc" } }, { name: "asc" }] }),
    db.class.findMany({ orderBy: { order: "asc" } }),
    db.feePayment.aggregate({ where: { paidOn: today() }, _sum: { amount: true } }),
    db.feePayment.aggregate({ where: { paidOn: { startsWith: today().slice(0, 7) } }, _sum: { amount: true } }),
  ]);

  const rows = invoices.map((i) => {
    const paid = i.payments.reduce((a, p) => a + p.amount, 0);
    const net = i.amount - i.discount;
    const due = Math.max(0, net - paid);
    const st = due <= 0.001 ? "PAID" : paid > 0 ? "PARTIAL" : i.dueDate < today() ? "OVERDUE" : "DUE";
    return { ...i, paid, net, due, st };
  });
  const billed = rows.reduce((a, r) => a + r.net, 0);
  const collected = rows.reduce((a, r) => a + r.paid, 0);
  const overdue = rows.filter((r) => r.st === "OVERDUE" || (r.st === "PARTIAL" && r.dueDate < today()));
  const filtered = status ? rows.filter((r) => r.st === status) : rows;

  // Defaulters grouped by student.
  const byStudent = new Map<string, { s: (typeof rows)[number]["student"]; due: number; count: number; oldest: string }>();
  for (const r of overdue) {
    const cur = byStudent.get(r.studentId) ?? { s: r.student, due: 0, count: 0, oldest: r.dueDate };
    cur.due += r.due; cur.count++; if (r.dueDate < cur.oldest) cur.oldest = r.dueDate;
    byStudent.set(r.studentId, cur);
  }
  const defaulters = [...byStudent.values()].sort((a, b) => b.due - a.due);
  const payments = rows.flatMap((r) => r.payments.map((p) => ({ ...p, inv: r }))).sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.receiptNo.localeCompare(a.receiptNo));

  return (
    <div className="space-y-6">
      <PageHeader title="Fees & Accounts" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Total billed" value={money(billed)} />
        <Stat label="Collected" value={money(collected)} hint={`${pct(collected, billed)}%`} />
        <Stat label="Outstanding" value={money(billed - collected)} />
        <Stat label="Collected today" value={money(todayPay._sum.amount ?? 0)} />
        <Stat label="This month" value={money(monthPay._sum.amount ?? 0)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={tab === k ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{l}{k === "dues" ? ` (${defaulters.length})` : ""}</Link>)}
      </div>

      {tab === "invoices" && (
        <Card>
          <form className="mb-4 flex flex-wrap gap-2">
            <input type="hidden" name="tab" value="invoices" />
            <input name="q" defaultValue={q} placeholder="Invoice no, admission no, name" className="input max-w-xs" />
            <select name="status" defaultValue={status} className="input w-40">
              <option value="">All statuses</option>
              {["DUE", "OVERDUE", "PARTIAL", "PAID"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <button className="btn-secondary">Search</button>
          </form>
          {filtered.length ? (
            <Table head={["Invoice", "Student", "Title", "Due", "Net", "Paid", "Balance", "Status", "Collect payment"]}>
              {filtered.slice(0, 200).map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.invoiceNo}</td>
                  <td><Link className="link" href={`/app/students/${r.studentId}`}>{r.student.firstName} {r.student.lastName}</Link><div className="text-xs text-slate-500">{r.student.section ? `${r.student.section.class.name}-${r.student.section.name}` : ""} · {r.student.admissionNo}</div></td>
                  <td className="max-w-48 text-xs">{r.title}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(r.dueDate)}</td>
                  <td>{money(r.net)}</td>
                  <td>{money(r.paid)}</td>
                  <td className="font-medium">{money(r.due)}</td>
                  <td><Badge color={STATUS_COLOR[r.st]}>{r.st}</Badge></td>
                  <td>
                    {r.due > 0 ? (
                      <ActionForm action={recordPayment} className="flex gap-1">
                        <input type="hidden" name="invoiceId" value={r.id} />
                        <input name="amount" type="number" step="0.01" defaultValue={r.due} className="input w-24 py-1" />
                        <select name="method" className="input w-20 py-1"><option>CASH</option><option>UPI</option><option>CARD</option><option>BANK</option></select>
                        <Submit className="btn-primary btn-sm" pendingText="…">Pay</Submit>
                      </ActionForm>
                    ) : (
                      r.payments.map((p) => <Link key={p.id} href={`/app/fees/receipt/${p.id}`} className="link mr-2 text-xs">{p.receiptNo}</Link>)
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No invoices.</Empty>
          )}
          {filtered.length > 200 && <p className="mt-2 text-xs text-slate-500">Showing first 200 of {filtered.length}. Use search to narrow down.</p>}
        </Card>
      )}

      {tab === "dues" && (
        <Card title="Overdue fee defaulters">
          {defaulters.length ? (
            <Table head={["Student", "Class", "Guardian phone", "Overdue invoices", "Oldest due", "Amount due"]}>
              {defaulters.map((d) => (
                <tr key={d.s.id}>
                  <td><Link className="link" href={`/app/students/${d.s.id}`}>{d.s.firstName} {d.s.lastName}</Link></td>
                  <td>{d.s.section ? `${d.s.section.class.name}-${d.s.section.name}` : "—"}</td>
                  <td>{d.s.guardian?.phone ?? "—"}</td>
                  <td>{d.count}</td>
                  <td>{fmtDate(d.oldest)}</td>
                  <td className="font-semibold text-rose-600">{money(d.due)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No overdue fees. 🎉</Empty>
          )}
        </Card>
      )}

      {tab === "payments" && (
        <Card title="Recent collections">
          {payments.length ? (
            <Table head={["Receipt", "Date", "Student", "Invoice", "Method", "Amount"]}>
              {payments.slice(0, 200).map((p) => (
                <tr key={p.id}>
                  <td><Link className="link font-mono text-xs" href={`/app/fees/receipt/${p.id}`}>{p.receiptNo}</Link></td>
                  <td className="text-xs">{fmtDate(p.paidOn)}</td>
                  <td>{p.inv.student.firstName} {p.inv.student.lastName}</td>
                  <td className="text-xs">{p.inv.title}</td>
                  <td><Badge>{p.method}</Badge></td>
                  <td className="font-medium">{money(p.amount)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No payments yet.</Empty>
          )}
        </Card>
      )}

      {tab === "setup" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Fee heads">
            <Table head={["Class", "Fee head", "Amount", ""]}>
              {structures.map((s) => (
                <tr key={s.id}>
                  <td>{s.class?.name ?? "All classes"}</td>
                  <td>{s.name}</td>
                  <td>{money(s.amount)}</td>
                  <td className="text-right">
                    <ConfirmForm action={deleteFeeStructure} message="Delete this fee head? Existing invoices are kept.">
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-xs text-rose-600 hover:underline">Delete</button>
                    </ConfirmForm>
                  </td>
                </tr>
              ))}
            </Table>
            <ActionForm action={addFeeStructure} className="mt-4 grid grid-cols-3 gap-2">
              <select name="classId" className="input"><option value="">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input name="name" placeholder="e.g. Monthly Tuition Fee" className="input" required />
              <input name="amount" type="number" placeholder="Amount" className="input" required />
              <div className="col-span-3"><Submit>Add fee head</Submit></div>
            </ActionForm>
          </Card>
          <div className="space-y-6">
            <Card title="Bulk billing">
              <ActionForm action={generateInvoices} className="grid gap-3">
                <Field label="Fee head">
                  <select name="structureId" className="input" required>{structures.map((s) => <option key={s.id} value={s.id}>{s.class?.name ?? "All"} · {s.name} · {money(s.amount)}</option>)}</select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Period label"><input name="period" placeholder="December 2026" className="input" /></Field>
                  <Field label="Due date"><input name="dueDate" type="date" className="input" required /></Field>
                </div>
                <p className="text-xs text-slate-500">Creates one invoice per active student in that class. Re-running for the same period skips students already billed.</p>
                <Submit>Generate invoices</Submit>
              </ActionForm>
            </Card>
            <Card title="Single invoice">
              <ActionForm action={createInvoice} className="grid grid-cols-2 gap-2">
                <input name="studentId" placeholder="Admission no" className="input" required />
                <input name="title" placeholder="Title (e.g. Exam fee)" className="input" required />
                <input name="amount" type="number" placeholder="Amount" className="input" required />
                <input name="discount" type="number" placeholder="Discount" className="input" />
                <input name="dueDate" type="date" className="input" />
                <Submit>Create</Submit>
              </ActionForm>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
