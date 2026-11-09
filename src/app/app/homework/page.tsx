import { requireSchoolUser } from "@/lib/auth";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { addHomework, deleteHomework } from "@/app/actions/misc";
import { teachableSectionIds } from "@/lib/permissions";
import { getFamilyStudents } from "@/lib/family";
import { fmtDate, today } from "@/lib/utils";

export default async function HomeworkPage() {
  const { db, user } = await requireSchoolUser(["ADMIN", "TEACHER", "STUDENT", "PARENT"]);
  const family = user.role === "STUDENT" || user.role === "PARENT";
  let sectionIds: string[] | "ALL";
  if (family) sectionIds = (await getFamilyStudents(db, user)).map((k) => k.sectionId).filter((x): x is string => !!x);
  else sectionIds = await teachableSectionIds(db, user);

  const filter = sectionIds === "ALL" ? {} : { id: { in: sectionIds } };
  const [sections, subjects, homework] = await Promise.all([
    db.section.findMany({ where: filter, include: { class: true }, orderBy: [{ class: { order: "asc" } }, { name: "asc" }] }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.homework.findMany({
      where: { ...(sectionIds === "ALL" ? {} : { sectionId: { in: sectionIds } }), dueDate: { gte: family ? today() : "0000" } },
      include: { subject: true, section: { include: { class: true } } },
      orderBy: { dueDate: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Homework" subtitle={family ? "Pending assignments" : "Assign homework to your sections"} />
      {!family && sections.length > 0 && (
        <Card title="New assignment">
          <ActionForm action={addHomework} className="grid gap-3 sm:grid-cols-4">
            <Field label="Section"><select name="sectionId" className="input">{sections.map((s) => <option key={s.id} value={s.id}>{s.class.name} – {s.name}</option>)}</select></Field>
            <Field label="Subject"><select name="subjectId" className="input"><option value="">—</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Title" className="sm:col-span-2"><input name="title" className="input" required /></Field>
            <Field label="Details" className="sm:col-span-3"><input name="description" className="input" /></Field>
            <Field label="Due date"><input name="dueDate" type="date" className="input" required /></Field>
            <div><Submit>Assign</Submit></div>
          </ActionForm>
        </Card>
      )}
      {homework.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {homework.map((h) => (
            <Card key={h.id}>
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-semibold">{h.title}</div>
                  <div className="text-xs text-slate-500">{h.section.class.name}-{h.section.name} · {h.subject?.name ?? "General"}</div>
                </div>
                <div className={`text-right text-xs ${h.dueDate < today() ? "text-slate-400" : "text-rose-600"}`}>Due<br />{fmtDate(h.dueDate)}</div>
              </div>
              {h.description && <p className="mt-2 text-sm text-slate-600">{h.description}</p>}
              {!family && (
                <ConfirmForm action={deleteHomework} message="Delete this assignment?" className="mt-2">
                  <input type="hidden" name="id" value={h.id} />
                  <button className="text-xs text-rose-600 hover:underline">Delete</button>
                </ConfirmForm>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Empty>No homework.</Empty>
      )}
    </div>
  );
}
