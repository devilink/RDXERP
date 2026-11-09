// First-run helper: creates .env (with a random SESSION_SECRET) if it doesn't exist.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!existsSync(".env")) {
  const example = readFileSync(".env.example", "utf8");
  const env = example.replace(/SESSION_SECRET=.*/, `SESSION_SECRET="${randomBytes(32).toString("hex")}"`);
  writeFileSync(".env", env);
  console.log("Created .env with a random SESSION_SECRET.");
} else {
  console.log(".env already exists — leaving it unchanged.");
}
