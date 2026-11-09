import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { addEvent, deleteEvent } from "@/app/actions/misc";
import { fmtDate, today } from "@/lib/utils";

const COLORS: Record<string, string> = { HOLIDAY: "red", MEETING: "amber", EVENT: "blue", EXAM: "indigo" };

export default async function CalendarPage({ searchParams }: PageProps<"/app/calendar">) {
  const { db, user } = await requireSchoolUser();
  const sp = await searchParams;
  const past = sp.past === "1";
  const isAdmin = user.role === "ADMIN";
  const events = await db.schoolEvent.findMany({
    where: past ? { date: { lt: today() } } : { OR: [{ date: { gte: today() } }, { endDate: { gte: today() } }] },
    orderBy: { date: past ? "desc" : "asc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="School calendar" subtitle="Holidays, events and meetings" actions={<Link href={past ? "?" : "?past=1"} className="btn-secondary">{past ? "Upcoming" : "Past events"}</Link>} />
      {isAdmin && (
        <Card title="Add to calendar">
          <ActionForm action={addEvent} className="grid gap-3 sm:grid-cols-6">
            <Field label="Title" className="sm:col-span-2"><input name="title" className="input" required /></Field>
            <Field label="Type"><select name="type" className="input"><option>EVENT</option><option>HOLIDAY</option><option>MEETING</option><option>EXAM</option></select></Field>
            <Field label="Date"><input name="date" type="date" className="input" required /></Field>
            <Field label="End date"><input name="endDate" type="date" className="input" /></Field>
            <Field label="Details"><input name="details" className="input" /></Field>
            <div><Submit>Add</Submit></div>
          </ActionForm>
        </Card>
      )}
      <Card>
        {events.length ? (
          <Table head={["Date", "Title", "Type", "Details", ""]}>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap">{fmtDate(e.date)}{e.endDate && e.endDate !== e.date ? ` – ${fmtDate(e.endDate)}` : ""}</td>
                <td className="font-medium">{e.title}</td>
                <td><Badge color={COLORS[e.type]}>{e.type}</Badge></td>
                <td className="text-slate-600">{e.details ?? ""}</td>
                <td className="text-right">
                  {isAdmin && (
                    <ConfirmForm action={deleteEvent} message="Delete this event?">
                      <input type="hidden" name="id" value={e.id} />
                      <button className="text-xs text-rose-600 hover:underline">Delete</button>
                    </ConfirmForm>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Nothing here.</Empty>
        )}
      </Card>
    </div>
  );
}
