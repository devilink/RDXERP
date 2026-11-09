import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Raw client. Use ONLY for platform-level work (super admin, auth lookups). */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Models that do not carry a schoolId column. */
const UNSCOPED = new Set(["School", "User", "LoginAttempt"]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * Tenant-isolated client. Every query on a tenant table is forced to the
 * given school: `schoolId` is injected into every `where`, and overwritten on
 * every `create` / `upsert` payload — so even a forged id from a form cannot
 * read or write another school's rows.
 */
export function tenantDb(schoolId: string) {
  if (!schoolId) throw new Error("tenantDb requires a schoolId");
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (UNSCOPED.has(model)) return query(args);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = (args ?? {}) as any;
          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), schoolId };
          }
          if (operation === "create") a.data = { ...a.data, schoolId };
          if (operation === "createMany" || operation === "createManyAndReturn") {
            const rows = Array.isArray(a.data) ? a.data : [a.data];
            a.data = rows.map((r: object) => ({ ...r, schoolId }));
          }
          if (operation === "upsert") a.create = { ...a.create, schoolId };
          if (operation === "update" || operation === "updateMany") {
            if (a.data && "schoolId" in a.data) delete a.data.schoolId;
          }
          return query(a);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
