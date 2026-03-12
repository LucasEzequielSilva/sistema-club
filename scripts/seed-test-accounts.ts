/**
 * Seed script para 3 cuentas de prueba que cubren diferentes casos de uso:
 *
 * 1. kiosco@test.com     — Don Pepe Kiosco (venta por unidad, comprado, stock bajo)
 * 2. panaderia@test.com  — Panadería La Espiga (fabricado, kg, registrar producción, insumos)
 * 3. ferreteria@test.com — Ferretería El Tornillo (unidad/metro/litro, IVA RI, múltiples categorías)
 *
 * Ejecutar con:
 *   npx tsx scripts/seed-test-accounts.ts
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

// ============================================================
// HELPERS
// ============================================================

async function createBaseAccount(opts: {
  id: string;
  name: string;
  email: string;
  taxStatus: "monotributista" | "responsable_inscripto";
  ivaRate: number;
  includeIvaInCost: boolean;
}) {
  // Account
  let account = await db.account.findUnique({ where: { id: opts.id } });
  if (!account) {
    account = await db.account.create({
      data: {
        id: opts.id,
        name: opts.name,
        taxStatus: opts.taxStatus,
        ivaRate: opts.ivaRate,
        includeIvaInCost: opts.includeIvaInCost,
      },
    });
    console.log(`  + Account: ${account.name}`);
  } else {
    console.log(`  = Account ya existe: ${account.name}`);
  }

  // User
  const existingUser = await db.user.findUnique({ where: { email: opts.email } });
  if (!existingUser) {
    await db.user.create({
      data: {
        accountId: opts.id,
        email: opts.email,
        password: "test123",
        name: opts.name,
        role: "admin",
      },
    });
    console.log(`  + User: ${opts.email}`);
  } else {
    console.log(`  = User ya existe: ${opts.email}`);
  }

  // Branch
  const existingBranch = await db.branch.findFirst({ where: { accountId: opts.id } });
  if (!existingBranch) {
    await db.branch.create({ data: { accountId: opts.id, name: "Casa Central" } });
    console.log(`  + Branch: Casa Central`);
  }

  return account;
}

async function createCatalogs(accountId: string) {
  // Payment methods
  const pmCount = await db.paymentMethod.count({ where: { accountId } });
  if (pmCount === 0) {
    const methods = [
      { name: "Efectivo", accreditationDays: 0 },
      { name: "Transferencia", accreditationDays: 0 },
      { name: "Mercado Pago", accreditationDays: 0 },
      { name: "Tarjeta de débito", accreditationDays: 3 },
      { name: "Tarjeta de crédito", accreditationDays: 18 },
    ];
    for (const m of methods) await db.paymentMethod.create({ data: { accountId, ...m } });
    console.log(`  + ${methods.length} métodos de pago`);
  }

  // Cost categories
  const ccCount = await db.costCategory.count({ where: { accountId } });
  if (ccCount === 0) {
    const cats = [
      { name: "Costo de mercadería", costType: "variable" as const },
      { name: "Materia prima", costType: "variable" as const },
      { name: "Flete", costType: "variable" as const },
      { name: "Alquiler", costType: "fijo" as const },
      { name: "Servicios", costType: "fijo" as const },
      { name: "Sueldos", costType: "fijo" as const },
      { name: "IVA", costType: "impuestos" as const },
      { name: "Ingresos Brutos", costType: "impuestos" as const },
    ];
    for (const c of cats) await db.costCategory.create({ data: { accountId, ...c } });
    console.log(`  + ${cats.length} categorías de costos`);
  }

  // Bank account
  const baCount = await db.bankAccount.count({ where: { accountId } });
  if (baCount === 0) {
    await db.bankAccount.create({
      data: { accountId, name: "Caja", initialBalance: 0, balanceDate: new Date() },
    });
    console.log(`  + Banco: Caja`);
  }
}

async function createPriceLists(
  accountId: string,
  lists: { name: string; isDefault: boolean }[]
) {
  const existing = await db.priceList.findMany({ where: { accountId } });
  if (existing.length === 0) {
    for (const l of lists) await db.priceList.create({ data: { accountId, ...l } });
    console.log(`  + ${lists.length} listas de precio`);
  }
  return db.priceList.findMany({ where: { accountId } });
}

async function createProductCategories(accountId: string, names: string[]) {
  const existing = await db.productCategory.findMany({ where: { accountId } });
  if (existing.length === 0) {
    for (const name of names)
      await db.productCategory.create({ data: { accountId, name } });
    console.log(`  + ${names.length} categorías de productos`);
  }
  return db.productCategory.findMany({ where: { accountId } });
}

async function createSuppliers(
  accountId: string,
  suppliers: { name: string; cuit?: string; phone?: string }[]
) {
  const existing = await db.supplier.findMany({ where: { accountId } });
  if (existing.length === 0) {
    for (const s of suppliers) await db.supplier.create({ data: { accountId, ...s } });
    console.log(`  + ${suppliers.length} proveedores`);
  }
  return db.supplier.findMany({ where: { accountId } });
}

async function createProduct(opts: {
  accountId: string;
  categoryId: string;
  supplierId?: string;
  name: string;
  barcode?: string;
  sku?: string;
  unit: string;
  origin: "comprado" | "fabricado";
  initialStock: number;
  minStock: number;
  acquisitionCost: number;
  rawMaterialCost?: number;
  laborCost?: number;
  packagingCost?: number;
  priceLists: { id: string; markupPct: number }[];
}) {
  const existing = await db.product.findFirst({
    where: { accountId: opts.accountId, name: opts.name },
  });
  if (existing) return existing;

  // initialStock en el modelo del producto se deja en 0.
  // El stock inicial real viene del stockMovement de tipo "initial".
  // Así el cálculo del sistema (initialStock + SUM(movements)) es correcto.
  const product = await db.product.create({
    data: {
      accountId: opts.accountId,
      categoryId: opts.categoryId,
      supplierId: opts.supplierId ?? null,
      name: opts.name,
      barcode: opts.barcode ?? null,
      sku: opts.sku ?? null,
      unit: opts.unit,
      origin: opts.origin,
      initialStock: 0,
      minStock: opts.minStock,
      acquisitionCost: opts.acquisitionCost,
      rawMaterialCost: opts.rawMaterialCost ?? 0,
      laborCost: opts.laborCost ?? 0,
      packagingCost: opts.packagingCost ?? 0,
      lastCostUpdate: new Date(),
    },
  });

  // Price list items
  for (const pl of opts.priceLists) {
    await db.priceListItem.create({
      data: { priceListId: pl.id, productId: product.id, markupPct: pl.markupPct },
    });
  }

  // Initial stock movement
  if (opts.initialStock > 0) {
    const unitCost =
      opts.acquisitionCost +
      (opts.rawMaterialCost ?? 0) +
      (opts.laborCost ?? 0) +
      (opts.packagingCost ?? 0);
    await db.stockMovement.create({
      data: {
        accountId: opts.accountId,
        productId: product.id,
        movementType: "initial",
        quantity: opts.initialStock,
        unitCost,
        referenceType: "initial",
        movementDate: new Date(),
        notes: "Stock inicial (seed)",
      },
    });
  }

  return product;
}

// ============================================================
// 1. DON PEPE KIOSCO
//    Casos: venta por unidad, productos comprados, stock bajo, lista minorista/mayorista
// ============================================================

async function seedKiosco() {
  console.log("\n[1/3] Don Pepe Kiosco (kiosco@test.com)");

  const ACCOUNT_ID = "kiosco-test-account-id";

  await createBaseAccount({
    id: ACCOUNT_ID,
    name: "Don Pepe Kiosco",
    email: "kiosco@test.com",
    taxStatus: "monotributista",
    ivaRate: 21,
    includeIvaInCost: false,
  });

  await createCatalogs(ACCOUNT_ID);

  const priceLists = await createPriceLists(ACCOUNT_ID, [
    { name: "Minorista", isDefault: true },
    { name: "Mayorista", isDefault: false },
  ]);
  const minorista = priceLists.find((p) => p.name === "Minorista")!;
  const mayorista = priceLists.find((p) => p.name === "Mayorista")!;

  const categories = await createProductCategories(ACCOUNT_ID, [
    "Golosinas",
    "Bebidas",
    "Cigarrillos",
    "Snacks",
    "Varios",
  ]);
  const golosinas = categories.find((c) => c.name === "Golosinas")!;
  const bebidas = categories.find((c) => c.name === "Bebidas")!;
  const cigarrillos = categories.find((c) => c.name === "Cigarrillos")!;
  const snacks = categories.find((c) => c.name === "Snacks")!;

  const suppliers = await createSuppliers(ACCOUNT_ID, [
    { name: "Distribuidora Norte", cuit: "30-71111111-1", phone: "011-4555-1234" },
    { name: "Tabacalera Argentina", cuit: "30-72222222-2" },
  ]);
  const sup1 = suppliers[0];
  const sup2 = suppliers[1];

  const productos = [
    // Golosinas — venta por unidad, stock alto
    { name: "Alfajor Milka", barcode: "7790001001234", unit: "unidad", origin: "comprado" as const, categoryId: golosinas.id, supplierId: sup1.id, initialStock: 60, minStock: 10, acquisitionCost: 350, markupMin: 50, markupMay: 30 },
    { name: "Chicle Beldent", barcode: "7790002002345", unit: "unidad", origin: "comprado" as const, categoryId: golosinas.id, supplierId: sup1.id, initialStock: 200, minStock: 30, acquisitionCost: 180, markupMin: 60, markupMay: 40 },
    { name: "Caramelos Sugus x 4", barcode: "7790003003456", unit: "unidad", origin: "comprado" as const, categoryId: golosinas.id, supplierId: sup1.id, initialStock: 8, minStock: 10, acquisitionCost: 150, markupMin: 55, markupMay: 35 }, // STOCK BAJO
    { name: "Chocolate Cofler", barcode: "7790004004567", unit: "unidad", origin: "comprado" as const, categoryId: golosinas.id, supplierId: sup1.id, initialStock: 40, minStock: 8, acquisitionCost: 420, markupMin: 45, markupMay: 28 },
    // Bebidas — venta por unidad
    { name: "Coca Cola 500ml", barcode: "7790895001100", unit: "unidad", origin: "comprado" as const, categoryId: bebidas.id, supplierId: sup1.id, initialStock: 120, minStock: 24, acquisitionCost: 650, markupMin: 40, markupMay: 22 },
    { name: "Agua Villavicencio 500ml", barcode: "7790040200001", unit: "unidad", origin: "comprado" as const, categoryId: bebidas.id, supplierId: sup1.id, initialStock: 80, minStock: 12, acquisitionCost: 300, markupMin: 45, markupMay: 25 },
    { name: "Jugo Cepita Naranja 1L", barcode: "7790040300002", unit: "unidad", origin: "comprado" as const, categoryId: bebidas.id, supplierId: sup1.id, initialStock: 5, minStock: 8, acquisitionCost: 750, markupMin: 38, markupMay: 20 }, // STOCK BAJO
    { name: "Sprite 500ml", barcode: "7790040400003", unit: "unidad", origin: "comprado" as const, categoryId: bebidas.id, supplierId: sup1.id, initialStock: 48, minStock: 12, acquisitionCost: 620, markupMin: 40, markupMay: 22 },
    // Cigarrillos — venta por unidad (paquete)
    { name: "Marlboro Rojo x20", barcode: "7790111100001", unit: "unidad", origin: "comprado" as const, categoryId: cigarrillos.id, supplierId: sup2.id, initialStock: 30, minStock: 5, acquisitionCost: 1800, markupMin: 15, markupMay: 8 },
    { name: "Camel Azul x20", barcode: "7790111200002", unit: "unidad", origin: "comprado" as const, categoryId: cigarrillos.id, supplierId: sup2.id, initialStock: 25, minStock: 5, acquisitionCost: 1750, markupMin: 15, markupMay: 8 },
    // Snacks
    { name: "Papas Lays 80g", barcode: "7790500100001", unit: "unidad", origin: "comprado" as const, categoryId: snacks.id, supplierId: sup1.id, initialStock: 50, minStock: 10, acquisitionCost: 420, markupMin: 48, markupMay: 28 },
    { name: "Chizitos 80g", barcode: "7790500200002", unit: "unidad", origin: "comprado" as const, categoryId: snacks.id, supplierId: sup1.id, initialStock: 45, minStock: 10, acquisitionCost: 390, markupMin: 48, markupMay: 28 },
  ];

  let count = 0;
  for (const p of productos) {
    const { markupMin, markupMay, ...data } = p;
    await createProduct({
      ...data,
      accountId: ACCOUNT_ID,
      priceLists: [
        { id: minorista.id, markupPct: markupMin },
        { id: mayorista.id, markupPct: markupMay },
      ],
    });
    count++;
  }
  console.log(`  + ${count} productos creados`);
  console.log("  ✓ Kiosco listo (2 productos con STOCK BAJO para testear alertas)");
}

// ============================================================
// 2. PANADERÍA LA ESPIGA
//    Casos: fabricado (pan, facturas), insumos por kg, registrar producción,
//           comprado por unidad (bebidas), listas de precio
// ============================================================

async function seedPanaderia() {
  console.log("\n[2/3] Panadería La Espiga (panaderia@test.com)");

  const ACCOUNT_ID = "panaderia-test-account-id";

  await createBaseAccount({
    id: ACCOUNT_ID,
    name: "Panadería La Espiga",
    email: "panaderia@test.com",
    taxStatus: "monotributista",
    ivaRate: 21,
    includeIvaInCost: false,
  });

  await createCatalogs(ACCOUNT_ID);

  const priceLists = await createPriceLists(ACCOUNT_ID, [
    { name: "Mostrador", isDefault: true },
    { name: "Por Mayor", isDefault: false },
  ]);
  const mostrador = priceLists.find((p) => p.name === "Mostrador")!;
  const porMayor = priceLists.find((p) => p.name === "Por Mayor")!;

  const categories = await createProductCategories(ACCOUNT_ID, [
    "Panes",
    "Facturas y Medialunas",
    "Tortas y Pasteles",
    "Insumos",
    "Bebidas",
  ]);
  const panes = categories.find((c) => c.name === "Panes")!;
  const facturas = categories.find((c) => c.name === "Facturas y Medialunas")!;
  const tortas = categories.find((c) => c.name === "Tortas y Pasteles")!;
  const insumos = categories.find((c) => c.name === "Insumos")!;
  const bebidas = categories.find((c) => c.name === "Bebidas")!;

  const suppliers = await createSuppliers(ACCOUNT_ID, [
    { name: "Molinos Río de la Plata", cuit: "30-50000001-1", phone: "011-4600-1000" },
    { name: "Distribuidora Lacteos SA", cuit: "30-50000002-2", phone: "011-4600-2000" },
  ]);
  const supMolinos = suppliers[0];
  const supLacteos = suppliers[1];

  const productos = [
    // ── FABRICADOS ─── venta por kg (el cliente pide 200g, 500g, 1kg)
    {
      name: "Pan Francés",
      unit: "kg",
      origin: "fabricado" as const,
      categoryId: panes.id,
      supplierId: undefined,
      initialStock: 15,
      minStock: 5,
      acquisitionCost: 0,
      rawMaterialCost: 600,   // harina, agua, sal, levadura
      laborCost: 300,
      packagingCost: 50,
      markupMin: 120,
      markupMay: 80,
    },
    {
      name: "Pan de Molde Blanco",
      unit: "kg",
      origin: "fabricado" as const,
      categoryId: panes.id,
      supplierId: undefined,
      initialStock: 8,
      minStock: 3,
      acquisitionCost: 0,
      rawMaterialCost: 700,
      laborCost: 350,
      packagingCost: 120,
      markupMin: 100,
      markupMay: 70,
    },
    {
      name: "Pan Integral",
      unit: "kg",
      origin: "fabricado" as const,
      categoryId: panes.id,
      supplierId: undefined,
      initialStock: 2,  // STOCK BAJO
      minStock: 4,
      acquisitionCost: 0,
      rawMaterialCost: 800,
      laborCost: 350,
      packagingCost: 100,
      markupMin: 110,
      markupMay: 75,
    },
    // ── FABRICADOS — venta por unidad (facturas)
    {
      name: "Medialuna de Grasa",
      unit: "unidad",
      origin: "fabricado" as const,
      categoryId: facturas.id,
      supplierId: undefined,
      initialStock: 60,
      minStock: 20,
      acquisitionCost: 0,
      rawMaterialCost: 80,
      laborCost: 40,
      packagingCost: 10,
      markupMin: 130,
      markupMay: 90,
    },
    {
      name: "Medialuna de Manteca",
      unit: "unidad",
      origin: "fabricado" as const,
      categoryId: facturas.id,
      supplierId: undefined,
      initialStock: 50,
      minStock: 20,
      acquisitionCost: 0,
      rawMaterialCost: 100,
      laborCost: 50,
      packagingCost: 12,
      markupMin: 130,
      markupMay: 90,
    },
    {
      name: "Tortita Negra",
      unit: "unidad",
      origin: "fabricado" as const,
      categoryId: facturas.id,
      supplierId: undefined,
      initialStock: 30,
      minStock: 10,
      acquisitionCost: 0,
      rawMaterialCost: 90,
      laborCost: 45,
      packagingCost: 10,
      markupMin: 130,
      markupMay: 90,
    },
    // ── FABRICADOS — venta por unidad (tortas)
    {
      name: "Tarta de Manzana",
      unit: "unidad",
      origin: "fabricado" as const,
      categoryId: tortas.id,
      supplierId: undefined,
      initialStock: 4,
      minStock: 2,
      acquisitionCost: 0,
      rawMaterialCost: 2500,
      laborCost: 1500,
      packagingCost: 300,
      markupMin: 80,
      markupMay: 55,
    },
    // ── INSUMOS — comprados por kg/litro (materia prima)
    {
      name: "Harina 000 x Kg",
      unit: "kg",
      origin: "comprado" as const,
      categoryId: insumos.id,
      supplierId: supMolinos.id,
      initialStock: 100,
      minStock: 20,
      acquisitionCost: 220,
      markupMin: 5,  // insumos casi sin markup, son para uso interno
      markupMay: 5,
    },
    {
      name: "Harina 0000 x Kg",
      unit: "kg",
      origin: "comprado" as const,
      categoryId: insumos.id,
      supplierId: supMolinos.id,
      initialStock: 80,
      minStock: 20,
      acquisitionCost: 250,
      markupMin: 5,
      markupMay: 5,
    },
    {
      name: "Manteca x Kg",
      unit: "kg",
      origin: "comprado" as const,
      categoryId: insumos.id,
      supplierId: supLacteos.id,
      initialStock: 15,
      minStock: 5,
      acquisitionCost: 2200,
      markupMin: 5,
      markupMay: 5,
    },
    {
      name: "Azúcar x Kg",
      unit: "kg",
      origin: "comprado" as const,
      categoryId: insumos.id,
      supplierId: supMolinos.id,
      initialStock: 40,
      minStock: 10,
      acquisitionCost: 400,
      markupMin: 5,
      markupMay: 5,
    },
    // ── COMPRADOS — bebidas para reventa por unidad
    {
      name: "Café en Grano 1Kg",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: bebidas.id,
      supplierId: supMolinos.id,
      initialStock: 10,
      minStock: 3,
      acquisitionCost: 5500,
      markupMin: 45,
      markupMay: 25,
    },
    {
      name: "Leche La Serenísima 1L",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: bebidas.id,
      supplierId: supLacteos.id,
      initialStock: 30,
      minStock: 6,
      acquisitionCost: 600,
      markupMin: 40,
      markupMay: 22,
    },
  ];

  let count = 0;
  for (const p of productos) {
    const { markupMin, markupMay, ...data } = p;
    await createProduct({
      ...data,
      accountId: ACCOUNT_ID,
      priceLists: [
        { id: mostrador.id, markupPct: markupMin },
        { id: porMayor.id, markupPct: markupMay },
      ],
    });
    count++;
  }
  console.log(`  + ${count} productos creados`);
  console.log("  ✓ Panadería lista (fabricados en kg/unidad, insumos, 1 producto STOCK BAJO)");
}

// ============================================================
// 3. FERRETERÍA EL TORNILLO
//    Casos: unidad, metro, litro, cm; RI con IVA; múltiples categorías;
//           productos sin barcode (granel/cortado a medida)
// ============================================================

async function seedFerreteria() {
  console.log("\n[3/3] Ferretería El Tornillo (ferreteria@test.com)");

  const ACCOUNT_ID = "ferreteria-test-account-id";

  await createBaseAccount({
    id: ACCOUNT_ID,
    name: "Ferretería El Tornillo",
    email: "ferreteria@test.com",
    taxStatus: "responsable_inscripto", // RI — usa IVA
    ivaRate: 21,
    includeIvaInCost: true, // el costo ya incluye IVA (proveedor RI)
  });

  await createCatalogs(ACCOUNT_ID);

  const priceLists = await createPriceLists(ACCOUNT_ID, [
    { name: "Mostrador", isDefault: true },
    { name: "Constructoras", isDefault: false },
    { name: "Plomeros/Gasistas", isDefault: false },
  ]);
  const mostrador = priceLists.find((p) => p.name === "Mostrador")!;
  const constructoras = priceLists.find((p) => p.name === "Constructoras")!;
  const plomeros = priceLists.find((p) => p.name === "Plomeros/Gasistas")!;

  const categories = await createProductCategories(ACCOUNT_ID, [
    "Tornillería",
    "Herramientas",
    "Pintura",
    "Electricidad",
    "Plomería",
    "Maderas y Perfiles",
  ]);
  const tornilleria = categories.find((c) => c.name === "Tornillería")!;
  const herramientas = categories.find((c) => c.name === "Herramientas")!;
  const pintura = categories.find((c) => c.name === "Pintura")!;
  const electricidad = categories.find((c) => c.name === "Electricidad")!;
  const plomeria = categories.find((c) => c.name === "Plomería")!;
  const maderas = categories.find((c) => c.name === "Maderas y Perfiles")!;

  const suppliers = await createSuppliers(ACCOUNT_ID, [
    { name: "Distribuidora Ferretera SA", cuit: "30-60000001-1", phone: "011-4700-1000" },
    { name: "Pinturerias del Plata", cuit: "30-60000002-2", phone: "011-4700-2000" },
    { name: "Maderías Paraná", cuit: "30-60000003-3", phone: "011-4700-3000" },
  ]);
  const supFerr = suppliers[0];
  const supPint = suppliers[1];
  const supMad = suppliers[2];

  const productos = [
    // ── TORNILLERÍA — venta por unidad (bolsa/caja)
    {
      name: "Tornillo Parker 6x40 (x100)",
      sku: "TRNP-640",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: tornilleria.id,
      supplierId: supFerr.id,
      initialStock: 50,
      minStock: 10,
      acquisitionCost: 800,
      markupMin: 65, markupMay: 40, markupPlom: 45,
    },
    {
      name: "Tuerca Mariposa M8 (x50)",
      sku: "TUEM-8",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: tornilleria.id,
      supplierId: supFerr.id,
      initialStock: 30,
      minStock: 5,
      acquisitionCost: 450,
      markupMin: 70, markupMay: 42, markupPlom: 48,
    },
    {
      name: "Taco Fisher N°8 (x100)",
      sku: "TACF-8",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: tornilleria.id,
      supplierId: supFerr.id,
      initialStock: 3,   // STOCK BAJO
      minStock: 8,
      acquisitionCost: 550,
      markupMin: 60, markupMay: 38, markupPlom: 42,
    },
    // ── HERRAMIENTAS — venta por unidad
    {
      name: "Martillo 500g Stanley",
      barcode: "7793500100001",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: herramientas.id,
      supplierId: supFerr.id,
      initialStock: 15,
      minStock: 3,
      acquisitionCost: 8500,
      markupMin: 55, markupMay: 35, markupPlom: 38,
    },
    {
      name: "Destornillador Philips N°2",
      barcode: "7793500200002",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: herramientas.id,
      supplierId: supFerr.id,
      initialStock: 20,
      minStock: 5,
      acquisitionCost: 4200,
      markupMin: 58, markupMay: 36, markupPlom: 40,
    },
    // ── PINTURA — venta por LITRO (granel/lata)
    {
      name: "Pintura Látex Interior",
      unit: "litro",
      origin: "comprado" as const,
      categoryId: pintura.id,
      supplierId: supPint.id,
      initialStock: 80,
      minStock: 20,
      acquisitionCost: 1100,   // por litro
      markupMin: 70, markupMay: 45, markupPlom: 50,
    },
    {
      name: "Pintura Látex Exterior",
      unit: "litro",
      origin: "comprado" as const,
      categoryId: pintura.id,
      supplierId: supPint.id,
      initialStock: 60,
      minStock: 15,
      acquisitionCost: 1300,
      markupMin: 65, markupMay: 42, markupPlom: 48,
    },
    {
      name: "Pintura Esmalte Sintético",
      unit: "litro",
      origin: "comprado" as const,
      categoryId: pintura.id,
      supplierId: supPint.id,
      initialStock: 40,
      minStock: 10,
      acquisitionCost: 1600,
      markupMin: 60, markupMay: 40, markupPlom: 45,
    },
    {
      name: "Aguarrás",
      unit: "litro",
      origin: "comprado" as const,
      categoryId: pintura.id,
      supplierId: supPint.id,
      initialStock: 30,
      minStock: 8,
      acquisitionCost: 500,
      markupMin: 75, markupMay: 48, markupPlom: 52,
    },
    // ── ELECTRICIDAD — venta por unidad / METRO de cable
    {
      name: "Cable Unipolar 2.5mm",
      unit: "metro",
      origin: "comprado" as const,
      categoryId: electricidad.id,
      supplierId: supFerr.id,
      initialStock: 500,  // metros en stock
      minStock: 100,
      acquisitionCost: 180,   // por metro
      markupMin: 80, markupMay: 55, markupPlom: 60,
    },
    {
      name: "Caño Corrugado 3/4\" Flex",
      unit: "metro",
      origin: "comprado" as const,
      categoryId: electricidad.id,
      supplierId: supFerr.id,
      initialStock: 200,
      minStock: 50,
      acquisitionCost: 120,
      markupMin: 80, markupMay: 55, markupPlom: 60,
    },
    {
      name: "Toma Doble Pared Bticino",
      barcode: "7792900100001",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: electricidad.id,
      supplierId: supFerr.id,
      initialStock: 25,
      minStock: 5,
      acquisitionCost: 3500,
      markupMin: 60, markupMay: 38, markupPlom: 42,
    },
    // ── PLOMERÍA — venta por unidad
    {
      name: "Caño PVC Cloacal 4\" (x6m)",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: plomeria.id,
      supplierId: supFerr.id,
      initialStock: 20,
      minStock: 4,
      acquisitionCost: 12000,
      markupMin: 45, markupMay: 28, markupPlom: 20,  // descuento para plomeros
    },
    {
      name: "Canilla Monocomando FV",
      barcode: "7791100100001",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: plomeria.id,
      supplierId: supFerr.id,
      initialStock: 8,
      minStock: 2,
      acquisitionCost: 28000,
      markupMin: 50, markupMay: 30, markupPlom: 22,
    },
    // ── MADERAS — venta por METRO o unidad (tablón)
    {
      name: "Pino Cepillado 1x4\" (x3m)",
      unit: "metro",
      origin: "comprado" as const,
      categoryId: maderas.id,
      supplierId: supMad.id,
      initialStock: 150,
      minStock: 30,
      acquisitionCost: 850,   // por metro
      markupMin: 55, markupMay: 35, markupPlom: 38,
    },
    {
      name: "Tablón Pino 2x6\" (x3m)",
      unit: "unidad",
      origin: "comprado" as const,
      categoryId: maderas.id,
      supplierId: supMad.id,
      initialStock: 30,
      minStock: 6,
      acquisitionCost: 9500,
      markupMin: 45, markupMay: 28, markupPlom: 30,
    },
  ];

  let count = 0;
  for (const p of productos) {
    const { markupMin, markupMay, markupPlom, ...data } = p as any;
    await createProduct({
      ...data,
      accountId: ACCOUNT_ID,
      priceLists: [
        { id: mostrador.id, markupPct: markupMin },
        { id: constructoras.id, markupPct: markupMay },
        { id: plomeros.id, markupPct: markupPlom },
      ],
    });
    count++;
  }
  console.log(`  + ${count} productos creados`);
  console.log("  ✓ Ferretería lista (unidad, litro, metro; 3 listas precio; RI con IVA; 1 STOCK BAJO)");
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("=== Seed: 3 Cuentas de Prueba ===");
  console.log("Credenciales:");
  console.log("  kiosco@test.com     / test123  → Don Pepe Kiosco");
  console.log("  panaderia@test.com  / test123  → Panadería La Espiga");
  console.log("  ferreteria@test.com / test123  → Ferretería El Tornillo");

  await seedKiosco();
  await seedPanaderia();
  await seedFerreteria();

  console.log("\n=== Seed completo! ===");
  await db.$disconnect();
  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
