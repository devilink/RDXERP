import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./db";

const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
const EMAIL_LIMIT = 5;
// A whole school can share one public IP, so this limit is deliberately high.
const IP_LIMIT = 50;

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export type LoginKeys = { email: string; ip: string | null };

export async function loginKeys(email: string): Promise<LoginKeys> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim();
  return { email: `email:${hash(email)}`, ip: ip ? `ip:${hash(ip)}` : null };
}

export async function isLockedOut(keys: LoginKeys) {
  const key = { in: [keys.email, ...(keys.ip ? [keys.ip] : [])] };
  return (await prisma.loginAttempt.count({ where: { key, lockedUntil: { gt: new Date() } } })) > 0;
}

/** Counts one failure atomically, so parallel guesses cannot slip past the limit. */
async function bump(key: string, limit: number) {
  const now = new Date();
  const stale = new Date(now.getTime() - WINDOW_MS);
  const lockedUntil = new Date(now.getTime() + LOCK_MS);
  await prisma.$executeRaw`
    INSERT INTO "LoginAttempt" ("key", "failures", "windowStart")
    VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "failures" = CASE WHEN "LoginAttempt"."windowStart" < ${stale} THEN 1 ELSE "LoginAttempt"."failures" + 1 END,
      "windowStart" = CASE WHEN "LoginAttempt"."windowStart" < ${stale} THEN ${now} ELSE "LoginAttempt"."windowStart" END,
      "lockedUntil" = CASE
        WHEN "LoginAttempt"."windowStart" >= ${stale} AND "LoginAttempt"."failures" + 1 >= ${limit} THEN ${lockedUntil}
        ELSE "LoginAttempt"."lockedUntil"
      END`;
}

export async function recordFailure(keys: LoginKeys) {
  await bump(keys.email, EMAIL_LIMIT);
  if (keys.ip) await bump(keys.ip, IP_LIMIT);
  // Occasional cleanup, so guesses at random emails cannot grow the table forever.
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
    await prisma.loginAttempt.deleteMany({
      where: { windowStart: { lt: cutoff }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
    });
  }
}

export async function clearEmailFailures(keys: LoginKeys) {
  await prisma.loginAttempt.deleteMany({ where: { key: keys.email } });
}
