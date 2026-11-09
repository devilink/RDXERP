"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/action-form";
import { saveAttendance } from "@/app/actions/attendance";

type Row = { id: string; name: string; rollNo: number | null; status: string | null; note: string | null };
const OPTS = [
  { v: "PRESENT", l: "P", c: "peer-checked:bg-emerald-500" },
  { v: "ABSENT", l: "A", c: "peer-checked:bg-rose-500" },
  { v: "LATE", l: "L", c: "peer-checked:bg-amber-500" },
  { v: "LEAVE", l: "Lv", c: "peer-checked:bg-sky-500" },
];

export function AttendanceSheet({ sectionId, date, rows }: { sectionId: string; date: string; rows: Row[] }) {
  const [status, setStatus] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.status ?? "PRESENT"])),
  );
  const counts = OPTS.map((o) => ({ ...o, n: Object.values(status).filter((s) => s === o.v).length }));
  const setAll = (v: string) => setStatus(Object.fromEntries(rows.map((r) => [r.id, v])));

  return (
    <ActionForm action={saveAttendance} reset={false}>
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="date" value={date} />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="btn-secondary btn-sm" onClick={() => setAll("PRESENT")}>All present</button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setAll("ABSENT")}>All absent</button>
        <span className="ml-auto flex gap-3 text-xs text-slate-600">
          {counts.map((c) => <span key={c.v}>{c.v}: <b>{c.n}</b></span>)}
        </span>
      </div>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <span className="w-8 text-xs text-slate-400">{r.rollNo ?? "—"}</span>
            <span className="min-w-40 flex-1 text-sm font-medium">{r.name}</span>
            <div className="flex gap-1">
              {OPTS.map((o) => (
                <label key={o.v} className="cursor-pointer">
                  <input
                    type="radio"
                    name={`s_${r.id}`}
                    value={o.v}
                    checked={status[r.id] === o.v}
                    onChange={() => setStatus({ ...status, [r.id]: o.v })}
                    className="peer sr-only"
                  />
                  <span className={`flex h-8 w-9 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-slate-500 peer-checked:border-transparent peer-checked:text-white ${o.c}`}>
                    {o.l}
                  </span>
                </label>
              ))}
            </div>
            <input name={`n_${r.id}`} defaultValue={r.note ?? ""} placeholder="Note" className="input w-40 py-1 text-xs" />
          </div>
        ))}
      </div>
      <div className="mt-4"><Submit>Save attendance</Submit></div>
    </ActionForm>
  );
}
