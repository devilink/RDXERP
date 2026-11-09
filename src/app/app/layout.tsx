import { requireSchoolUser } from "@/lib/auth";
import { NAV, ROLE_LABEL, type Role } from "@/lib/constants";
import { Sidebar } from "@/components/sidebar";
import { logoutAction } from "@/app/actions/auth";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { user, school } = await requireSchoolUser();
  const items = NAV.filter((n) => n.roles.includes(user.role as Role));
  // Only accept a plain hex colour from the DB to avoid CSS injection.
  const brand = /^#[0-9a-fA-F]{6}$/.test(school.primaryColor) ? school.primaryColor : "#4f46e5";

  return (
    <div style={{ ["--brand" as string]: brand }}>
      <Sidebar items={items} schoolName={school.name} logoUrl={school.logoUrl} />
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
          <div className="text-right">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-slate-500">{ROLE_LABEL[user.role as Role]}</div>
          </div>
          <form action={logoutAction}>
            <button className="btn-secondary btn-sm">Log out</button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
