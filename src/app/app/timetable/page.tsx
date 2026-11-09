import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { saveSlot } from "@/app/actions/misc";
import { getFamilyStudent } from "@/lib/family";
import { DAYS } from "@/lib/constants";

export default async function TimetablePage({ searchParams }: PageProps<"/app/timetable">) {
  const { db, user } = await requireSchoolUser(["ADMIN", "TEACHER", "STUDENT", "PARENT"]);
  const sp = await searchParams;
  const isAdmin = user.role === "ADMIN";
  const family = user.role === "PARENT" || user.role === "STUDENT";
  const staff = user.role === "TEACHER" ? await db.staff.findFirst({ where: { userId: user.id } }) : null;
  const mine = user.role === "TEACHER" && sp.view !== "section";

  const sections = await db.section.findMany({ include: { class: true }, orderBy: [{ class: { order: "asc" } }, { name: "asc" }] });
  let sectionId = typeof sp.section === "string" ? sp.section : sections[0]?.id;
  let title = "";
  if (family) {
    const { child } = await getFamilyStudent(db, user, typeof sp.child === "string" ? sp.child : undefined);
    if (!child?.sectionId) return <Empty>No class assigned yet.</Empty>;
    sectionId = child.sectionId;
    title = `${child.firstName}'s timetable`;
  }
  const section = sections.find((s) => s.id === sectionId);

  const slots = mine
    ? await db.timetableSlot.findMany({ where: { teacherId: staff?.id ?? "-" }, include: { subject: true, teacher: true, section: { include: { class: true } } } })
    : await db.timetableSlot.findMany({ where: { sectionId }, include: { subject: true, teacher: true, section: { include: { class: true } } } });
  const periods = Array.from(new Set(slots.map((s) => s.period))).sort((a, b) => a - b);
  if (!periods.length) periods.push(1, 2, 3, 4, 5, 6);
  const timeOf = (p: number) => slots.find((s) => s.period === p);

  const [subjects, teachers] = isAdmin ? await Promise.all([db.subject.findMany({ orderBy: { name: "asc" } }), db.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } })]) : [[], []];

  return (
    <div className="space-y-6">
      <PageHeader
        title={mine ? "My teaching timetable" : title || `Timetable — ${section ? `${section.class.name} ${section.name}` : ""}`}
        actions={<PrintButton />}
      />
      {!family && (
        <form className="no-print flex flex-wrap items-end gap-2">
          {user.role === "TEACHER" && (
            <div className="flex gap-2">
              <Link href="?" className={mine ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>My timetable</Link>
              <Link href="?view=section" className={!mine ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>By section</Link>
            </div>
          )}
          {!mine && (
            <>
              <input type="hidden" name="view" value="section" />
              <select name="section" defaultValue={sectionId} className="input w-48">
                {sections.map((s) => <option key={s.id} value={s.id}>{s.class.name} – {s.name}</option>)}
              </select>
              <button className="btn-secondary">Show</button>
            </>
          )}
        </form>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-slate-50 p-2 text-left">Day</th>
                {periods.map((p) => {
                  const t = timeOf(p);
                  return <th key={p} className="border bg-slate-50 p-2 text-center">P{p}{t && <div className="text-xs font-normal text-slate-500">{t.startTime}–{t.endTime}</div>}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <tr key={d}>
                  <td className="border p-2 font-medium">{DAYS[d]}</td>
                  {periods.map((p) => {
                    const s = slots.find((x) => x.day === d && x.period === p);
                    return (
                      <td key={p} className="border p-2 text-center align-top">
                        {s ? (
                          <>
                            <div className="font-medium">{s.subject?.name ?? "—"}</div>
                            <div className="text-xs text-slate-500">{mine ? `${s.section.class.name}-${s.section.name}` : s.teacher?.name ?? ""}</div>
                          </>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {isAdmin && section && (
        <Card title={`Edit a period — ${section.class.name} ${section.name}`} className="no-print">
          <ActionForm action={saveSlot} reset={false} className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <input type="hidden" name="sectionId" value={section.id} />
            <Field label="Day"><select name="day" className="input">{[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select></Field>
            <Field label="Period"><input name="period" type="number" min={1} max={12} defaultValue={1} className="input" /></Field>
            <Field label="Start"><input name="startTime" type="time" defaultValue="08:00" className="input" /></Field>
            <Field label="End"><input name="endTime" type="time" defaultValue="08:45" className="input" /></Field>
            <Field label="Subject"><select name="subjectId" className="input"><option value="">—</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Teacher"><select name="teacherId" className="input"><option value="">—</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="clear" /> Clear period</label>
            <div className="flex items-end"><Submit>Save</Submit></div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
