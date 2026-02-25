import { db } from "@/server/db";

const DEFAULT_PAYMENT_METHODS = [
  { name: "Efectivo", accreditationDays: 0 },
  { name: "Transferencia bancaria", accreditationDays: 0 },
  { name: "Cheque", accreditationDays: 2 },
  { name: "Cheque diferido 30 días", accreditationDays: 32 },
  { name: "Cheque diferido 45 días", accreditationDays: 47 },
  { name: "Cheque diferido 60 días", accreditationDays: 62 },
  { name: "Mercado Pago", accreditationDays: 0 },
  { name: "Tarjeta de crédito", accreditationDays: 18 },
  { name: "Tarjeta de débito", accreditationDays: 3 },
];

const DEFAULT_COST_CATEGORIES = [
  { name: "Costo de mercadería", costType: "variable" as const },
  { name: "Materia prima", costType: "variable" as const },
  { name: "Flete", costType: "variable" as const },
  { name: "Alquiler", costType: "fijo" as const },
  { name: "Servicios", costType: "fijo" as const },
  { name: "Sueldos", costType: "fijo" as const },
  { name: "IVA", costType: "impuestos" as const },
  { name: "Ingresos Brutos", costType: "impuestos" as const },
];

const DEFAULT_PRICE_LISTS = [
  { name: "Minorista" },
  { name: "Mayorista" },
];

/**
 * Seed default data when a new account is created
 */
export async function seedAccountDefaults(accountId: string) {
  console.log(`Seeding defaults for account ${accountId}...`);

  try {
    // Create payment methods
    for (const method of DEFAULT_PAYMENT_METHODS) {
      await db.paymentMethod.create({
        data: {
          accountId,
          ...method,
        },
      });
    }
    console.log(`✓ Created ${DEFAULT_PAYMENT_METHODS.length} payment methods`);

    // Create cost categories
    for (const category of DEFAULT_COST_CATEGORIES) {
      await db.costCategory.create({
        data: {
          accountId,
          ...category,
        },
      });
    }
    console.log(`✓ Created ${DEFAULT_COST_CATEGORIES.length} cost categories`);

    // Create price lists
    for (const list of DEFAULT_PRICE_LISTS) {
      await db.priceList.create({
        data: {
          accountId,
          ...list,
          isDefault: list.name === "Minorista",
        },
      });
    }
    console.log(`✓ Created ${DEFAULT_PRICE_LISTS.length} price lists`);

    return true;
  } catch (error) {
    console.error("Error seeding account defaults:", error);
    throw error;
  }
}

/**
 * Run this script with: npx ts-node scripts/seed.ts <account-id>
 */
if (require.main === module) {
  const accountId = process.argv[2];
  if (!accountId) {
    console.error(
      "Please provide an account ID: npx ts-node scripts/seed.ts <account-id>"
    );
    process.exit(1);
  }

  seedAccountDefaults(accountId)
    .then(() => {
      console.log("Seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}
