"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { GraphEdge, GraphNode, GraphNodeType } from "@/lib/dashboard";

const WIDTH = 960;
const HEIGHT = 580;
const MARGIN = 46;

type Point = { x: number; y: number };
type Filterable = Exclude<GraphNodeType, "school">;

// Each type has its own colour and its own shape, so identity never depends on colour alone.
const TYPES: Record<GraphNodeType, { label: string; color: string; size: number }> = {
  school: { label: "School", color: "var(--graph-school)", size: 19 },
  class: { label: "Classes", color: "var(--graph-class)", size: 14 },
  section: { label: "Sections", color: "var(--graph-section)", size: 8 },
  subject: { label: "Subjects", color: "var(--graph-subject)", size: 12 },
  teacher: { label: "Teachers", color: "var(--graph-teacher)", size: 9 },
  route: { label: "Bus routes", color: "var(--graph-route)", size: 12 },
};
const SINGULAR: Record<GraphNodeType, string> = { school: "School", class: "Class", section: "Section", subject: "Subject", teacher: "Teacher", route: "Bus route" };
const FILTERS: Filterable[] = ["class", "section", "subject", "teacher", "route"];
const LABELLED_ALWAYS = new Set<GraphNodeType>(["school", "class", "section", "subject", "route"]);
const REST: Partial<Record<string, number>> = { "school-class": 150, "class-section": 90, "section-teacher": 130, "class-subject": 200, "subject-teacher": 90, "route-class": 190 };
// Links shared by every class would drag the classes together, so they pull only gently.
const PULL: Partial<Record<string, number>> = { "class-subject": 0.002, "route-class": 0.003, "section-teacher": 0.01, "subject-teacher": 0.012 };
// Concentric rings keep the graph readable: school, classes, sections, then the wider web.
const RING: Record<GraphNodeType, number> = { school: 0, class: 135, section: 225, subject: 310, route: 310, teacher: 395 };
const STRETCH = 1.55;
const MIN_SPACING = 62;

function Shape({ type, size, fill, stroke = "var(--color-surface)", strokeWidth = 2 }: { type: GraphNodeType; size: number; fill: string; stroke?: string; strokeWidth?: number }) {
  const common = { fill, stroke, strokeWidth };
  if (type === "section") return <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={2} {...common} />;
  if (type === "subject") return <polygon points={`0,${-size * 1.25} ${size * 1.25},0 0,${size * 1.25} ${-size * 1.25},0`} {...common} />;
  if (type === "teacher") return <polygon points={`0,${-size * 1.2} ${size * 1.1},${size * 0.8} ${-size * 1.1},${size * 0.8}`} {...common} />;
  if (type === "route") {
    const pts = Array.from({ length: 6 }, (_, i) => `${(size * 1.15 * Math.cos((Math.PI / 3) * i)).toFixed(2)},${(size * 1.15 * Math.sin((Math.PI / 3) * i)).toFixed(2)}`);
    return <polygon points={pts.join(" ")} {...common} />;
  }
  return <circle r={size} {...common} />;
}

