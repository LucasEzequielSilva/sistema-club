import { db } from "@/server/db";

const ACCOUNT_ID = "test-account-id";

const DEFAULT_PAYMENT_METHODS = [
  { name: "Efectivo", accreditationDays: 0 },
  { name: "Transferencia bancaria", accreditationDays: 0 },
  { name: "Cheque", accreditationDays: 2 },
  { name: "Cheque diferido 30 dias", accreditationDays: 32 },
  { name: "Cheque diferido 45 dias", accreditationDays: 47 },
  { name: "Cheque diferido 60 dias", accreditationDays: 62 },
  { name: "Mercado Pago", accreditationDays: 0 },
  { name: "Tarjeta de credito", accreditationDays: 18 },
  { name: "Tarjeta de debito", accreditationDays: 3 },
];

const DEFAULT_COST_CATEGORIES = [
  { name: "Costo de mercaderia", costType: "variable" as const },
  { name: "Materia prima", costType: "variable" as const },
  { name: "Flete", costType: "variable" as const },
  { name: "Alquiler", costType: "fijo" as const },
  { name: "Servicios", costType: "fijo" as const },
  { name: "Sueldos", costType: "fijo" as const },
  { name: "IVA", costType: "impuestos" as const },
  { name: "Ingresos Brutos", costType: "impuestos" as const },
];

const DEFAULT_PRICE_LISTS = [
  { name: "Minorista", isDefault: true },
  { name: "Mayorista", isDefault: false },
];

const DEFAULT_PRODUCT_CATEGORIES = [
  { name: "Alimentos" },
  { name: "Bebidas" },
  { name: "Limpieza" },
  { name: "Varios" },
];

const DEFAULT_SUPPLIERS = [
  {
    name: "Distribuidor Central",
    cuit: "30-71234567-8",
    phone: "011-4444-5555",
    email: "ventas@distcentral.com",
  },
  {
    name: "Mayorista del Sur",
    cuit: "30-70987654-3",
    phone: "011-3333-2222",
  },
];

/**
 * Seed a complete test environment
 */
