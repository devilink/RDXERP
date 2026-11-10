"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

export const VIZ = {
  surface: "var(--color-surface)",
  ink: "var(--color-slate-900)",
  muted: "var(--color-slate-500)",
  grid: "var(--color-slate-200)",
  accent: "var(--viz-accent)",
  accentTrack: "var(--viz-accent-track)",
  money: "var(--viz-money)",
};

export type Level = "good" | "watch" | "low";

// Severity always ships with an icon and a word, never colour alone.
export const LEVEL: Record<Level, { color: string; track: string; icon: string; label: string }> = {
  good: { color: VIZ.accent, track: VIZ.accentTrack, icon: "✓", label: "On track" },
  watch: { color: "#fab219", track: "var(--viz-watch-track)", icon: "!", label: "Watch" },
  low: { color: "#d03b3b", track: "var(--viz-low-track)", icon: "▲", label: "Needs attention" },
};

export const levelFor = (value: number, target: number): Level => (value >= target ? "good" : value >= target - 10 ? "watch" : "low");

export function compactMoney(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${Math.round(n / 1e3)}K`;
  return `₹${Math.round(n)}`;
}

export const shortDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const shortMonth = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" });

function useWidth(initial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-surface px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: Math.max(0, Math.min(x + 12, width - 150)), top: Math.max(0, y - 12) }}
      role="status"
    >
      {children}
    </div>
  );
}

function polar(angle: number, r: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: +(100 + r * Math.cos(rad)).toFixed(2), y: +(100 + r * Math.sin(rad)).toFixed(2) };
}

const ARC_START = 150;
const ARC_SWEEP = 240;
const ARC_RADIUS = 78;

export function Dial({ title, value, target, detail, href }: { title: string; value: number | null; target: number; detail: string; href: string }) {
  const level = value === null ? null : LEVEL[levelFor(value, target)];
  const from = polar(ARC_START, ARC_RADIUS);
  const to = polar(ARC_START + ARC_SWEEP, ARC_RADIUS);
  const arc = `M ${from.x} ${from.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 1 1 ${to.x} ${to.y}`;
  const tickInner = polar(ARC_START + (ARC_SWEEP * target) / 100, ARC_RADIUS - 11);
  const tickOuter = polar(ARC_START + (ARC_SWEEP * target) / 100, ARC_RADIUS + 11);
  return (
    <Link href={href} className="card block transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: VIZ.accent }}>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      <svg viewBox="0 0 200 158" className="mx-auto mt-1 w-full max-w-[210px]" role="img" aria-label={`${title}: ${value === null ? "no data" : `${value}%`}, target ${target}%`}>
        <path d={arc} fill="none" stroke={level?.track ?? VIZ.grid} strokeWidth={13} strokeLinecap="round" />
        {value !== null && value > 0 && (
          <path
            d={arc}
            pathLength={100}
            fill="none"
            stroke={level!.color}
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray={`${value} 100`}
            className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
          />
        )}
        <line x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y} stroke={VIZ.ink} strokeWidth={2} strokeLinecap="round" />
        <text x={100} y={104} textAnchor="middle" fontSize={36} fontWeight={600} fill={VIZ.ink}>{value === null ? "—" : `${value}%`}</text>
        <text x={100} y={127} textAnchor="middle" fontSize={12} fill={VIZ.muted}>Target {target}%</text>
      </svg>
      <div className="-mt-1 text-center text-sm font-medium text-slate-800">
        {level ? <><span aria-hidden className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white" style={{ background: level.color === LEVEL.watch.color ? "#92610a" : level.color }}>{level.icon}</span>{level.label}</> : "No data yet"}
      </div>
      <div className="mt-0.5 text-center text-xs text-slate-500">{detail}</div>
    </Link>
  );
}

export function ProgressRow({ label, value, target, detail, selected, onClick }: { label: string; value: number; target: number; detail: string; selected: boolean; onClick: () => void }) {
  const levelKey = levelFor(value, target);
  const level = LEVEL[levelKey];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group block w-full rounded-lg px-2 py-2 text-left transition hover:bg-slate-50 ${selected ? "bg-blue-50 ring-1 ring-blue-200" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-slate-500">{detail}</span>
          <span className="w-12 text-right font-semibold tabular-nums">{value}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: level.track }}>
        <div className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${Math.min(100, value)}%`, background: level.color }} />
      </div>
      {levelKey !== "good" && <div className="mt-1 text-xs text-slate-500"><span aria-hidden>{level.icon} </span>{level.label}, target {target}%</div>}
    </button>
  );
}

