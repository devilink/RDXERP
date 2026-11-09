"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/utils";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Form bound to a server action that returns {ok, message}.
 * Submits via startTransition (not the `action` prop) so React does NOT auto-reset
 * the fields: on failure the user keeps what they typed; on success we reset only if `reset`.
 */
export function ActionForm({
  action,
  children,
  className,
  reset = true,
  confirm,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  reset?: boolean;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && reset) ref.current?.reset();
  }, [state, reset]);
  return (
    <form
      ref={ref}
      className={className}
      data-pending={pending ? "" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.message && (
        <p className={`mt-3 text-sm ${state.ok ? "text-emerald-600" : "text-rose-600"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, className = "btn-primary", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  return (
    <button type="submit" className={className}>
      <span className="in-data-pending:hidden">{children}</span>
      <span className="hidden in-data-pending:inline">{pendingText ?? "Saving…"}</span>
    </button>
  );
}
