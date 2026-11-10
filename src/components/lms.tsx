import Link from "next/link";

/** Lets a parent with more than one child choose whose learning they are looking at. */
export function ChildPicker({ kids, currentId }: { kids: { id: string; firstName: string }[]; currentId?: string }) {
  if (kids.length < 2) return null;
  return (
    <div className="flex gap-2">
      {kids.map((k) => (
        <Link key={k.id} href={`?child=${k.id}`} className={k.id === currentId ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
          {k.firstName}
        </Link>
      ))}
    </div>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{done} of {total} lessons</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--viz-accent-track)" }} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: "var(--viz-accent)" }} />
      </div>
    </div>
  );
}

export const NO_CHILD = "No student is linked to your account yet. Please contact the school office.";
