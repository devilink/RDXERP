import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import {
  addAcademicYear, addClass, addSection, addSubject, assignClassSubject, deleteClass, deleteSubject,
  removeClassSubject, saveGradeScale, updateSection,
} from "@/app/actions/academics";
import { getScale } from "@/lib/results";
import { fmtDate } from "@/lib/utils";

export default async function AcademicsPage() {
  const { db } = await requireSchoolUser(["ADMIN"]);
  const [years, classes, subjects, teachers, scale] = await Promise.all([
    db.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    db.class.findMany({
      orderBy: { order: "asc" },
      include: {
        sections: { include: { classTeacher: true, _count: { select: { students: true } } }, orderBy: { name: "asc" } },
        classSubjects: { include: { subject: true, teacher: true }, orderBy: { subject: { name: "asc" } } },
      },
    }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getScale(db),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Classes & Subjects" subtitle="Academic structure: years, classes, sections, subjects, teacher allocation and grading." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Add class">
          <ActionForm action={addClass} className="space-y-3">
            <Field label="Class name"><input name="name" className="input" placeholder="Class 5" required /></Field>
            <Field label="Sections (comma separated)"><input name="sections" className="input" placeholder="A, B, C" /></Field>
            <Field label="Display order"><input name="order" type="number" className="input" defaultValue={classes.length} /></Field>
            <Submit>Create class</Submit>
          </ActionForm>
        </Card>
        <Card title="Subjects">
          <ActionForm action={addSubject} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input name="name" className="input" placeholder="Subject" required />
              <input name="code" className="input" placeholder="Code" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allClasses" /> Add to all classes</label>
            <Submit>Add subject</Submit>
          </ActionForm>
          <ul className="mt-4 flex flex-wrap gap-2">
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm">
                {s.name}
                <ConfirmForm action={deleteSubject} message={`Delete subject ${s.name} everywhere (routine, marks, timetable)?`}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="rounded-full px-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600" title="Delete">×</button>
                </ConfirmForm>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Academic years">
          <ActionForm action={addAcademicYear} className="space-y-2">
            <input name="name" className="input" placeholder="2027-28" required />
            <div className="grid grid-cols-2 gap-2">
              <input name="startDate" type="date" className="input" required />
              <input name="endDate" type="date" className="input" required />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isCurrent" /> Set as current</label>
            <Submit>Add year</Submit>
          </ActionForm>
          <ul className="mt-4 space-y-1 text-sm">
            {years.map((y) => (
              <li key={y.id} className="flex justify-between">
                <span>{y.name} {y.isCurrent && <Badge color="green">Current</Badge>}</span>
                <span className="text-slate-500">{fmtDate(y.startDate)} – {fmtDate(y.endDate)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {classes.length === 0 && <Empty>No classes yet. Create your first class above.</Empty>}

      {classes.map((c) => (
        <Card
          key={c.id}
          title={c.name}
          actions={
            <ConfirmForm action={deleteClass} message={`Delete ${c.name}? Its sections, routine and fee structures are removed and students become unassigned.`}>
              <input type="hidden" name="id" value={c.id} />
              <button className="btn-secondary btn-sm text-rose-600">Delete class</button>
            </ConfirmForm>
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Sections</h3>
              <div className="space-y-2">
                {c.sections.map((s) => (
                  <ActionForm key={s.id} action={updateSection} reset={false} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
                    <input type="hidden" name="id" value={s.id} />
                    <span className="w-28 text-sm font-medium">Section {s.name} <span className="text-xs text-slate-500">({s._count.students})</span></span>
                    <select name="classTeacherId" defaultValue={s.classTeacherId ?? ""} className="input w-44 py-1">
                      <option value="">— Class teacher —</option>
                      {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <input name="room" defaultValue={s.room ?? ""} placeholder="Room" className="input w-20 py-1" />
                    <Submit className="btn-secondary btn-sm">Save</Submit>
                  </ActionForm>
                ))}
                <ActionForm action={addSection} className="flex gap-2">
                  <input type="hidden" name="classId" value={c.id} />
                  <input name="name" placeholder="New section" className="input w-32 py-1" required />
                  <input name="room" placeholder="Room" className="input w-20 py-1" />
                  <Submit className="btn-secondary btn-sm">Add</Submit>
                </ActionForm>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Subjects & teachers</h3>
              <Table head={["Subject", "Teacher", ""]}>
                {c.classSubjects.map((cs) => (
                  <tr key={cs.id}>
                    <td>{cs.subject.name}</td>
                    <td>{cs.teacher?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="text-right">
                      <form action={removeClassSubject}>
                        <input type="hidden" name="id" value={cs.id} />
                        <button className="text-xs text-rose-600 hover:underline">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </Table>
              <ActionForm action={assignClassSubject} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="classId" value={c.id} />
                <select name="subjectId" className="input w-40 py-1" required>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select name="teacherId" className="input w-40 py-1">
                  <option value="">— Teacher —</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <Submit className="btn-secondary btn-sm">Assign</Submit>
              </ActionForm>
            </div>
          </div>
        </Card>
      ))}

      <Card title="Grading scale">
        <ActionForm action={saveGradeScale} reset={false}>
          <Table head={["Grade", "Min %", "Grade point", "Remark"]}>
            {Array.from({ length: Math.max(scale.length + 2, 8) }).map((_, i) => {
              const g = scale[i];
              return (
                <tr key={i}>
                  <td><input name={`grade_${i}`} defaultValue={g?.grade ?? ""} className="input w-20 py-1" /></td>
                  <td><input name={`min_${i}`} type="number" step="0.01" defaultValue={g?.minPercent ?? ""} className="input w-24 py-1" /></td>
                  <td><input name={`gp_${i}`} type="number" step="0.1" defaultValue={g?.gradePoint ?? ""} className="input w-24 py-1" /></td>
                  <td><input name={`remark_${i}`} defaultValue={g?.remark ?? ""} className="input py-1" /></td>
                </tr>
              );
            })}
          </Table>
          <div className="mt-3"><Submit>Save grading scale</Submit></div>
        </ActionForm>
      </Card>
    </div>
  );
}