async function seedAll() {
  console.log("=== Seeding test environment ===\n");

  // 1. Create account (or skip if exists)
  let account = await db.account.findUnique({ where: { id: ACCOUNT_ID } });
  if (!account) {
    account = await db.account.create({
      data: {
        id: ACCOUNT_ID,
        name: "Club de Mati (Test)",
        taxStatus: "monotributista",
        ivaRate: 21,
        includeIvaInCost: false,
      },
    });
    console.log("+ Account created:", account.name);
  } else {
    console.log("= Account already exists:", account.name);
  }

  // 2. Create branch
  const existingBranch = await db.branch.findFirst({
    where: { accountId: ACCOUNT_ID },
  });
  if (!existingBranch) {
    await db.branch.create({
      data: {
        accountId: ACCOUNT_ID,
        name: "Principal",
      },
    });
    console.log("+ Branch created: Principal");
  }

  // 3. Payment methods
  const existingMethods = await db.paymentMethod.count({
    where: { accountId: ACCOUNT_ID },
  });
  if (existingMethods === 0) {
    for (const method of DEFAULT_PAYMENT_METHODS) {
      await db.paymentMethod.create({
        data: { accountId: ACCOUNT_ID, ...method },
      });
    }
    console.log(
      `+ Created ${DEFAULT_PAYMENT_METHODS.length} payment methods`
    );
  } else {
    console.log(`= ${existingMethods} payment methods already exist`);
  }

  // 4. Cost categories
  const existingCostCats = await db.costCategory.count({
    where: { accountId: ACCOUNT_ID },
  });
  if (existingCostCats === 0) {
    for (const cat of DEFAULT_COST_CATEGORIES) {
      await db.costCategory.create({
        data: { accountId: ACCOUNT_ID, ...cat },
      });
    }
    console.log(
      `+ Created ${DEFAULT_COST_CATEGORIES.length} cost categories`
    );
  } else {
    console.log(`= ${existingCostCats} cost categories already exist`);
  }

  // 5. Price lists
  const existingPriceLists = await db.priceList.count({
    where: { accountId: ACCOUNT_ID },
  });
  if (existingPriceLists === 0) {
    for (const list of DEFAULT_PRICE_LISTS) {
      await db.priceList.create({
        data: { accountId: ACCOUNT_ID, ...list },
      });
    }
    console.log(`+ Created ${DEFAULT_PRICE_LISTS.length} price lists`);
  } else {
    console.log(`= ${existingPriceLists} price lists already exist`);
  }

  // 6. Product categories
  const existingProdCats = await db.productCategory.count({
    where: { accountId: ACCOUNT_ID },
  });
  if (existingProdCats === 0) {
    for (const cat of DEFAULT_PRODUCT_CATEGORIES) {
      await db.productCategory.create({
        data: { accountId: ACCOUNT_ID, ...cat },
      });
    }
    console.log(
      `+ Created ${DEFAULT_PRODUCT_CATEGORIES.length} product categories`
    );
  } else {
    console.log(`= ${existingProdCats} product categories already exist`);
  }

  // 7. Suppliers
  const existingSuppliers = await db.supplier.count({
    where: { accountId: ACCOUNT_ID },
  });
  if (existingSuppliers === 0) {
    for (const sup of DEFAULT_SUPPLIERS) {
      await db.supplier.create({
        data: { accountId: ACCOUNT_ID, ...sup },
      });
    }
    console.log(`+ Created ${DEFAULT_SUPPLIERS.length} suppliers`);
  } else {
    console.log(`= ${existingSuppliers} suppliers already exist`);
  }

  // 8. Sample products (with price list items)
  const existingProducts = await db.product.count({
    where: { accountId: ACCOUNT_ID },
  });
  if (existingProducts === 0) {
    const categories = await db.productCategory.findMany({
      where: { accountId: ACCOUNT_ID },
    });
    const suppliers = await db.supplier.findMany({
      where: { accountId: ACCOUNT_ID },
    });
    const priceLists = await db.priceList.findMany({
      where: { accountId: ACCOUNT_ID },
    });

    const alimentosCat = categories.find((c) => c.name === "Alimentos");
    const bebidasCat = categories.find((c) => c.name === "Bebidas");
    const limpiezaCat = categories.find((c) => c.name === "Limpieza");
    const supplier1 = suppliers[0];

    const sampleProducts = [
      {
        name: "Galletitas Oreo x 3",
        categoryId: alimentosCat?.id || categories[0].id,
        supplierId: supplier1?.id || null,
        barcode: "7790895000119",
        unit: "unidad",
        origin: "comprado",
        initialStock: 50,
        minStock: 10,
        acquisitionCost: 800,
        rawMaterialCost: 0,
        laborCost: 0,
        packagingCost: 0,
        markupMin: 40,
        markupMay: 25,
      },
      {
        name: "Coca Cola 2.25L",
        categoryId: bebidasCat?.id || categories[0].id,
        supplierId: supplier1?.id || null,
        barcode: "7790895001277",
        unit: "unidad",
        origin: "comprado",
        initialStock: 100,
        minStock: 20,
        acquisitionCost: 1200,
        rawMaterialCost: 0,
        laborCost: 0,
        packagingCost: 0,
        markupMin: 35,
        markupMay: 20,
      },
      {
        name: "Lavandina Ayudin 1L",
        categoryId: limpiezaCat?.id || categories[0].id,
        supplierId: supplier1?.id || null,
        barcode: "7791290005214",
        unit: "unidad",
        origin: "comprado",
        initialStock: 30,
        minStock: 5,
        acquisitionCost: 600,
        rawMaterialCost: 0,
        laborCost: 0,
        packagingCost: 0,
        markupMin: 50,
        markupMay: 30,
      },
      {
        name: "Fideos Matarazzo 500g",
        categoryId: alimentosCat?.id || categories[0].id,
        supplierId: suppliers[1]?.id || null,
        barcode: "7790040129108",
        unit: "unidad",
        origin: "comprado",
        initialStock: 80,
        minStock: 15,
        acquisitionCost: 450,
        rawMaterialCost: 0,
        laborCost: 0,
        packagingCost: 0,
        markupMin: 45,
        markupMay: 28,
      },
      {
        name: "Aceite Cocinero 900ml",
        categoryId: alimentosCat?.id || categories[0].id,
        supplierId: suppliers[1]?.id || null,
        barcode: "7790001018900",
        unit: "unidad",
        origin: "comprado",
        initialStock: 40,
        minStock: 8,
        acquisitionCost: 1500,
        rawMaterialCost: 0,
        laborCost: 0,
        packagingCost: 0,
        markupMin: 30,
        markupMay: 18,
      },
    ];

    for (const prod of sampleProducts) {
      const { markupMin, markupMay, ...productData } = prod;
      const product = await db.product.create({
        data: {
          accountId: ACCOUNT_ID,
          ...productData,
          lastCostUpdate: new Date(),
        },
      });

      // Create price list items
      for (const list of priceLists) {
        const markup = list.isDefault ? markupMin : markupMay;
        await db.priceListItem.create({
          data: {
            priceListId: list.id,
            productId: product.id,
            markupPct: markup,
          },
        });
      }

      // Create initial stock movement
      if (prod.initialStock > 0) {
        const unitCost =
          prod.acquisitionCost +
          prod.rawMaterialCost +
          prod.laborCost +
          prod.packagingCost;
        await db.stockMovement.create({
          data: {
            accountId: ACCOUNT_ID,
            productId: product.id,
            movementType: "initial",
            quantity: prod.initialStock,
            unitCost,
            referenceType: "initial",
            movementDate: new Date(),
            notes: "Stock inicial (seed)",
          },
        });
      }
    }
    console.log(`+ Created ${sampleProducts.length} sample products with pricing`);
  } else {
    console.log(`= ${existingProducts} products already exist`);
  }

  // 9. Bank account
  const existingBankAccounts = await db.bankAccount.count({
    where: { accountId: ACCOUNT_ID },
  });
  if (existingBankAccounts === 0) {
    await db.bankAccount.create({
      data: {
        accountId: ACCOUNT_ID,
        name: "Caja",
        initialBalance: 0,
        balanceDate: new Date(),
      },
    });
    console.log("+ Created bank account: Caja");
  } else {
    console.log(`= ${existingBankAccounts} bank accounts already exist`);
  }

  console.log("\n=== Seed complete! ===");
  console.log(`Account ID: ${ACCOUNT_ID}`);
}

// Run
seedAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
