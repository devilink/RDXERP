import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { fmtDate, money, pct, today } from "@/lib/utils";
import { getFamilyStudents } from "@/lib/family";

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const { user, db } = await requireSchoolUser();
  const sp = await searchParams;
  const role = user.role;
  const t = today();

  const [notices, events] = await Promise.all([
    db.notice.findMany({
      where: role === "ADMIN" ? {} : { audience: { in: ["ALL", ...(["TEACHER", "ACCOUNTANT", "DRIVER"].includes(role) ? ["STAFF"] : role === "PARENT" ? ["PARENTS"] : ["STUDENTS"])] } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.schoolEvent.findMany({ where: { date: { gte: t } }, orderBy: { date: "asc" }, take: 5 }),
  ]);

  return (
    <div>
      {sp.denied && <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">You don&apos;t have access to that page.</div>}
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle={fmtDate(new Date())} />
      {role === "ADMIN" || role === "ACCOUNTANT" ? <AdminStats /> : null}
      {role === "TEACHER" ? <TeacherPanel staffUserId={user.id} /> : null}
      {role === "PARENT" || role === "STUDENT" ? <FamilyPanel /> : null}
      {role === "DRIVER" ? (
        <Card className="mb-6">
          <p className="text-sm">Open <Link className="link" href="/app/driver">Trip &amp; GPS</Link> when you start your route so parents can see the bus live.</p>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Latest notices" actions={<Link href="/app/notices" className="link text-sm">All</Link>}>
          {notices.length ? (
            <ul className="space-y-3">
              {notices.map((n) => (
                <li key={n.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{n.title}</span>
                    <Badge color="indigo">{n.audience}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{n.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No notices.</Empty>
          )}
        </Card>
        <Card title="Upcoming events & holidays" actions={<Link href="/app/calendar" className="link text-sm">Calendar</Link>}>
          {events.length ? (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span>{e.title}</span>
                  <span className="flex items-center gap-2 text-slate-500">
                    <Badge color={e.type === "HOLIDAY" ? "red" : e.type === "MEETING" ? "amber" : "blue"}>{e.type}</Badge>
                    {fmtDate(e.date)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing scheduled.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

async function AdminStats() {
  const { db } = await requireSchoolUser();
  const t = today();
  const [students, staff, classes, todayAtt, invoices, payments, vehiclesLive] = await Promise.all([
    db.student.count({ where: { status: "ACTIVE" } }),
    db.staff.count({ where: { active: true } }),
    db.section.count(),
    db.attendance.groupBy({ by: ["status"], where: { date: t }, _count: true }),
    db.feeInvoice.aggregate({ _sum: { amount: true, discount: true } }),
    db.feePayment.aggregate({ _sum: { amount: true } }),
    db.vehicle.count({ where: { tripActive: true } }),
  ]);
  const marked = todayAtt.reduce((a, r) => a + r._count, 0);
  const present = todayAtt.filter((r) => r.status === "PRESENT" || r.status === "LATE").reduce((a, r) => a + r._count, 0);
  const billed = (invoices._sum.amount ?? 0) - (invoices._sum.discount ?? 0);
  const collected = payments._sum.amount ?? 0;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat label="Active students" value={students} hint={`${classes} sections`} href="/app/students" />
      <Stat label="Staff" value={staff} href="/app/staff" />
      <Stat label="Today's attendance" value={marked ? `${pct(present, marked)}%` : "Not marked"} hint={`${marked} of ${students} marked`} href="/app/attendance" />
      <Stat label="Buses on trip" value={vehiclesLive} href="/app/transport/live" />
      <Stat label="Fees billed" value={money(billed)} href="/app/fees" />
      <Stat label="Fees collected" value={money(collected)} hint={`${pct(collected, billed)}% collected`} href="/app/fees" />
      <Stat label="Outstanding dues" value={money(Math.max(0, billed - collected))} href="/app/fees?tab=dues" />
      <Stat label="Exams" value={<Link href="/app/exams" className="link text-base">Manage →</Link>} />
    </div>
  );
}

async function TeacherPanel({ staffUserId }: { staffUserId: string }) {
  const { db } = await requireSchoolUser();
  const staff = await db.staff.findFirst({ where: { userId: staffUserId } });
  const dow = new Date(today() + "T00:00:00").getDay();
  const [led, slots] = await Promise.all([
    staff ? db.section.findMany({ where: { classTeacherId: staff.id }, include: { class: true, _count: { select: { students: true } } } }) : [],
    staff && dow >= 1 && dow <= 6
      ? db.timetableSlot.findMany({ where: { teacherId: staff.id, day: dow }, include: { subject: true, section: { include: { class: true } } }, orderBy: { period: "asc" } })
      : [],
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="My class(es)">
        {led.length ? (
          <ul className="space-y-2 text-sm">
            {led.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <span>{s.class.name} – {s.name} <span className="text-slate-500">({s._count.students} students)</span></span>
                <Link className="btn-primary btn-sm" href={`/app/attendance?section=${s.id}`}>Mark attendance</Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>You are not a class teacher.</Empty>
        )}
      </Card>
      <Card title="Today's periods">
        {slots.length ? (
          <ul className="space-y-1 text-sm">
            {slots.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>P{s.period} · {s.subject?.name ?? "—"}</span>
                <span className="text-slate-500">{s.section.class.name}-{s.section.name} · {s.startTime}–{s.endTime}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No periods today.</Empty>
        )}
      </Card>
    </div>
  );
}

async function FamilyPanel() {
  const { user, db } = await requireSchoolUser();
  const kids = await getFamilyStudents(db, user);
  if (!kids.length) return <Empty>No student is linked to your account yet. Please contact the school office.</Empty>;
  const month = today().slice(0, 7);
  const rows = await Promise.all(
    kids.map(async (k) => {
      const [att, invoices] = await Promise.all([
        db.attendance.groupBy({ by: ["status"], where: { studentId: k.id, date: { startsWith: month } }, _count: true }),
        db.feeInvoice.findMany({ where: { studentId: k.id }, include: { payments: true } }),
      ]);
      const total = att.reduce((a, r) => a + r._count, 0);
      const present = att.filter((r) => r.status !== "ABSENT").reduce((a, r) => a + r._count, 0);
      const due = invoices.reduce((a, i) => a + i.amount - i.discount - i.payments.reduce((x, p) => x + p.amount, 0), 0);
      return { k, total, present, due };
    }),
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map(({ k, total, present, due }) => (
        <Card key={k.id} title={`${k.firstName} ${k.lastName}`} actions={<Link href={`/app/my?child=${k.id}`} className="link text-sm">Open →</Link>}>
          <div className="text-sm text-slate-500">{k.section ? `${k.section.class.name} – ${k.section.name}` : "Unassigned"} · Adm. {k.admissionNo}</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Attendance this month</div>
              <div className="text-xl font-semibold">{total ? `${pct(present, total)}%` : "—"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Fee dues</div>
              <div className={`text-xl font-semibold ${due > 0 ? "text-rose-600" : "text-emerald-600"}`}>{money(Math.max(0, due))}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
