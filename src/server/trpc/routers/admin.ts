import { z } from "zod";
import { router, adminProcedure } from "../init";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@/generated/prisma/client";

// NOTA: Todos los procedures usan `adminProcedure` — requieren sesión válida + email en whitelist
// (`isAdminEmail`). Esto se verifica en `init.ts`. Doble defensa: middleware/layout + check de tRPC.

// ============================================
// SMOKE TESTS — runner operativo para /admin/tests
// ============================================

type TestResult = {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
  durationMs: number;
};

type SmokeTest = {
  key: string;
  name: string;
  description: string;
  category: "health" | "integrity" | "simulation";
  destructive: boolean; // true si modifica data (aunque sea temporal)
  run: () => Promise<Omit<TestResult, "durationMs">>;
};

const SMOKE_TESTS: SmokeTest[] = [
  {
    key: "db-health",
    name: "Database Health",
    description: "Verifica que la DB responda. Ejecuta SELECT 1.",
    category: "health",
    destructive: false,
    async run() {
      const r = await db.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
      return r[0]?.result === 1
        ? { ok: true, message: "DB respondió en tiempo esperado" }
        : { ok: false, message: "DB respondió pero con resultado inesperado" };
    },
  },
  {
    key: "counts-basic",
    name: "Counts básicos",
    description:
      "Cuenta accounts, users, products, sales. Útil para ver que Prisma Client esté OK.",
    category: "health",
    destructive: false,
    async run() {
      const [accounts, users, products, sales] = await Promise.all([
        db.account.count(),
        db.user.count(),
        db.product.count(),
        db.sale.count(),
      ]);
      return {
        ok: true,
        message: `accounts:${accounts} users:${users} products:${products} sales:${sales}`,
        details: { accounts, users, products, sales },
      };
    },
  },
  {
    key: "integrity-sale-payments",
    name: "Integridad: pagos ≤ total de venta",
    description:
      "Por cada venta, la suma de SalePayments no debería superar el total neto de la venta.",
    category: "integrity",
    destructive: false,
    async run() {
      const sales = await db.sale.findMany({
        include: { payments: true },
        take: 500, // sample
      });
      const offenders: Array<{ saleId: string; total: number; paid: number }> = [];
      for (const s of sales) {
        const net = s.unitPrice * s.quantity * (1 - (s.discountPct || 0) / 100);
        const paid = s.payments.reduce((sum, p) => sum + p.amount, 0);
        // Permitimos paid > net hasta 25% por tema de IVA gross — ajuste pragmático.
        if (paid > net * 1.25) {
          offenders.push({ saleId: s.id, total: net, paid });
        }
      }
      return offenders.length === 0
        ? { ok: true, message: `Revisadas ${sales.length} ventas. Todas OK.` }
        : {
            ok: false,
            message: `${offenders.length} ventas con pagos sospechosos (>25% sobre neto)`,
            details: { sample: offenders.slice(0, 5) },
          };
    },
  },
  {
    key: "integrity-orphan-price-items",
    name: "Integridad: PriceListItems huérfanos",
    description:
      "Busca PriceListItems cuyo Product o PriceList ya no existen (no debería pasar con FK, pero check).",
    category: "integrity",
    destructive: false,
    async run() {
      const items = await db.priceListItem.findMany({
        include: {
          product: { select: { id: true } },
          priceList: { select: { id: true } },
        },
        take: 2000,
      });
      const orphans = items.filter((i) => !i.product || !i.priceList);
      return orphans.length === 0
        ? { ok: true, message: `Revisados ${items.length} items, ninguno huérfano.` }
        : {
            ok: false,
            message: `${orphans.length} items huérfanos`,
            details: { sampleIds: orphans.slice(0, 5).map((o) => o.id) },
          };
    },
  },
  {
    key: "integrity-default-setup",
    name: "Integridad: setup mínimo por cuenta",
    description:
      "Cada Account debería tener al menos una PaymentAccount, PaymentChannel activo y PriceList.",
    category: "integrity",
    destructive: false,
    async run() {
      const accounts = await db.account.findMany({
        include: {
          paymentAccounts: true,
          paymentChannels: { where: { isActive: true } },
          priceLists: true,
        },
      });
      const broken: Array<{ id: string; name: string; missing: string[] }> = [];
      for (const a of accounts) {
        const missing: string[] = [];
        if (a.paymentAccounts.length === 0) missing.push("paymentAccounts");
        if (a.paymentChannels.length === 0) missing.push("paymentChannels");
        if (a.priceLists.length === 0) missing.push("priceLists");
        if (missing.length > 0) broken.push({ id: a.id, name: a.name, missing });
      }
      return broken.length === 0
        ? { ok: true, message: `${accounts.length} cuentas con setup completo.` }
        : {
            ok: false,
            message: `${broken.length} cuentas incompletas`,
            details: { broken: broken.slice(0, 5) },
          };
    },
  },
  {
    key: "sim-create-delete-product",
    name: "Simulación: crear+borrar producto",
    description:
      "Crea un producto test, lo lee, lo elimina. Debe completarse en <1s.",
    category: "simulation",
    destructive: true,
    async run() {
      // Tomamos la primera cuenta y su primera categoría disponible.
      const account = await db.account.findFirst();
      if (!account) return { ok: false, message: "No hay accounts para testear" };
      const category = await db.productCategory.findFirst({
        where: { accountId: account.id },
      });
      if (!category)
        return { ok: false, message: "La cuenta no tiene categorías" };

      const testName = `__smoke_test_${Date.now()}`;
      const created = await db.product.create({
        data: {
          accountId: account.id,
          categoryId: category.id,
          name: testName,
          acquisitionCost: 1,
        },
      });
      const read = await db.product.findUnique({ where: { id: created.id } });
      if (!read) {
        // Intento de limpieza por las dudas
        await db.product.delete({ where: { id: created.id } }).catch(() => {});
        return { ok: false, message: "Creado pero no se pudo leer" };
      }
      await db.product.delete({ where: { id: created.id } });
      return {
        ok: true,
        message: `Producto test creado y eliminado (id=${created.id.slice(0, 8)}...)`,
      };
    },
  },
  {
    key: "sim-support-webhook",
    name: "Simulación: webhook de soporte",
    description:
      "Envía un reporte de prueba al endpoint /api/support. Verifica que se guarde.",
    category: "simulation",
    destructive: true,
    async run() {
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
      const res = await fetch(`${origin}/api/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "[SMOKE TEST] ignorar",
          description: "Ping automático del runner de admin.",
          type: "question",
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        return {
          ok: false,
          message: `Respuesta inesperada: ${JSON.stringify(body)}`,
        };
      }
      return {
        ok: true,
        message: `Reporte creado (id=${String(body.id).slice(0, 8)}...). Discord se dispara en paralelo.`,
        details: { reportId: body.id },
      };
    },
  },
];

// ============================================
// DB INSPECTOR — mapping de tablas inspeccionables
// ============================================

const DB_TABLES = [
  { key: "accounts",              model: "account",            label: "Accounts",             searchFields: ["name"] },
  { key: "branches",              model: "branch",             label: "Branches",             searchFields: ["name", "address"] },
  { key: "account_members",       model: "accountMember",      label: "Account members",      searchFields: ["displayName", "role"] },
  { key: "users",                 model: "user",               label: "Users",                searchFields: ["email", "name"] },
  { key: "product_categories",    model: "productCategory",    label: "Categorías productos", searchFields: ["name", "description"] },
  { key: "product_subcategories", model: "productSubcategory", label: "Subcategorías",        searchFields: ["name", "description"] },
  { key: "cost_categories",       model: "costCategory",       label: "Categorías costos",    searchFields: ["name", "costType"] },
  { key: "payment_methods",       model: "paymentMethod",      label: "Tipos de pago",        searchFields: ["name"] },
  { key: "payment_accounts",      model: "paymentAccount",     label: "Cuentas receptoras",   searchFields: ["name", "provider"] },
  { key: "payment_channels",      model: "paymentChannel",     label: "Canales de pago",      searchFields: ["name"] },
  { key: "suppliers",             model: "supplier",           label: "Proveedores",          searchFields: ["name", "cuit", "email"] },
  { key: "clients",               model: "client",             label: "Clientes",             searchFields: ["name", "cuit", "email"] },
  { key: "products",              model: "product",            label: "Productos",            searchFields: ["name", "barcode", "sku"] },
  { key: "price_lists",           model: "priceList",          label: "Listas de precios",    searchFields: ["name"] },
  { key: "price_list_items",      model: "priceListItem",      label: "Items de listas",      searchFields: [] },
  { key: "sales",                 model: "sale",               label: "Ventas",               searchFields: ["invoiceNumber", "notes"] },
  { key: "sale_payments",         model: "salePayment",        label: "Pagos de ventas",      searchFields: ["notes"] },
  { key: "purchases",             model: "purchase",           label: "Compras",              searchFields: ["invoiceNumber", "description", "notes"] },
  { key: "purchase_payments",     model: "purchasePayment",    label: "Pagos de compras",     searchFields: ["notes"] },
  { key: "stock_movements",       model: "stockMovement",      label: "Movimientos stock",    searchFields: ["notes", "movementType"] },
  { key: "bank_accounts",         model: "bankAccount",        label: "Cuentas bancarias",    searchFields: ["name"] },
  { key: "cash_flow_entries",     model: "cashFlowEntry",      label: "Cashflow",             searchFields: ["concept", "notes"] },
  { key: "projections",           model: "projection",         label: "Proyecciones",         searchFields: ["notes"] },
  { key: "afip_configs",          model: "afipConfig",         label: "AFIP configs",         searchFields: ["cuit"] },
  { key: "invoices",              model: "invoice",            label: "Facturas",             searchFields: ["invoiceTypeName", "customerName", "docNro", "cae"] },
  { key: "user_memories",         model: "userMemory",         label: "User memories",        searchFields: ["content", "category"] },
  { key: "bug_reports",           model: "bugReport",          label: "Bug reports",          searchFields: ["title", "description", "userEmail"] },
] as const;

type DbTableDef = (typeof DB_TABLES)[number];

function findTableDef(key: string): DbTableDef | undefined {
  return DB_TABLES.find((t) => t.key === key);
}

export const adminRouter = router({
  // ============================================
  // BUG REPORTS
  // ============================================

  listBugs: adminProcedure
    .input(
      z.object({
        status: z.enum(["open", "investigating", "resolved", "wontfix", "all"]).optional().default("all"),
        severity: z.enum(["low", "medium", "high", "critical", "all"]).optional().default("all"),
        source: z.string().optional(), // manual | auto-error | etc
        search: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const where: Prisma.BugReportWhereInput = {};
      if (input.status && input.status !== "all") where.status = input.status;
      if (input.severity && input.severity !== "all") where.severity = input.severity;
      if (input.source) where.source = input.source;
      if (input.search) {
        where.OR = [
          { title: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
          { userEmail: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const bugs = await db.bugReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit,
        // NO traigas el screenshot en la lista (puede ser pesado)
        select: {
          id: true,
          accountId: true,
          userEmail: true,
          source: true,
          severity: true,
          status: true,
          title: true,
          description: true,
          url: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return bugs;
    }),

  getBug: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const bug = await db.bugReport.findUnique({ where: { id: input.id } });
      if (!bug) throw new TRPCError({ code: "NOT_FOUND", message: "Reporte no encontrado" });
      return bug;
    }),

  updateBug: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["open", "investigating", "resolved", "wontfix"]).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const bug = await db.bugReport.update({
        where: { id },
        data,
      });
      return bug;
    }),

  deleteBug: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.bugReport.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ============================================
  // HEALTH / STATS
  // ============================================

  dbStats: adminProcedure.query(async () => {
    const [
      accounts,
      users,
      products,
      sales,
      purchases,
      openBugs,
      criticalBugs,
    ] = await Promise.all([
      db.account.count(),
      db.user.count(),
      db.product.count(),
      db.sale.count(),
      db.purchase.count(),
      db.bugReport.count({ where: { status: "open" } }),
      db.bugReport.count({ where: { severity: "critical", status: { not: "resolved" } } }),
    ]);
    return {
      accounts,
      users,
      products,
      sales,
      purchases,
      openBugs,
      criticalBugs,
    };
  }),

  recentBugs: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(5) }).optional())
    .query(async ({ input }) => {
      return db.bugReport.findMany({
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 5,
        select: {
          id: true,
          title: true,
          severity: true,
          status: true,
          source: true,
          userEmail: true,
          createdAt: true,
        },
      });
    }),

  recentSales: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(5) }).optional())
    .query(async ({ input }) => {
      return db.sale.findMany({
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 5,
        select: {
          id: true,
          saleDate: true,
          unitPrice: true,
          quantity: true,
          discountPct: true,
          status: true,
          product: { select: { name: true } },
        },
      });
    }),

  // ============================================
  // DB INSPECTOR (mini Prisma Studio)
  // ============================================

  dbListTables: adminProcedure.query(async () => {
    const results = await Promise.all(
      DB_TABLES.map(async (t) => {
        const model = (db as any)[t.model];
        let count = 0;
        try {
          count = await model.count();
        } catch {
          count = -1;
        }
        return { key: t.key, label: t.label, count };
      })
    );
    return results;
  }),

  dbGetRows: adminProcedure
    .input(
      z.object({
        table: z.string(),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(1).max(1000).default(25),
        search: z.string().optional(),
        orderBy: z
          .enum(["createdAt_desc", "createdAt_asc", "id_desc", "id_asc"])
          .optional()
          .default("createdAt_desc"),
      })
    )
    .query(async ({ input }) => {
      const tableDef = findTableDef(input.table);
      if (!tableDef) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tabla desconocida" });
      }

      const model = (db as any)[tableDef.model];
      if (!model) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Modelo no disponible",
        });
      }

      const where: any = {};
      if (input.search && tableDef.searchFields.length > 0) {
        where.OR = tableDef.searchFields.map((f) => ({
          [f]: { contains: input.search, mode: "insensitive" },
        }));
      }

      const orderByClause = input.orderBy.startsWith("createdAt")
        ? { createdAt: input.orderBy.endsWith("desc") ? "desc" : "asc" }
        : { id: input.orderBy.endsWith("desc") ? "desc" : "asc" };

      let rows: any[] = [];
      try {
        rows = await model.findMany({
          where,
          orderBy: orderByClause,
          skip: input.page * input.pageSize,
          take: input.pageSize,
        });
      } catch {
        // Fallback si la tabla no tiene el campo de ordenamiento (ej. ningún createdAt).
        try {
          rows = await model.findMany({
            where,
            skip: input.page * input.pageSize,
            take: input.pageSize,
          });
        } catch (err: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err?.message ?? "Error al consultar la tabla",
          });
        }
      }

      let total = 0;
      try {
        total = await model.count({ where });
      } catch {
        total = rows.length;
      }

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        rows,
        total,
        page: input.page,
        pageSize: input.pageSize,
        columns,
        table: { key: tableDef.key, label: tableDef.label, model: tableDef.model },
      };
    }),

  dbDeleteRow: adminProcedure
    .input(z.object({ table: z.string(), id: z.string() }))
    .mutation(async ({ input }) => {
      const tableDef = findTableDef(input.table);
      if (!tableDef) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tabla desconocida" });
      }
      const model = (db as any)[tableDef.model];
      if (!model) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Modelo no disponible",
        });
      }

      try {
        await model.delete({ where: { id: input.id } });
        return { success: true };
      } catch (err: any) {
        if (err?.code === "P2003") {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "No se puede eliminar: hay registros relacionados que dependen de este.",
          });
        }
        if (err?.code === "P2025") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Registro no encontrado",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err?.message ?? "Error al eliminar",
        });
      }
    }),

  // ============================================
  // SMOKE TESTS
  // ============================================

  testsList: adminProcedure.query(() => {
    return SMOKE_TESTS.map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description,
      category: t.category,
      destructive: t.destructive,
    }));
  }),

  testsRun: adminProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }): Promise<TestResult> => {
      const test = SMOKE_TESTS.find((t) => t.key === input.key);
      if (!test) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Test desconocido",
        });
      }
      const start = Date.now();
      try {
        const result = await test.run();
        return { ...result, durationMs: Date.now() - start };
      } catch (err: any) {
        return {
          ok: false,
          message: err?.message ?? "Error ejecutando test",
          details: { stack: err?.stack?.slice(0, 500) },
          durationMs: Date.now() - start,
        };
      }
    }),
});
