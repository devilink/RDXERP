import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { Empty, PageHeader } from "@/components/ui";
import { LiveMap } from "@/components/live-map";
import { getFamilyStudents } from "@/lib/family";

export default async function LivePage({ searchParams }: PageProps<"/app/transport/live">) {
  const { db, user } = await requireSchoolUser(["ADMIN", "PARENT", "STUDENT"]);
  const sp = await searchParams;
  let child: string | undefined;
  let tabs: { id: string; name: string }[] = [];
  if (user.role !== "ADMIN") {
    const kids = (await getFamilyStudents(db, user)).filter((k) => k.busStopId);
    if (!kids.length) return <Empty>Your child is not registered for school transport.</Empty>;
    child = kids.find((k) => k.id === sp.child)?.id ?? kids[0].id;
    tabs = kids.map((k) => ({ id: k.id, name: k.firstName }));
  }
  return (
    <div>
      <PageHeader title="Live bus tracking" subtitle="Positions refresh automatically every 5 seconds." />
      {tabs.length > 1 && (
        <div className="mb-4 flex gap-2">
          {tabs.map((t) => <Link key={t.id} href={`?child=${t.id}`} className={t.id === child ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{t.name}</Link>)}
        </div>
      )}
      <LiveMap child={child} />
    </div>
  );
}
