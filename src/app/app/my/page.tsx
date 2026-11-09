import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { Empty, PageHeader } from "@/components/ui";
import { StudentOverview } from "@/components/student-overview";
import { getFamilyStudent } from "@/lib/family";

export default async function MyChildPage({ searchParams }: PageProps<"/app/my">) {
  const { db, user } = await requireSchoolUser(["PARENT", "STUDENT"]);
  const sp = await searchParams;
  const { kids, child } = await getFamilyStudent(db, user, typeof sp.child === "string" ? sp.child : undefined);
  if (!child) return <Empty>No student is linked to your account yet. Please contact the school office.</Empty>;

  return (
    <div>
      <PageHeader title={`${child.firstName} ${child.lastName}`} subtitle={child.section ? `${child.section.class.name} – ${child.section.name}` : undefined} />
      {kids.length > 1 && (
        <div className="mb-4 flex gap-2">
          {kids.map((k) => <Link key={k.id} href={`?child=${k.id}`} className={k.id === child.id ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{k.firstName}</Link>)}
        </div>
      )}
      <StudentOverview db={db} studentId={child.id} family month={typeof sp.month === "string" ? sp.month : undefined} />
    </div>
  );
}
