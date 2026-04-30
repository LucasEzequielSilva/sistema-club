/**
 * Migración bulk de passwords plain text → argon2id.
 *
 * Idempotente: skipea passwords que ya están hasheadas.
 * No requiere conocer el plain text — usa el valor actual de la columna como input.
 *
 * Uso:
 *   npx tsx scripts/migrate-passwords.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hashPassword, isHashed } from "../src/lib/password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL no está seteada en .env");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const db = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  const users = await db.user.findMany();
  let migrated = 0;
  let already = 0;

  for (const u of users) {
    if (isHashed(u.password)) {
      already++;
      continue;
    }
    const newHash = await hashPassword(u.password);
    await db.user.update({ where: { id: u.id }, data: { password: newHash } });
    console.log(`  ✓ migrated ${u.email}`);
    migrated++;
  }

  console.log(`\nResumen: ${migrated} migradas · ${already} ya estaban hasheadas`);
}

main()
  .then(() => db.$disconnect())
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