/** A deterministic force layout, so the server and browser draw the same picture. */
function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): Record<string, Point> {
  const byType = (t: GraphNodeType) => nodes.filter((n) => n.type === t);
  const position = new Map<string, Point>();
  const ring = (list: GraphNode[], radius: number, offset: number) =>
    list.forEach((n, i) => {
      const a = (i / Math.max(1, list.length)) * Math.PI * 2 + offset;
      position.set(n.id, { x: Math.cos(a) * radius * STRETCH, y: Math.sin(a) * radius });
    });
  ring(byType("school"), 0, 0);
  ring(byType("class"), RING.class, -Math.PI / 2);
  // Two sections per class sit on either side of their class's angle.
  ring(byType("section"), RING.section, -Math.PI / 2 - Math.PI / 16);
  // Routes are spaced out between the subjects so their labels do not collide.
  const routes = byType("route");
  const subjects = byType("subject");
  const gap = Math.max(1, Math.floor(subjects.length / Math.max(1, routes.length)));
  ring(subjects.flatMap((n, i) => ((i + 1) % gap === 0 && routes[(i + 1) / gap - 1] ? [n, routes[(i + 1) / gap - 1]] : [n])).concat(routes.slice(Math.floor(subjects.length / gap))), RING.subject, 0.2);
  ring(byType("teacher"), RING.teacher, 0);

  const ids = nodes.map((n) => n.id);
  const typeOf = new Map(nodes.map((n) => [n.id, n.type]));
  const links = edges.filter((e) => position.has(e.source) && position.has(e.target));

  for (let step = 0; step < 340; step++) {
    const heat = 1 - step / 340;
    const move = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = position.get(ids[i])!;
        const b = position.get(ids[j])!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = Math.max(120, dx * dx + dy * dy);
        const d = Math.sqrt(d2);
        const f = 5200 / d2;
        move.get(ids[i])!.x += (dx / d) * f;
        move.get(ids[i])!.y += (dy / d) * f;
        move.get(ids[j])!.x -= (dx / d) * f;
        move.get(ids[j])!.y -= (dy / d) * f;
      }
    }
    for (const e of links) {
      const a = position.get(e.source)!;
      const b = position.get(e.target)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const key = `${typeOf.get(e.source)}-${typeOf.get(e.target)}`;
      const f = (d - (REST[key] ?? 120)) * (PULL[key] ?? 0.022);
      move.get(e.source)!.x += (dx / d) * f;
      move.get(e.source)!.y += (dy / d) * f;
      move.get(e.target)!.x -= (dx / d) * f;
      move.get(e.target)!.y -= (dy / d) * f;
    }
    for (const id of ids) {
      const p = position.get(id)!;
      const m = move.get(id)!;
      const speed = Math.max(1, Math.hypot(m.x, m.y) / (26 * heat + 1));
      p.x += m.x / speed;
      p.y += m.y / speed;
      const target = RING[typeOf.get(id)!];
      const nx = p.x / STRETCH;
      const r = Math.max(1, Math.hypot(nx, p.y));
      const pull = (target - r) * 0.08;
      p.x += (nx / r) * pull * STRETCH;
      p.y += (p.y / r) * pull;
    }
  }

  // Finally push apart anything still overlapping. Labels are wide, so spacing is measured wider sideways.
  for (let pass = 0; pass < 80; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = position.get(ids[i])!;
        const b = position.get(ids[j])!;
        const dx = (a.x - b.x) / STRETCH;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d >= MIN_SPACING) continue;
        const nx = d ? dx / d : 1;
        const ny = d ? dy / d : 0;
        const push = (MIN_SPACING - d) / 2;
        a.x += nx * push * STRETCH;
        a.y += ny * push;
        b.x -= nx * push * STRETCH;
        b.y -= ny * push;
      }
    }
  }

  // Fit the result to the drawing area.
  const all = [...position.values()];
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  const fitted: Record<string, Point> = {};
  for (const [id, p] of position) {
    fitted[id] = {
      x: +(MARGIN + ((p.x - minX) / Math.max(1, maxX - minX)) * (WIDTH - MARGIN * 2)).toFixed(1),
      y: +(MARGIN + ((p.y - minY) / Math.max(1, maxY - minY)) * (HEIGHT - MARGIN * 2)).toFixed(1),
    };
  }
  return fitted;
}

