import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/action-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "SUPER_ADMIN" ? "/super" : "/app");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-500 p-4">
      <div className="fixed right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-2xl text-white">🎓</div>
          <h1 className="text-2xl font-semibold">Radix School ERP</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your school account</p>
        </div>
        <ActionForm action={loginAction} reset={false} className="space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input name="email" type="email" required autoComplete="username" className="input" placeholder="you@school.com" />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </label>
          <Submit className="btn-primary w-full" pendingText="Signing in…">
            Sign in
          </Submit>
        </ActionForm>
        <p className="mt-6 text-center text-xs text-slate-400">Admins, teachers, parents, students and drivers all sign in here.</p>
      </div>
    </main>
  );
}
