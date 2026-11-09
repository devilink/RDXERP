"use client";

import type { ReactNode } from "react";

/** A plain server-action form that asks for confirmation before submitting (for deletes). */
export function ConfirmForm({ action, message, children, className }: { action: (fd: FormData) => void | Promise<void>; message: string; children: ReactNode; className?: string }) {
  return (
    <form action={action} className={className} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </form>
  );
}
