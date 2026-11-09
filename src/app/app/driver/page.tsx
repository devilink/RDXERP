import { requireSchoolUser } from "@/lib/auth";
import { Card, Empty, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { DriverTracker } from "@/components/driver-tracker";
import { setTrip } from "@/app/actions/transport";

export default async function DriverPage() {
  const { db, user } = await requireSchoolUser(["DRIVER"]);
  const vehicle = await db.vehicle.findFirst({
    where: { driverId: user.id },
    include: { route: { include: { stops: { orderBy: { order: "asc" }, include: { _count: { select: { students: true } } } } } } },
  });
  if (!vehicle) return <Empty>No bus has been assigned to you. Please contact the school office.</Empty>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title={`Bus ${vehicle.regNo}`} subtitle={vehicle.route?.name ?? "No route assigned"} />
      <DriverTracker active={vehicle.tripActive} />
      <ActionForm action={setTrip} reset={false}>
        <input type="hidden" name="vehicleId" value={vehicle.id} />
        <input type="hidden" name="active" value={vehicle.tripActive ? "0" : "1"} />
        <Submit className={`${vehicle.tripActive ? "btn-danger" : "btn-primary"} w-full py-4 text-lg`}>
          {vehicle.tripActive ? "■ End trip" : "▶ Start trip & share location"}
        </Submit>
      </ActionForm>
      <p className="text-xs text-slate-500">Keep this page open with the screen on while driving. Parents see the bus on their map in real time.</p>
      {vehicle.route && (
        <Card title="Stops">
          <ol className="space-y-2 text-sm">
            {vehicle.route.stops.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{s.order}. {s.name}</span>
                <span className="text-slate-500">{s.pickupTime ?? ""} · {s._count.students} students</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
