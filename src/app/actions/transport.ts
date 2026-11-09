"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionGuard } from "@/lib/auth";
import { failed, num, optStr, str, type ActionState } from "@/lib/utils";

export async function addRoute(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const name = str(fd, "name");
    if (!name) return { ok: false, message: "Route name is required." };
    await db.busRoute.create({ data: { schoolId, name, fare: num(fd, "fare") } });
    revalidatePath("/app/transport");
    return { ok: true, message: "Route added." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteRoute(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  await db.busRoute.deleteMany({ where: { id: str(fd, "id") } });
  revalidatePath("/app/transport");
}

export async function addStop(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const route = await db.busRoute.findFirst({ where: { id: str(fd, "routeId") }, include: { _count: { select: { stops: true } } } });
    if (!route) return { ok: false, message: "Route not found." };
    const lat = num(fd, "lat", NaN);
    const lng = num(fd, "lng", NaN);
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return { ok: false, message: "Enter valid latitude and longitude." };
    await db.busStop.create({
      data: { schoolId, routeId: route.id, name: str(fd, "name"), lat, lng, pickupTime: optStr(fd, "pickupTime"), order: num(fd, "order", route._count.stops + 1) },
    });
    revalidatePath("/app/transport");
    return { ok: true, message: "Stop added." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteStop(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  await db.busStop.deleteMany({ where: { id: str(fd, "id") } });
  revalidatePath("/app/transport");
}

export async function saveVehicle(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard(["ADMIN"]);
    const routeId = optStr(fd, "routeId");
    const driverId = optStr(fd, "driverId");
    if (routeId && !(await db.busRoute.findFirst({ where: { id: routeId } }))) return { ok: false, message: "Invalid route." };
    if (driverId && !(await prisma.user.findFirst({ where: { id: driverId, schoolId, role: "DRIVER" } }))) return { ok: false, message: "Invalid driver." };
    const data = { regNo: str(fd, "regNo").toUpperCase(), model: optStr(fd, "model"), capacity: num(fd, "capacity", 40), routeId, driverId };
    if (!data.regNo) return { ok: false, message: "Registration number is required." };
    const id = optStr(fd, "id");
    if (id) await db.vehicle.update({ where: { id }, data });
    else await db.vehicle.create({ data: { schoolId, ...data } });
    revalidatePath("/app/transport");
    return { ok: true, message: "Vehicle saved." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteVehicle(fd: FormData) {
  const { db } = await actionGuard(["ADMIN"]);
  await db.vehicle.deleteMany({ where: { id: str(fd, "id") } });
  revalidatePath("/app/transport");
}

/** Driver starts / ends the trip for their vehicle. */
export async function setTrip(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, user } = await actionGuard(["DRIVER"]);
    const vehicle = await db.vehicle.findFirst({ where: { driverId: user.id, id: str(fd, "vehicleId") } });
    if (!vehicle) return { ok: false, message: "No bus is assigned to you." };
    const active = str(fd, "active") === "1";
    await db.vehicle.update({ where: { id: vehicle.id }, data: { tripActive: active } });
    revalidatePath("/app/driver");
    return { ok: true, message: active ? "Trip started — keep this page open." : "Trip ended." };
  } catch (e) {
    return failed(e);
  }
}
