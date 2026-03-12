import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: "postgresql://neondb_owner:npg_P4KavVbtng8C@ep-withered-queen-ac9yoah5.sa-east-1.aws.neon.tech/neondb?sslmode=require" });
const db = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

async function main() {
  const products = await db.product.findMany({
    where: { accountId: "kiosco-test-account-id", name: { in: ["Caramelos Sugus x 4", "Jugo Cepita Naranja 1L"] } },
    include: { stockMovements: true }
  });
  for (const p of products) {
    const stockActual = p.initialStock + p.stockMovements.reduce((acc: number, m: any) => acc + m.quantity, 0);
    console.log(`\n${p.name} | initialStock: ${p.initialStock} | minStock: ${p.minStock} | stockActual: ${stockActual}`);
    for (const m of p.stockMovements) {
      console.log(`  mov: type=${m.movementType} | qty=${m.quantity} | date=${m.movementDate}`);
    }
  }
  await db.$disconnect();
  await pool.end();
}

main().catch(console.error);
