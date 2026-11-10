"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { Card } from "@/components/ui";
import type { Tone } from "@/lib/constants";
import { money, pct } from "@/lib/utils";
import { ColumnChart, Dial, LEVEL, ProgressRow, TrendChart, compactMoney, shortDate, type TrendPoint } from "./charts";
import { KnowledgeGraph } from "./knowledge-graph";

const RANGES = [7, 15, 30, 45] as const;
type Metric = "attendance" | "fees" | "results";
const METRICS: { key: Metric; label: string; target: number }[] = [
  { key: "attendance", label: "Attendance", target: 75 },
  { key: "fees", label: "Fees", target: 80 },
  { key: "results", label: "Results", target: 80 },
];
const whole = (v: number) => Math.round(v * 10) / 10;

function Tile({ label, value, hint, href, tone, meter }: { label: string; value: string; hint: string; href: string; tone: Tone; meter?: number }) {
  return (
    <Link href={href} className={`card tone-card tone-${tone} block transition hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="tone-text text-sm font-medium">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {meter !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "color-mix(in oklab, var(--tone) 25%, transparent)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, meter)}%`, background: "var(--tone)" }} />
        </div>
      )}
      <div className="mt-1.5 text-xs text-slate-500">{hint}</div>
    </Link>
  );
}