export function KnowledgeGraph({ nodes, edges, focusClassId, onFocusClass }: { nodes: GraphNode[]; edges: GraphEdge[]; focusClassId: string | null; onFocusClass: (classId: string) => void }) {
  const layout = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);
  const [moved, setMoved] = useState<Record<string, Point>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<Filterable>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const neighbours = useMemo(() => {
    const map = new Map<string, { id: string; relation: string }[]>();
    const add = (a: string, b: string, relation: string) => map.set(a, [...(map.get(a) ?? []), { id: b, relation }]);
    for (const e of edges) {
      add(e.source, e.target, e.relation);
      add(e.target, e.source, e.relation);
    }
    return map;
  }, [edges]);

  const isVisible = (id: string) => {
    const t = nodeById.get(id)?.type;
    return !!t && (t === "school" || !hidden.has(t));
  };
  const at = (id: string) => moved[id] ?? layout[id];

  const active = hovered ?? selected;
  const highlight = useMemo(() => {
    if (active) return new Set([active, ...(neighbours.get(active) ?? []).map((n) => n.id)]);
    if (!focusClassId) return null;
    // A selected class lights up its sections, their teachers, its subjects and its buses.
    const root = `c:${focusClassId}`;
    const set = new Set([root]);
    for (const first of neighbours.get(root) ?? []) {
      if (nodeById.get(first.id)?.type === "school") continue;
      set.add(first.id);
      if (nodeById.get(first.id)?.type === "section") (neighbours.get(first.id) ?? []).forEach((n) => set.add(n.id));
    }
    return set;
  }, [active, focusClassId, neighbours, nodeById]);

  const toSvg = (e: PointerEvent): Point | null => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: p.x, y: p.y };
  };
  const onDown = (e: PointerEvent<SVGGElement>, id: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, startX: e.clientX, startY: e.clientY, moved: false };
  };
  const onMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true;
    if (!d.moved) return;
    const p = toSvg(e);
    if (p) setMoved((m) => ({ ...m, [d.id]: { x: Math.max(14, Math.min(WIDTH - 14, p.x)), y: Math.max(14, Math.min(HEIGHT - 14, p.y)) } }));
  };
  const onUp = (id: string) => {
    if (drag.current && !drag.current.moved) setSelected((s) => (s === id ? null : id));
    drag.current = null;
  };
  const toggleType = (t: Filterable) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const panelId = selected ?? hovered;
  const panel = panelId ? nodeById.get(panelId) : null;
  const connections = panelId ? (neighbours.get(panelId) ?? []).filter((n) => isVisible(n.id)) : [];
  const counts = FILTERS.map((t) => ({ t, n: nodes.filter((x) => x.type === t).length }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={!hidden.has(t)}
              onClick={() => toggleType(t)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${hidden.has(t) ? "border-slate-200 text-slate-400 line-through" : "border-slate-300 bg-surface text-slate-700 hover:bg-slate-50"}`}
            >
              <svg width={16} height={16} viewBox="-10 -10 20 20" aria-hidden><Shape type={t} size={t === "section" ? 6 : 7} fill={hidden.has(t) ? "var(--color-slate-300)" : TYPES[t].color} strokeWidth={0} /></svg>
              {TYPES[t].label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">Drag to rearrange · click to explore</span>
          <button type="button" onClick={() => { setMoved({}); setSelected(null); setHidden(new Set()); }} className="btn-secondary btn-sm">Reset</button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none rounded-xl border border-slate-100 bg-slate-50/50"
          role="img"
          aria-label={`Knowledge graph of ${nodes.length} school entities and ${edges.length} connections. A list view is available below.`}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          {edges.map((e) => {
            if (!isVisible(e.source) || !isVisible(e.target) || !at(e.source) || !at(e.target)) return null;
            const lit = highlight ? highlight.has(e.source) && highlight.has(e.target) && (!active || e.source === active || e.target === active || !!focusClassId) : false;
            return (
              <line
                key={`${e.source}|${e.target}|${e.relation}`}
                x1={at(e.source).x}
                y1={at(e.source).y}
                x2={at(e.target).x}
                y2={at(e.target).y}
                stroke={lit ? "var(--color-slate-600)" : "var(--color-slate-300)"}
                strokeWidth={lit ? 1.5 : 1}
                opacity={highlight ? (lit ? 0.95 : 0.1) : 0.55}
              />
            );
          })}
          {nodes.map((n) => {
            if (!isVisible(n.id) || !at(n.id)) return null;
            const p = at(n.id);
            const on = !highlight || highlight.has(n.id);
            const size = TYPES[n.type].size;
            const showLabel = LABELLED_ALWAYS.has(n.type) || (highlight?.has(n.id) ?? false);
            const label = n.type === "school" ? n.label : n.label.replace(/^Route (\d+) - /, "R$1 ");
            return (
              <g
                key={n.id}
                transform={`translate(${p.x} ${p.y})`}
                opacity={on ? 1 : 0.18}
                className="cursor-grab transition-opacity active:cursor-grabbing"
                onPointerDown={(e) => onDown(e, n.id)}
                onPointerMove={onMove}
                onPointerUp={() => onUp(n.id)}
                onPointerEnter={() => setHovered(n.id)}
                onPointerLeave={() => setHovered(null)}
              >
                <circle r={Math.max(16, size + 6)} fill="transparent" />
                {selected === n.id && <circle r={size + 8} fill="none" stroke="var(--color-slate-900)" strokeWidth={2} />}
                <Shape type={n.type} size={size} fill={TYPES[n.type].color} />
                {showLabel && (
                  <text
                    y={n.type === "school" ? -size - 8 : size + 14}
                    textAnchor="middle"
                    fontSize={n.type === "section" ? 10 : 12}
                    fontWeight={n.type === "class" || n.type === "school" ? 600 : 500}
                    fill="var(--color-slate-900)"
                    stroke="var(--color-surface)"
                    strokeWidth={3}
                    paintOrder="stroke"
                    pointerEvents="none"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <details className="mt-2 text-xs text-slate-500">
          <summary className="cursor-pointer">Browse as a list</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FILTERS.map((t) => (
              <div key={t}>
                <div className="mb-1 font-semibold text-slate-700">{TYPES[t].label}</div>
                <div className="flex flex-wrap gap-1">
                  {nodes.filter((n) => n.type === t).map((n) => (
                    <button key={n.id} type="button" onClick={() => setSelected(n.id)} className="rounded border border-slate-200 bg-surface px-1.5 py-0.5 text-slate-700 hover:bg-slate-50">{n.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>

      <aside className="rounded-xl border border-slate-200 p-4" aria-live="polite">
        {panel ? (
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <svg width={16} height={16} viewBox="-10 -10 20 20" aria-hidden><Shape type={panel.type} size={7} fill={TYPES[panel.type].color} strokeWidth={0} /></svg>
              {SINGULAR[panel.type]}
            </div>
            <h3 className="mt-1 text-lg font-semibold leading-tight">{panel.label}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{panel.meta}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {panel.href && <Link href={panel.href} className="btn-primary btn-sm">Open</Link>}
              {panel.type === "class" && <button type="button" className="btn-secondary btn-sm" onClick={() => onFocusClass(panel.id.slice(2))}>Filter dashboard</button>}
            </div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Connected to ({connections.length})</div>
            <ul className="mt-1 max-h-72 space-y-0.5 overflow-y-auto">
              {connections.map((c) => (
                <li key={`${c.id}|${c.relation}`}>
                  <button type="button" onClick={() => setSelected(c.id)} className="flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-slate-100">
                    <span className="truncate">{nodeById.get(c.id)?.label}</span>
                    <span className="shrink-0 text-xs text-slate-400">{c.relation.replace(/^Carries (\d+) students from$/, "$1 riders")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <h3 className="font-semibold">How the school connects</h3>
            <p className="mt-1 text-sm text-slate-500">Hover over anything to light up what it links to. Click a teacher to see their classes, or a class to see its sections, subjects and buses.</p>
            <dl className="mt-4 space-y-1.5 text-sm">
              {counts.map(({ t, n }) => (
                <div key={t} className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-slate-600">
                    <svg width={16} height={16} viewBox="-10 -10 20 20" aria-hidden><Shape type={t} size={7} fill={TYPES[t].color} strokeWidth={0} /></svg>
                    {TYPES[t].label}
                  </dt>
                  <dd className="font-semibold tabular-nums">{n}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                <dt className="text-slate-600">Connections</dt>
                <dd className="font-semibold tabular-nums">{edges.length}</dd>
              </div>
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}
