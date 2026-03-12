import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as any);
const ACCOUNT_ID = "mati-account-id";

async function main() {
  console.log(`Reseteando cuenta ${ACCOUNT_ID}...`);

  // Orden: primero los que tienen FK hacia otros, de más dependiente a menos
  const r1 = await db.salePayment.deleteMany({ where: { sale: { accountId: ACCOUNT_ID } } });
  console.log(`  salePayments: ${r1.count}`);

  const r2 = await db.purchasePayment.deleteMany({ where: { purchase: { accountId: ACCOUNT_ID } } });
  console.log(`  purchasePayments: ${r2.count}`);

  const r3 = await db.priceListItem.deleteMany({ where: { priceList: { accountId: ACCOUNT_ID } } });
  console.log(`  priceListItems: ${r3.count}`);

  const r4 = await db.stockMovement.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  stockMovements: ${r4.count}`);

  const r5 = await db.sale.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  sales: ${r5.count}`);

  const r6 = await db.purchase.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  purchases: ${r6.count}`);

  const r7 = await db.priceList.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  priceLists: ${r7.count}`);

  const r8 = await db.product.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  products: ${r8.count}`);

  const r9 = await db.supplier.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  suppliers: ${r9.count}`);

  const r10 = await db.productCategory.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  productCategories: ${r10.count}`);

  const r11 = await db.costCategory.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  costCategories: ${r11.count}`);

  const r12 = await db.paymentMethod.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  paymentMethods: ${r12.count}`);

  const r13 = await db.userMemory.deleteMany({ where: { accountId: ACCOUNT_ID } });
  console.log(`  userMemories (Costito): ${r13.count}`);

  console.log("\n✓ Cuenta reseteada. Usuario mati@gmail.com conservado.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