function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-slate-300 bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${o.value === value ? "bg-slate-900 text-slate-50" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AdminDashboard({ data }: { data: DashboardData }) {
  const [classId, setClassId] = useState<string | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [metric, setMetric] = useState<Metric>("attendance");
  const [weakestFirst, setWeakestFirst] = useState(true);

  const selectedClass = data.classes.find((c) => c.id === classId) ?? null;
  const toggleClass = (id: string) => setClassId((c) => (c === id ? null : id));

  const dates = useMemo(() => [...new Set(data.attendance.map((a) => a.date))].sort().slice(-range), [data.attendance, range]);

  const trend = useMemo<TrendPoint[]>(() => {
    const inRange = new Set(dates);
    const byDate = new Map<string, { present: number; marked: number }>();
    for (const a of data.attendance) {
      if (!inRange.has(a.date) || (classId && a.classId !== classId)) continue;
      const row = byDate.get(a.date) ?? { present: 0, marked: 0 };
      row.present += a.present;
      row.marked += a.marked;
      byDate.set(a.date, row);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, r]) => ({ date, value: pct(r.present, r.marked), detail: `${r.present} of ${r.marked} present` }));
  }, [data.attendance, dates, classId]);

  const attendanceByClass = useMemo(() => {
    const inRange = new Set(dates);
    const map = new Map<string, { present: number; marked: number }>();
    for (const a of data.attendance) {
      if (!inRange.has(a.date)) continue;
      const row = map.get(a.classId) ?? { present: 0, marked: 0 };
      row.present += a.present;
      row.marked += a.marked;
      map.set(a.classId, row);
    }
    return map;
  }, [data.attendance, dates]);

  const feeRows = classId ? data.fees.filter((f) => f.classId === classId) : data.fees;
  const billed = feeRows.reduce((a, f) => a + f.billed, 0);
  const collected = feeRows.reduce((a, f) => a + f.collected, 0);
  const allBilled = data.fees.reduce((a, f) => a + f.billed, 0);
  const allCollected = data.fees.reduce((a, f) => a + f.collected, 0);

  const examRows = (data.exam?.rows ?? []).filter((r) => !classId || r.classId === classId);
  const passed = examRows.reduce((a, r) => a + r.passed, 0);
  const papers = examRows.reduce((a, r) => a + r.total, 0);

  const latest = trend[trend.length - 1] ?? null;
  const periodPresent = classId ? attendanceByClass.get(classId) : [...attendanceByClass.values()].reduce((a, r) => ({ present: a.present + r.present, marked: a.marked + r.marked }), { present: 0, marked: 0 });

  const months = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of data.feeMonths) {
      if (classId && f.classId !== classId) continue;
      map.set(f.month, (map.get(f.month) ?? 0) + f.amount);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, amount]) => ({ month, amount }));
  }, [data.feeMonths, classId]);

  const target = METRICS.find((m) => m.key === metric)!.target;
  const progress = data.classes
    .map((c) => {
      if (metric === "attendance") {
        const r = attendanceByClass.get(c.id);
        return { c, value: r ? pct(r.present, r.marked) : null, detail: r ? `${r.present.toLocaleString("en-IN")} of ${r.marked.toLocaleString("en-IN")}` : "" };
      }
      if (metric === "fees") {
        const r = data.fees.find((f) => f.classId === c.id);
        return { c, value: r ? pct(r.collected, r.billed) : null, detail: r ? `${compactMoney(r.collected)} of ${compactMoney(r.billed)}` : "" };
      }
      const r = data.exam?.rows.find((x) => x.classId === c.id);
      return { c, value: r ? pct(r.passed, r.total) : null, detail: r ? `Average ${whole(r.average)}%` : "" };
    })
    .filter((r): r is typeof r & { value: number } => r.value !== null);
  if (weakestFirst) progress.sort((a, b) => a.value - b.value);

  const attention = data.attention;
  const alerts = [
    attention.unmarkedSections ? { key: "marked", text: `${attention.unmarkedSections} sections have not marked attendance today`, href: "/app/attendance", level: LEVEL.watch } : null,
    attention.overdueInvoices ? { key: "fees", text: `${attention.overdueInvoices} overdue invoices worth ${money(attention.overdueAmount)}`, href: "/app/fees?tab=dues", level: LEVEL.low } : null,
    attention.overdueBooks ? { key: "books", text: `${attention.overdueBooks} library books are overdue`, href: "/app/library", level: LEVEL.watch } : null,
  ].filter((a) => a !== null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Tile label="Students" tone="violet" value={data.totals.students.toLocaleString("en-IN")} hint={`${pct(data.totals.students, data.totals.maxStudents)}% of ${data.totals.maxStudents.toLocaleString("en-IN")} seats`} href="/app/students" meter={pct(data.totals.students, data.totals.maxStudents)} />
        <Tile label="Staff" tone="pink" value={String(data.totals.staff)} hint={`${data.totals.sections} sections running`} href="/app/staff" />
        <Tile label="Fees collected" tone="green" value={compactMoney(allCollected)} hint={`of ${compactMoney(allBilled)} billed`} href="/app/fees" meter={pct(allCollected, allBilled)} />
        <Tile label="Outstanding" tone="amber" value={compactMoney(Math.max(0, allBilled - allCollected))} hint="Still to collect" href="/app/fees?tab=dues" />
        <Tile label="Buses on trip" tone="teal" value={`${data.totals.busesLive} of ${data.totals.vehicles}`} hint="Open the live map" href="/app/transport/live" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by class" className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!classId} onClick={() => setClassId(null)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${!classId ? "border-slate-900 bg-slate-900 text-slate-50" : "border-slate-300 bg-surface text-slate-600 hover:bg-slate-50"}`}>All classes</button>
          {data.classes.map((c) => (
            <button key={c.id} type="button" aria-pressed={classId === c.id} onClick={() => toggleClass(c.id)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${classId === c.id ? "border-slate-900 bg-slate-900 text-slate-50" : "border-slate-300 bg-surface text-slate-600 hover:bg-slate-50"}`}>{c.name}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Attendance over</span>
          <Segmented label="Attendance period" options={RANGES.map((r) => ({ value: r, label: `${r} days` }))} value={range} onChange={setRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Dial
          title={latest?.date === data.today ? "Today's attendance" : "Latest attendance"}
          value={latest ? whole(latest.value) : null}
          target={75}
          detail={latest ? `${latest.detail}${latest.date === data.today ? "" : ` on ${shortDate(latest.date)}`}` : "Nothing marked yet"}
          href="/app/attendance"
        />
        <Dial
          title={`Average over ${range} school days`}
          value={periodPresent?.marked ? whole(pct(periodPresent.present, periodPresent.marked)) : null}
          target={75}
          detail={selectedClass ? selectedClass.name : "All classes"}
          href="/app/attendance/report"
        />
        <Dial title="Fees collected" value={billed ? whole(pct(collected, billed)) : null} target={80} detail={billed ? `${compactMoney(collected)} of ${compactMoney(billed)}` : "No invoices yet"} href="/app/fees" />
        <Dial title={data.exam ? `Papers passed: ${data.exam.name}` : "Exam pass rate"} value={papers ? whole(pct(passed, papers)) : null} target={80} detail={papers ? `${passed.toLocaleString("en-IN")} of ${papers.toLocaleString("en-IN")} papers` : "No marks yet"} href="/app/exams" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`Daily attendance: ${selectedClass?.name ?? "all classes"}`} className="min-w-0 lg:col-span-2">
          <TrendChart points={trend} minimum={75} title="Daily attendance percentage" />
        </Card>
        <Card title={`Fees collected by month: ${selectedClass?.name ?? "all classes"}`} className="min-w-0">
          <ColumnChart points={months} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Progress by class"
          actions={<Segmented label="Progress measure" options={METRICS.map((m) => ({ value: m.key, label: m.label }))} value={metric} onChange={setMetric} />}
        >
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Select a class to filter the dashboard</span>
            <button type="button" className="font-medium text-slate-700 hover:underline" onClick={() => setWeakestFirst((w) => !w)}>{weakestFirst ? "Weakest first" : "Class order"}</button>
          </div>
          {progress.length ? (
            <div className="space-y-0.5">
              {progress.map((p) => <ProgressRow key={p.c.id} label={p.c.name} value={whole(p.value)} target={target} detail={p.detail} selected={classId === p.c.id} onClick={() => toggleClass(p.c.id)} />)}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No data for this measure yet.</p>
          )}
        </Card>

        <Card title="Needs attention">
          {alerts.length ? (
            <ul className="space-y-1">
              {alerts.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                    <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white" style={{ background: a.level === LEVEL.watch ? "#92610a" : a.level.color }}>{a.level.icon}</span>
                    <span className="flex-1">{a.text}</span>
                    <span aria-hidden className="text-slate-400">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-slate-500">Nothing is overdue today.</p>
          )}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Students below 75% attendance</h3>
              <span className="text-xs text-slate-500">{attention.lowAttendanceTotal} in the last 30 days</span>
            </div>
            {attention.lowAttendance.length ? (
              <ul className="mt-2 space-y-2">
                {attention.lowAttendance.map((s) => (
                  <li key={s.id}>
                    <Link href={`/app/students/${s.id}`} className="block rounded-lg px-2 py-1 hover:bg-slate-50">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">{s.name} <span className="font-normal text-slate-500">· {s.section}</span></span>
                        <span className="font-semibold tabular-nums">{s.percent}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: LEVEL.low.track }}>
                        <div className="h-full rounded-full" style={{ width: `${s.percent}%`, background: LEVEL.low.color }} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Every student is above 75%.</p>
            )}
          </div>
        </Card>
      </div>

      <Card title="School knowledge graph">
        <KnowledgeGraph nodes={data.graph.nodes} edges={data.graph.edges} focusClassId={classId} onFocusClass={setClassId} />
      </Card>
    </div>
  );
}
