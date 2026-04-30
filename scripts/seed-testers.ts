/**
 * Seed de testers reales — primer batch productivo (2026-04-30).
 *
 * Idempotente: si el email ya existe, lo skipea.
 * Crea Account + User (admin). El resto del setup (catálogos, listas)
 * se completa cuando el user pasa por el flujo de onboarding.
 *
 * Uso:
 *   npx tsx scripts/seed-testers.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hashPassword } from "../src/lib/password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL no está seteada en .env");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const db = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

const PASSWORD = "admin123";

const TESTERS = [
  {
    accountId: "tester-capricho-del-rey",
    accountName: "Capricho del Rey",
    rubro: "Fabricación · Indumentaria",
    email: "capricodelrey@gmail.com",
    name: "Damián",
  },
  {
    accountId: "tester-art-limpieza-clarisa",
    accountName: "Art Limpieza Clarisa",
    rubro: "Fabricación · Art. limpieza",
    email: "artlimpiezaclarisa@gmail.com",
    name: "Pablo Valdiviezo",
  },
  {
    accountId: "tester-kiosco-spataro",
    accountName: "Kiosco Spataro",
    rubro: "Reventa · Kiosco",
    email: "c.n.spataro@hotmail.com",
    name: "Cristian Spataro",
  },
  {
    accountId: "tester-art-pileta-tintore",
    accountName: "Art Pileta Tintore",
    rubro: "Reventa · Art. pileta",
    email: "lgtintore@gmail.com",
    name: "Leandro Tintore",
  },
  {
    accountId: "tester-academia-guzman",
    accountName: "Academia Musical Guzmán",
    rubro: "Servicios · Academia musical",
    email: "marianodguzman82@gmail.com",
    name: "Mariano Guzmán",
  },
];

async function main() {
  console.log("=".repeat(60));
  console.log("SEED TESTERS — Acelerator");
  console.log("=".repeat(60));

  const created: typeof TESTERS = [];
  const skipped: typeof TESTERS = [];

  for (const t of TESTERS) {
    const existing = await db.user.findUnique({ where: { email: t.email } });
    if (existing) {
      skipped.push(t);
      console.log(`  ↷ skip: ${t.email} (ya existe)`);
      continue;
    }

    // Account (upsert por id en caso de re-run después de borrar el user)
    await db.account.upsert({
      where: { id: t.accountId },
      create: {
        id: t.accountId,
        name: t.accountName,
        taxStatus: "monotributista",
        ivaRate: 21,
        includeIvaInCost: false,
      },
      update: {},
    });

    await db.user.create({
      data: {
        accountId: t.accountId,
        email: t.email,
        password: await hashPassword(PASSWORD),
        name: t.name,
        role: "admin",
        isActive: true,
      },
    });

    created.push(t);
    console.log(`  ✓ ${t.accountName.padEnd(28)} ${t.email}`);
  }

  console.log("=".repeat(60));
  console.log(`Resumen: ${created.length} creados · ${skipped.length} skipeados`);

  // Mensaje listo para WhatsApp
  if (created.length > 0) {
    console.log("\n--- CREDENCIALES PARA WHATSAPP ---\n");
    for (const t of created) {
      console.log(
        `${t.name} (${t.rubro})\n  URL: https://acelerator.app/login\n  Email: ${t.email}\n  Pass: ${PASSWORD}\n`
      );
    }
    console.log("---");
  }
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
