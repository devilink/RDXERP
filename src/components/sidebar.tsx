"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { NavItem } from "@/lib/constants";
import { cls } from "@/lib/utils";

export function Sidebar({ items, schoolName, logoUrl }: { items: NavItem[]; schoolName: string; logoUrl?: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Longest matching prefix wins so /app/attendance/report doesn't also light up /app/attendance.
  const active = items
    .filter((i) => path === i.href || (i.href !== "/app" && path.startsWith(i.href + "/")) || path === i.href)
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <button className="no-print fixed left-3 top-3 z-40 rounded-lg bg-white p-2 shadow lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
        ☰
      </button>
      <aside
        className={cls(
          "no-print fixed inset-y-0 left-0 z-30 w-64 transform overflow-y-auto border-r border-slate-200 bg-white transition lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: "var(--brand)" }}>
              🎓
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{schoolName}</div>
            <div className="text-xs text-slate-400">School ERP</div>
          </div>
        </div>
        <nav className="space-y-0.5 p-3">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              className={cls(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                active === i.href ? "font-medium text-white" : "text-slate-600 hover:bg-slate-100",
              )}
              style={active === i.href ? { background: "var(--brand)" } : undefined}
            >
              <span className="w-5 text-center">{i.icon}</span>
              {i.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
