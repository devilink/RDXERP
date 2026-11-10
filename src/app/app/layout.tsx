import { requireSchoolUser } from "@/lib/auth";
import { LMS_NAV, NAV, ROLE_LABEL, type Role } from "@/lib/constants";
import { Sidebar } from "@/components/sidebar";
import { logoutAction } from "@/app/actions/auth";
import { exitSchool } from "@/app/actions/super";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { user, school } = await requireSchoolUser();
  const items = NAV.filter((n) => n.roles.includes(user.role as Role));
  const lmsItems = LMS_NAV.filter((n) => n.roles.includes(user.role as Role));
  // Only accept a plain hex colour from the DB to avoid CSS injection.
  const brand = /^#[0-9a-fA-F]{6}$/.test(school.primaryColor) ? school.primaryColor : "#4f46e5";

  return (
    <div style={{ ["--brand" as string]: brand }}>
      <Sidebar items={items} lmsItems={lmsItems} schoolName={school.name} logoUrl={school.logoUrl} />
      <div className="lg:pl-64">
        {user.viewingAsOwner && (
          <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-slate-900 py-2 pl-14 pr-6 text-sm text-slate-50 lg:pl-6">
            <span>You are inside <b>{school.name}</b> as the platform owner. Changes you make here are real.</span>
            <form action={exitSchool}>
              <button className="rounded-md bg-surface px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-200">Back to platform console</button>
            </form>
          </div>
        )}
        <header className="no-print sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-slate-200 bg-surface/80 px-6 py-3 backdrop-blur">
          <div className="text-right">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-slate-500">{user.viewingAsOwner ? "Platform owner" : ROLE_LABEL[user.role as Role]}</div>
          </div>
          <ThemeToggle />
          <form action={logoutAction}>
            <button className="btn-secondary btn-sm">Log out</button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
