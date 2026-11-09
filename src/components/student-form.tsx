import { Field } from "@/components/ui";

type Opt = { id: string; label: string };
type Student = {
  id?: string; admissionNo?: string; rollNo?: number | null; firstName?: string; lastName?: string; gender?: string | null;
  dob?: string | null; bloodGroup?: string | null; address?: string | null; phone?: string | null; sectionId?: string | null;
  busStopId?: string | null; status?: string; admittedOn?: string | null;
};

/** Shared student fields for admission + edit forms (rendered inside an ActionForm). */
export function StudentFields({ s = {}, sections, stops }: { s?: Student; sections: Opt[]; stops: Opt[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {s.id && <input type="hidden" name="id" value={s.id} />}
      <Field label="First name *"><input name="firstName" defaultValue={s.firstName} className="input" required /></Field>
      <Field label="Last name"><input name="lastName" defaultValue={s.lastName} className="input" /></Field>
      <Field label="Admission no *"><input name="admissionNo" defaultValue={s.admissionNo} className="input" required /></Field>
      <Field label="Class / section">
        <select name="sectionId" defaultValue={s.sectionId ?? ""} className="input">
          <option value="">— Not assigned —</option>
          {sections.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Roll no"><input name="rollNo" type="number" defaultValue={s.rollNo ?? ""} className="input" /></Field>
      <Field label="Gender">
        <select name="gender" defaultValue={s.gender ?? ""} className="input">
          <option value="">—</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
        </select>
      </Field>
      <Field label="Date of birth"><input name="dob" type="date" defaultValue={s.dob ?? ""} className="input" /></Field>
      <Field label="Blood group"><input name="bloodGroup" defaultValue={s.bloodGroup ?? ""} className="input" /></Field>
      <Field label="Phone"><input name="phone" defaultValue={s.phone ?? ""} className="input" /></Field>
      <Field label="Address" className="sm:col-span-2"><input name="address" defaultValue={s.address ?? ""} className="input" /></Field>
      <Field label="School bus stop">
        <select name="busStopId" defaultValue={s.busStopId ?? ""} className="input">
          <option value="">— Doesn&apos;t use bus —</option>
          {stops.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
      {s.id ? (
        <Field label="Status">
          <select name="status" defaultValue={s.status} className="input">
            <option value="ACTIVE">Active</option><option value="LEFT">Left school</option><option value="GRADUATED">Graduated</option>
          </select>
        </Field>
      ) : (
        <Field label="Admission date"><input name="admittedOn" type="date" className="input" /></Field>
      )}
    </div>
  );
}
