/**
 * Reset de las 3 cuentas de prueba: borra todo y re-seedea desde cero.
 * Ejecutar con: npx tsx scripts/reset-test-accounts.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    "postgresql://neondb_owner:npg_P4KavVbtng8C@ep-withered-queen-ac9yoah5.sa-east-1.aws.neon.tech/neondb?sslmode=require",
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as any);

const TEST_ACCOUNT_IDS = [
  "kiosco-test-account-id",
  "panaderia-test-account-id",
  "ferreteria-test-account-id",
];

const TEST_EMAILS = [
  "kiosco@test.com",
  "panaderia@test.com",
  "ferreteria@test.com",
];

async function resetAccounts() {
  console.log("=== Reset: borrando cuentas de prueba ===\n");

  for (const accountId of TEST_ACCOUNT_IDS) {
    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) {
      console.log(`  - ${accountId}: no existe, nada que borrar`);
      continue;
    }

    // Borrar en orden para evitar FK violations
    // 1. Pagos de ventas y compras
    const sales = await db.sale.findMany({ where: { accountId }, select: { id: true } });
    const saleIds = sales.map((s) => s.id);
    if (saleIds.length > 0) {
      await db.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
    }
    const purchases = await db.purchase.findMany({ where: { accountId }, select: { id: true } });
    const purchaseIds = purchases.map((p) => p.id);
    if (purchaseIds.length > 0) {
      await db.purchasePayment.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
    }

    // 2. Transacciones
    await db.sale.deleteMany({ where: { accountId } });
    await db.purchase.deleteMany({ where: { accountId } });
    await db.invoice.deleteMany({ where: { accountId } });

    // 3. Stock
    await db.stockMovement.deleteMany({ where: { accountId } });

    // 4. Productos y pricing
    await db.priceListItem.deleteMany({
      where: { priceList: { accountId } },
    });
    await db.product.deleteMany({ where: { accountId } });
    await db.priceList.deleteMany({ where: { accountId } });

    // 5. Catálogos
    await db.paymentMethod.deleteMany({ where: { accountId } });
    await db.costCategory.deleteMany({ where: { accountId } });
    await db.productCategory.deleteMany({ where: { accountId } });
    await db.supplier.deleteMany({ where: { accountId } });
    await db.client.deleteMany({ where: { accountId } });

    // 6. Finanzas
    await db.cashFlowEntry.deleteMany({ where: { accountId } });
    await db.bankAccount.deleteMany({ where: { accountId } });
    await db.projection.deleteMany({ where: { accountId } });

    // 7. IA
    await db.userMemory.deleteMany({ where: { accountId } });

    // 8. Auth
    await db.accountMember.deleteMany({ where: { accountId } });
    await db.branch.deleteMany({ where: { accountId } });
    await db.user.deleteMany({ where: { accountId } });

    // 9. Cuenta
    await db.account.delete({ where: { id: accountId } });
    console.log(`  ✓ Borrado: ${account.name} (${accountId})`);
  }

  // Borrar usuarios por email (por si quedaron huérfanos)
  for (const email of TEST_EMAILS) {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      await db.user.delete({ where: { email } });
      console.log(`  ✓ Usuario borrado: ${email}`);
    }
  }

  console.log("\n=== Reset completo. Ejecutá seed-test-accounts.ts para re-crear. ===\n");
}

resetAccounts()
  .then(() => db.$disconnect())
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
