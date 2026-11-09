import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tenantDb } from "@/lib/db";
import { getFamilyStudents } from "@/lib/family";

/**
 * Live bus positions for the map.
 * - Admin: every vehicle of the school.
 * - Parent / student: only the vehicle(s) on their child's route (optionally ?child=<studentId>).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const db = tenantDb(user.schoolId);
  const url = new URL(req.url);

  let routeIds: string[] | null = null; // null = all
  let myStopId: string | null = null;
  if (user.role === "PARENT" || user.role === "STUDENT") {
    const kids = await getFamilyStudents(db, user);
    const child = kids.find((k) => k.id === url.searchParams.get("child")) ?? kids.find((k) => k.busStop) ?? kids[0];
    routeIds = child?.busStop ? [child.busStop.routeId] : [];
    myStopId = child?.busStopId ?? null;
  } else if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = routeIds ? { routeId: { in: routeIds } } : {};
  const [vehicles, routes] = await Promise.all([
    db.vehicle.findMany({ where, include: { route: true, driver: { select: { name: true, phone: true } } } }),
    db.busRoute.findMany({ where: routeIds ? { id: { in: routeIds } } : {}, include: { stops: { orderBy: { order: "asc" } } } }),
  ]);
  // Recent trail (last 30 minutes) for each vehicle on an active trip.
  const since = new Date(Date.now() - 30 * 60_000);
  const trails = await Promise.all(
    vehicles.filter((v) => v.tripActive).map(async (v) => ({
      id: v.id,
      points: (await db.locationPing.findMany({ where: { vehicleId: v.id, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, select: { lat: true, lng: true } })).map((p) => [p.lat, p.lng]),
    })),
  );

  return NextResponse.json({
    vehicles: vehicles.map((v) => ({
      id: v.id, regNo: v.regNo, route: v.route?.name ?? null, driver: v.driver?.name ?? null, driverPhone: v.driver?.phone ?? null,
      tripActive: v.tripActive, lat: v.lastLat, lng: v.lastLng, speed: v.lastSpeed, lastSeenAt: v.lastSeenAt,
      trail: trails.find((t) => t.id === v.id)?.points ?? [],
    })),
    stops: routes.flatMap((r) => r.stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, route: r.name, pickupTime: s.pickupTime, mine: s.id === myStopId }))),
  });
}
