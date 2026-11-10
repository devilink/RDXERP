import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { TONES } from "@/lib/constants";

const FEATURES = [
  ["🧑‍🎓", "Student Information", "Admissions, profiles, guardians, parent logins and class promotion."],
  ["✅", "Attendance", "One-tap daily marking per section with monthly registers and parent visibility."],
  ["📝", "Exams & Results", "Exam routine, marks entry, grading scale, ranks and printable report cards."],
  ["🚌", "Live School Bus Tracking", "Driver phone GPS, live map for admins and parents, routes & stops."],
  ["💰", "Fees & Accounts", "Fee structures, bulk invoicing, receipts, dues and collection reports."],
  ["🗓️", "Timetable", "Weekly class timetable with teacher allocation."],
  ["📢", "Notices & Calendar", "Targeted announcements, holidays and events."],
  ["📚", "Homework & Library", "Assignments by section and book issue/return tracking."],
  ["🏢", "Multi-School SaaS", "One platform, many schools — fully isolated data, plans and branding."],
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "SUPER_ADMIN" ? "/super" : "/app");
  return (
    <main className="min-h-screen bg-surface">
      <header className="mx-auto flex max-w-6xl items-center justify-between p-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">🎓</span> Radix School ERP
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="btn-primary">Sign in</Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Run your entire school from one place</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Attendance, exams, results, live bus tracking, fees, timetable and communication — for admins, teachers, parents, students and drivers.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login" className="btn-primary px-6 py-3 text-base">Get started</Link>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([icon, title, desc], i) => (
          <div key={title} className={`card tone-card tone-${TONES[i % TONES.length]}`}>
            <div className="text-2xl">{icon}</div>
            <h3 className="mt-2 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