export type TrendPoint = { date: string; value: number; detail: string };

export function TrendChart({ points, minimum, title }: { points: TrendPoint[]; minimum: number; title: string }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const height = 240;
  const m = { left: 38, right: 46, top: 14, bottom: 26 };
  const plotW = Math.max(40, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const n = points.length;
  if (!n) return <div ref={ref} className="flex h-60 items-center justify-center text-sm text-slate-500">No attendance has been marked in this period.</div>;

  const low = Math.min(minimum, ...points.map((p) => p.value));
  const floor = Math.max(0, Math.floor((low - 4) / 10) * 10);
  const x = (i: number) => m.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => m.top + plotH - ((v - floor) / (100 - floor)) * plotH;
  const line = points.map((p, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(n - 1).toFixed(1)} ${y(floor)} L ${x(0).toFixed(1)} ${y(floor)} Z`;
  const ticks = Array.from({ length: Math.floor((100 - floor) / 10) + 1 }, (_, i) => floor + i * 10).filter((v, i, all) => all.length <= 6 || i % 2 === (all.length - 1) % 2);
  const labelCount = Math.min(n, width < 480 ? 3 : 6);
  const xLabels = [...new Set(Array.from({ length: labelCount }, (_, i) => (labelCount === 1 ? 0 : Math.round((i / (labelCount - 1)) * (n - 1)))))];
  const last = points[n - 1];

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    setActive(Math.max(0, Math.min(n - 1, Math.round((px / plotW) * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent<SVGRectElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((c) => Math.max(0, Math.min(n - 1, (c ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
  };
  const point = active === null ? null : points[Math.min(active, n - 1)];
  const activeIndex = active === null ? 0 : Math.min(active, n - 1);

  return (
    <div>
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={`${title}. Latest ${last.value}% on ${shortDate(last.date)}.`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.left} x2={m.left + plotW} y1={y(v)} y2={y(v)} stroke={VIZ.grid} />
              <text x={m.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={VIZ.muted}>{v}%</text>
            </g>
          ))}
          <line x1={m.left} x2={m.left + plotW} y1={y(minimum)} y2={y(minimum)} stroke={LEVEL.low.color} strokeOpacity={0.7} />
          <text x={m.left + 6} y={y(minimum) - 5} fontSize={11} fill={VIZ.muted}>{minimum}% minimum</text>
          <path d={area} fill={VIZ.accent} opacity={0.1} />
          <path d={line} fill="none" stroke={VIZ.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(n - 1)} cy={y(last.value)} r={4} fill={VIZ.accent} stroke={VIZ.surface} strokeWidth={2} />
          <text x={x(n - 1) + 8} y={y(last.value) + 4} fontSize={12} fontWeight={600} fill={VIZ.ink}>{last.value}%</text>
          {xLabels.map((i) => (
            <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill={VIZ.muted}>{shortDate(points[i].date)}</text>
          ))}
          {point && (
            <g pointerEvents="none">
              <line x1={x(activeIndex)} x2={x(activeIndex)} y1={m.top} y2={m.top + plotH} stroke={VIZ.muted} />
              <circle cx={x(activeIndex)} cy={y(point.value)} r={5} fill={VIZ.accent} stroke={VIZ.surface} strokeWidth={2} />
            </g>
          )}
          <rect
            x={m.left}
            y={m.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label="Move through days with the left and right arrow keys"
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(n - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
            className="outline-none"
          />
        </svg>
        {point && (
          <Tooltip x={x(activeIndex)} y={y(point.value)} width={width}>
            <div className="text-sm font-semibold text-slate-900">{point.value}%</div>
            <div className="text-slate-500">{shortDate(point.date)} · {point.detail}</div>
          </Tooltip>
        )}
      </div>
      <details className="mt-1 text-xs text-slate-500">
        <summary className="cursor-pointer">View as table</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Attendance</th><th>Students</th></tr></thead>
            <tbody>{[...points].reverse().map((p) => <tr key={p.date}><td>{shortDate(p.date)}</td><td>{p.value}%</td><td>{p.detail}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function ColumnChart({ points }: { points: { month: string; amount: number }[] }) {
  const [ref, width] = useWidth(320);
  const [active, setActive] = useState<number | null>(null);
  const height = 240;
  const m = { left: 44, right: 8, top: 22, bottom: 26 };
  const plotW = Math.max(40, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  if (!points.length) return <div ref={ref} className="flex h-60 items-center justify-center text-sm text-slate-500">No payments in this period.</div>;

  const peak = Math.max(...points.map((p) => p.amount), 1);
  // Round axis steps (1, 2, 2.5 or 5 times a power of ten), at most five intervals.
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const step = [0.1, 0.2, 0.25, 0.5, 1, 2].map((f) => f * magnitude).find((s) => peak / s <= 5) ?? magnitude;
  const top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const band = plotW / points.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => m.top + plotH - (v / top) * plotH;
  const barX = (i: number) => m.left + band * i + (band - barW) / 2;
  const column = (i: number, v: number) => {
    const X = barX(i);
    const Y = y(v);
    const bottom = y(0);
    if (bottom - Y < 4) return `M ${X} ${bottom} V ${Y} H ${X + barW} V ${bottom} Z`;
    return `M ${X} ${bottom} V ${Y + 4} Q ${X} ${Y} ${X + 4} ${Y} H ${X + barW - 4} Q ${X + barW} ${Y} ${X + barW} ${Y + 4} V ${bottom} Z`;
  };
  const lastIndex = points.length - 1;
  const current = active === null ? null : points[Math.min(active, lastIndex)];

  return (
    <div>
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={`Fees collected by month. Latest ${compactMoney(points[lastIndex].amount)}.`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.left} x2={m.left + plotW} y1={y(v)} y2={y(v)} stroke={VIZ.grid} />
              <text x={m.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={VIZ.muted}>{compactMoney(v)}</text>
            </g>
          ))}
          {points.map((p, i) => (
            <g key={p.month}>
              <path d={column(i, p.amount)} fill={VIZ.money} opacity={active === null || active === i ? 1 : 0.45} className="transition-opacity" />
              <text x={barX(i) + barW / 2} y={height - 8} textAnchor="middle" fontSize={11} fill={VIZ.muted}>{shortMonth(p.month)}</text>
              {i === lastIndex && <text x={barX(i) + barW / 2} y={y(p.amount) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill={VIZ.ink}>{compactMoney(p.amount)}</text>}
              <rect
                x={m.left + band * i}
                y={m.top}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${shortMonth(p.month)}: ${compactMoney(p.amount)}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
            </g>
          ))}
        </svg>
        {current && active !== null && (
          <Tooltip x={barX(Math.min(active, lastIndex)) + barW / 2} y={y(current.amount)} width={width}>
            <div className="text-sm font-semibold text-slate-900">₹{Math.round(current.amount).toLocaleString("en-IN")}</div>
            <div className="text-slate-500">Collected in {shortMonth(current.month)}</div>
          </Tooltip>
        )}
      </div>
      <details className="mt-1 text-xs text-slate-500">
        <summary className="cursor-pointer">View as table</summary>
        <table className="table mt-2">
          <thead><tr><th>Month</th><th>Collected</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.month}><td>{shortMonth(p.month)}</td><td>₹{Math.round(p.amount).toLocaleString("en-IN")}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
