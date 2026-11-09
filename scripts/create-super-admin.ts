// Creates the platform owner's account, or resets its password if it already exists.
// Usage: npm run db:create-admin -- you@yourcompany.com
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run db:create-admin -- you@yourcompany.com");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== "SUPER_ADMIN") throw new Error(`${email} already belongs to a school user.`);
  const password = randomBytes(15).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, active: true },
    create: { name: "Platform Owner", email, passwordHash, role: "SUPER_ADMIN" },
  });
  console.log(`Super admin ready: ${email}\nPassword (shown once): ${password}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
