import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { tenantDb } from "@/lib/db";

/**
 * Driver phone posts its GPS position here every few seconds while a trip is active.
 * Body: { lat: number, lng: number, speed?: number (m/s) }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DRIVER" || !user.schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const db = tenantDb(user.schoolId);

  let body: { lat?: unknown; lng?: unknown; speed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const speed = body.speed == null ? null : Number(body.speed);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const vehicle = await db.vehicle.findFirst({ where: { driverId: user.id, tripActive: true } });
  if (!vehicle) return NextResponse.json({ error: "No active trip" }, { status: 409 });

  const now = new Date();
  const kmh = speed !== null && Number.isFinite(speed) ? Math.round(speed * 3.6) : null;
  await db.vehicle.update({ where: { id: vehicle.id }, data: { lastLat: lat, lastLng: lng, lastSpeed: kmh, lastSeenAt: now } });
  // Keep a history trail, at most one point every 10 seconds.
  const lastPoint = await db.locationPing.findFirst({ where: { vehicleId: vehicle.id }, orderBy: { createdAt: "desc" } });
  if (!lastPoint || now.getTime() - lastPoint.createdAt.getTime() >= 10_000) {
    await db.locationPing.create({ data: { schoolId: user.schoolId, vehicleId: vehicle.id, lat, lng, speed: kmh } });
  }
  return NextResponse.json({ ok: true, at: now.toISOString() });
}
