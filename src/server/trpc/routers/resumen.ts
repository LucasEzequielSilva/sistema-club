import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../init";
import { db } from "@/server/db";

// ============================================================
// Helpers (duplicated from ventas/compras — read-only)
// ============================================================

function calcSaleDerived(
  unitPrice: number,
  quantity: number,
  discountPct: number,
  unitCost: number,
  account: { taxStatus: string; ivaRate: number }
) {
  const subtotal = unitPrice * quantity * (1 - discountPct / 100);
  const ivaAmount =
    account.taxStatus === "responsable_inscripto"
      ? subtotal * (account.ivaRate / 100)
      : 0;
  const total = subtotal + ivaAmount;
  const variableCostTotal = unitCost * quantity;
  const contributionMargin = subtotal - variableCostTotal;
  const marginPct = subtotal > 0 ? (contributionMargin / subtotal) * 100 : 0;

  return { subtotal, ivaAmount, total, variableCostTotal, contributionMargin, marginPct };
}

function calcPurchaseDerived(
  unitCost: number,
  quantity: number,
  discountPct: number,
  ivaAmount: number
) {
  const subtotal = unitCost * quantity * (1 - discountPct / 100);
  const total = subtotal + ivaAmount;
  return { subtotal, total };
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

// ============================================================
// Router
// ============================================================

export const resumenRouter = router({
  // ——————————————————————————————
  // INCOME SUMMARY (Resumen de Ingresos)
  // By category, by origin, by product — for a period
  // ——————————————————————————————
  incomeSummary: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        dateFrom: z.coerce.date(),
        dateTo: z.coerce.date(),
      })
    )
    .query(async ({ input }) => {
      const account = await db.account.findUnique({
        where: { id: input.accountId },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      const sales = await db.sale.findMany({
        where: {
          accountId: input.accountId,
          saleDate: { gte: input.dateFrom, lte: input.dateTo },
        },
        include: {
          product: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          payments: true,
        },
      });

      // Aggregate totals
      let totalSales = 0;
      let totalSubtotal = 0;
      let totalIva = 0;
      let totalCM = 0;
      let totalVariableCost = 0;
      let totalPaid = 0;
      let countSales = sales.length;

      // By category
      const byCategoryMap = new Map<
        string,
        { id: string; name: string; total: number; cm: number; count: number }
      >();

      // By origin
      const byOrigin = { mayorista: { total: 0, cm: 0, count: 0 }, minorista: { total: 0, cm: 0, count: 0 } };

      // By product (top sellers)
      const byProductMap = new Map<
        string,
        { id: string; name: string; total: number; cm: number; quantity: number; count: number }
      >();

      for (const sale of sales) {
        const d = calcSaleDerived(
          sale.unitPrice,
          sale.quantity,
          sale.discountPct,
          sale.unitCost,
          account
        );

        totalSubtotal += d.subtotal;
        totalIva += d.ivaAmount;
        totalSales += d.total;
        totalCM += d.contributionMargin;
        totalVariableCost += d.variableCostTotal;
        totalPaid += sale.payments.reduce((sum, p) => sum + p.amount, 0);

        // By category
        const catKey = sale.category.id;
        const existing = byCategoryMap.get(catKey);
        if (existing) {
          existing.total += d.total;
          existing.cm += d.contributionMargin;
          existing.count++;
        } else {
          byCategoryMap.set(catKey, {
            id: sale.category.id,
            name: sale.category.name,
            total: d.total,
            cm: d.contributionMargin,
            count: 1,
          });
        }

        // By origin
        const origin = sale.origin === "mayorista" ? "mayorista" : "minorista";
        byOrigin[origin].total += d.total;
        byOrigin[origin].cm += d.contributionMargin;
        byOrigin[origin].count++;

        // By product
        const prodKey = sale.product.id;
        const existingProd = byProductMap.get(prodKey);
        if (existingProd) {
          existingProd.total += d.total;
          existingProd.cm += d.contributionMargin;
          existingProd.quantity += sale.quantity;
          existingProd.count++;
        } else {
          byProductMap.set(prodKey, {
            id: sale.product.id,
            name: sale.product.name,
            total: d.total,
            cm: d.contributionMargin,
            quantity: sale.quantity,
            count: 1,
          });
        }
      }

      const byCategory = Array.from(byCategoryMap.values())
        .map((c) => ({
          ...c,
          total: r2(c.total),
          cm: r2(c.cm),
          pct: totalSales > 0 ? r2((c.total / totalSales) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      const byProduct = Array.from(byProductMap.values())
        .map((p) => ({
          ...p,
          total: r2(p.total),
          cm: r2(p.cm),
          quantity: r2(p.quantity),
          pct: totalSales > 0 ? r2((p.total / totalSales) * 100) : 0,
          marginPct: p.total > 0 ? r2((p.cm / p.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      return {
        totals: {
          totalSales: r2(totalSales),
          totalSubtotal: r2(totalSubtotal),
          totalIva: r2(totalIva),
          totalCM: r2(totalCM),
          totalVariableCost: r2(totalVariableCost),
          totalPaid: r2(totalPaid),
          totalPending: r2(totalSales - totalPaid),
          countSales,
          avgTicket: countSales > 0 ? r2(totalSales / countSales) : 0,
          marginPct: totalSubtotal > 0 ? r2((totalCM / totalSubtotal) * 100) : 0,
        },
        byCategory,
        byOrigin: {
          mayorista: {
            total: r2(byOrigin.mayorista.total),
            cm: r2(byOrigin.mayorista.cm),
            count: byOrigin.mayorista.count,
          },
          minorista: {
            total: r2(byOrigin.minorista.total),
            cm: r2(byOrigin.minorista.cm),
            count: byOrigin.minorista.count,
          },
        },
        byProduct,
      };
    }),

  // ——————————————————————————————
  // EXPENSE SUMMARY (Resumen de Egresos)
  // By cost category, by cost type, by supplier — for a period
  // ——————————————————————————————
  expenseSummary: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        dateFrom: z.coerce.date(),
        dateTo: z.coerce.date(),
      })
    )
    .query(async ({ input }) => {
      const purchases = await db.purchase.findMany({
        where: {
          accountId: input.accountId,
          invoiceDate: { gte: input.dateFrom, lte: input.dateTo },
        },
        include: {
          costCategory: { select: { id: true, name: true, costType: true } },
          supplier: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
          payments: true,
        },
      });

      let totalPurchases = 0;
      let totalPaid = 0;
      let countPurchases = purchases.length;

      // By cost type
      const byCostType = {
        variable: { total: 0, count: 0 },
        fijo: { total: 0, count: 0 },
        impuestos: { total: 0, count: 0 },
      };

      // By cost category
      const byCategoryMap = new Map<
        string,
        { id: string; name: string; costType: string; total: number; count: number }
      >();

      // By supplier
      const bySupplierMap = new Map<
        string,
        { id: string; name: string; total: number; count: number }
      >();

      for (const purchase of purchases) {
        const d = calcPurchaseDerived(
          purchase.unitCost,
          purchase.quantity,
          purchase.discountPct,
          purchase.ivaAmount
        );

        totalPurchases += d.total;
        totalPaid += purchase.payments.reduce((sum, p) => sum + p.amount, 0);

        // By cost type
        const ct = purchase.costCategory.costType as keyof typeof byCostType;
        if (byCostType[ct]) {
          byCostType[ct].total += d.total;
          byCostType[ct].count++;
        }

        // By category
        const catKey = purchase.costCategory.id;
        const existingCat = byCategoryMap.get(catKey);
        if (existingCat) {
          existingCat.total += d.total;
          existingCat.count++;
        } else {
          byCategoryMap.set(catKey, {
            id: purchase.costCategory.id,
            name: purchase.costCategory.name,
            costType: purchase.costCategory.costType,
            total: d.total,
            count: 1,
          });
        }

        // By supplier
        if (purchase.supplier) {
          const suppKey = purchase.supplier.id;
          const existingSupp = bySupplierMap.get(suppKey);
          if (existingSupp) {
            existingSupp.total += d.total;
            existingSupp.count++;
          } else {
            bySupplierMap.set(suppKey, {
              id: purchase.supplier.id,
              name: purchase.supplier.name,
              total: d.total,
              count: 1,
            });
          }
        }
      }

      const byCategory = Array.from(byCategoryMap.values())
        .map((c) => ({
          ...c,
          total: r2(c.total),
          pct: totalPurchases > 0 ? r2((c.total / totalPurchases) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      const bySupplier = Array.from(bySupplierMap.values())
        .map((s) => ({
          ...s,
          total: r2(s.total),
          pct: totalPurchases > 0 ? r2((s.total / totalPurchases) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      return {
        totals: {
          totalPurchases: r2(totalPurchases),
          totalPaid: r2(totalPaid),
          totalPending: r2(totalPurchases - totalPaid),
          countPurchases,
          variable: r2(byCostType.variable.total),
          fijo: r2(byCostType.fijo.total),
          impuestos: r2(byCostType.impuestos.total),
        },
        byCategory,
        bySupplier,
      };
    }),

  // ——————————————————————————————
  // ECONOMIC STATEMENT (Estado Económico)
  // Ventas - CV = CM - CF = Resultado Bruto - Impuestos = Resultado Neto
  // ——————————————————————————————
  economicStatement: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        dateFrom: z.coerce.date(),
        dateTo: z.coerce.date(),
      })
    )
    .query(async ({ input }) => {
      const account = await db.account.findUnique({
        where: { id: input.accountId },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      // ─── Sales ─────────────────────────────────────
      const sales = await db.sale.findMany({
        where: {
          accountId: input.accountId,
          saleDate: { gte: input.dateFrom, lte: input.dateTo },
        },
      });

      let totalVentas = 0;
      let totalCostoVariable_ventas = 0;

      for (const sale of sales) {
        const d = calcSaleDerived(
          sale.unitPrice,
          sale.quantity,
          sale.discountPct,
          sale.unitCost,
          account
        );
        totalVentas += d.subtotal; // neto (sin IVA) for economic analysis
        totalCostoVariable_ventas += d.variableCostTotal;
      }

      // ─── Purchases (expenses) ──────────────────────
      const purchases = await db.purchase.findMany({
        where: {
          accountId: input.accountId,
          invoiceDate: { gte: input.dateFrom, lte: input.dateTo },
        },
        include: {
          costCategory: { select: { costType: true } },
        },
      });

      let totalCostoVariable_compras = 0;
      let totalCostoFijo = 0;
      let totalImpuestos = 0;

      for (const purchase of purchases) {
        const d = calcPurchaseDerived(
          purchase.unitCost,
          purchase.quantity,
          purchase.discountPct,
          purchase.ivaAmount
        );

        switch (purchase.costCategory.costType) {
          case "variable":
            totalCostoVariable_compras += d.total;
            break;
          case "fijo":
            totalCostoFijo += d.total;
            break;
          case "impuestos":
            totalImpuestos += d.total;
            break;
        }
      }

      // ─── Economic Statement ────────────────────────
      // For the economic statement, "variable costs" include:
      // 1. The variable cost of goods sold (unitCost * qty from sales)
      // 2. Plus any purchases classified as "variable" that aren't product purchases
      //    (e.g., freight per sale, packaging, etc.)
      const totalCostosVariables = totalCostoVariable_ventas + totalCostoVariable_compras;
      const contributionMargin = totalVentas - totalCostosVariables;
      const resultadoBruto = contributionMargin - totalCostoFijo;
      const resultadoNeto = resultadoBruto - totalImpuestos;

      // Metrics
      const indiceVariabilidad = totalVentas > 0 ? (totalCostosVariables / totalVentas) * 100 : 0;
      const margenCM = totalVentas > 0 ? (contributionMargin / totalVentas) * 100 : 0;
      const incidenciaCF = totalVentas > 0 ? (totalCostoFijo / totalVentas) * 100 : 0;

      return {
        ventas: r2(totalVentas),
        costosVariables: r2(totalCostosVariables),
        contributionMargin: r2(contributionMargin),
        costosFijos: r2(totalCostoFijo),
        resultadoBruto: r2(resultadoBruto),
        impuestos: r2(totalImpuestos),
        resultadoNeto: r2(resultadoNeto),
        metrics: {
          indiceVariabilidad: r2(indiceVariabilidad),
          margenCM: r2(margenCM),
          incidenciaCF: r2(incidenciaCF),
        },
        countSales: sales.length,
        countPurchases: purchases.length,
      };
    }),
});
