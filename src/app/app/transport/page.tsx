import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, Empty, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { addRoute, addStop, deleteRoute, deleteStop, deleteVehicle, saveVehicle } from "@/app/actions/transport";
import { money } from "@/lib/utils";

export default async function TransportPage() {
  const { db, schoolId } = await requireSchoolUser(["ADMIN"]);
  const [routes, vehicles, drivers] = await Promise.all([
    db.busRoute.findMany({
      orderBy: { name: "asc" },
      include: { stops: { orderBy: { order: "asc" }, include: { _count: { select: { students: true } } } }, vehicles: true },
    }),
    db.vehicle.findMany({ include: { route: true, driver: true }, orderBy: { regNo: "asc" } }),
    prisma.user.findMany({ where: { schoolId, role: "DRIVER", active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transport"
        subtitle={`${routes.length} routes · ${vehicles.length} vehicles · ${routes.reduce((a, r) => a + r.stops.reduce((b, s) => b + s._count.students, 0), 0)} students using transport`}
        actions={<Link href="/app/transport/live" className="btn-primary">📍 Live map</Link>}
      />

      <Card title="Vehicles">
        {vehicles.length ? (
          <Table head={["Reg. no", "Model", "Capacity", "Route", "Driver", "Status", ""]}>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td className="font-medium">{v.regNo}</td>
                <td>{v.model ?? "—"}</td>
                <td>{v.capacity}</td>
                <td>{v.route?.name ?? "—"}</td>
                <td>{v.driver?.name ?? "—"}</td>
                <td><Badge color={v.tripActive ? "green" : "gray"}>{v.tripActive ? "On trip" : "Parked"}</Badge></td>
                <td className="text-right">
                  <ConfirmForm action={deleteVehicle} message={`Delete vehicle ${v.regNo}?`}>
                    <input type="hidden" name="id" value={v.id} />
                    <button className="text-xs text-rose-600 hover:underline">Delete</button>
                  </ConfirmForm>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No vehicles yet.</Empty>
        )}
        <ActionForm action={saveVehicle} className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Reg. no"><input name="regNo" className="input" required /></Field>
          <Field label="Model"><input name="model" className="input" /></Field>
          <Field label="Capacity"><input name="capacity" type="number" defaultValue={40} className="input" /></Field>
          <Field label="Route"><select name="routeId" className="input"><option value="">—</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <Field label="Driver (login)"><select name="driverId" className="input"><option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <div className="flex items-end"><Submit>Add vehicle</Submit></div>
        </ActionForm>
        <p className="mt-2 text-xs text-slate-500">Drivers are created from Staff with the “Bus driver” login. Drivers open “Trip &amp; GPS” on their phone to share live location.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {routes.map((r) => (
          <Card
            key={r.id}
            title={`${r.name} · ${money(r.fare)}/month`}
            actions={
              <ConfirmForm action={deleteRoute} message={`Delete ${r.name} and all its stops?`}>
                <input type="hidden" name="id" value={r.id} />
                <button className="text-xs text-rose-600 hover:underline">Delete route</button>
              </ConfirmForm>
            }
          >
            <p className="mb-2 text-xs text-slate-500">Bus: {r.vehicles.map((v) => v.regNo).join(", ") || "none"}</p>
            <Table head={["#", "Stop", "Pickup", "Students", ""]}>
              {r.stops.map((s) => (
                <tr key={s.id}>
                  <td>{s.order}</td>
                  <td>{s.name}<div className="font-mono text-[10px] text-slate-400">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</div></td>
                  <td>{s.pickupTime ?? "—"}</td>
                  <td>{s._count.students}</td>
                  <td className="text-right">
                    <ConfirmForm action={deleteStop} message={`Delete stop ${s.name}?`}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-xs text-rose-600 hover:underline">×</button>
                    </ConfirmForm>
                  </td>
                </tr>
              ))}
            </Table>
            <ActionForm action={addStop} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <input type="hidden" name="routeId" value={r.id} />
              <input name="name" placeholder="Stop name" className="input py-1 sm:col-span-2" required />
              <input name="lat" placeholder="Latitude" className="input py-1" required />
              <input name="lng" placeholder="Longitude" className="input py-1" required />
              <input name="pickupTime" type="time" className="input py-1" />
              <div className="col-span-2 sm:col-span-5"><Submit className="btn-secondary btn-sm">Add stop</Submit></div>
            </ActionForm>
          </Card>
        ))}
        <Card title="New route">
          <ActionForm action={addRoute} className="space-y-3">
            <Field label="Route name"><input name="name" className="input" required /></Field>
            <Field label="Monthly fare"><input name="fare" type="number" className="input" /></Field>
            <Submit>Add route</Submit>
          </ActionForm>
          <p className="mt-3 text-xs text-slate-500">Tip: get stop coordinates by right-clicking a place in Google Maps / OpenStreetMap and copying the latitude, longitude.</p>
        </Card>
      </div>
    </div>
  );
}
