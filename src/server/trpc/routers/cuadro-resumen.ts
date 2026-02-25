import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../init";
import { db } from "@/server/db";

// ============================================================
// Helpers
// ============================================================

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

// ============================================================
// Router
// ============================================================

export const cuadroResumenRouter = router({
  // ——————————————————————————————
  // GET MONTHLY SCORECARD (projected vs real)
  // Business Rule #13
  // ——————————————————————————————
  getScorecard: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        year: z.number(),
        month: z.number(), // 0-indexed
      })
    )
    .query(async ({ input }) => {
      const { accountId, year, month } = input;

      const account = await db.account.findUnique({
        where: { id: accountId },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      const isRI = account.taxStatus === "responsable_inscripto";
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

      // ─── Parallel fetches ───
      const [sales, purchases, projection] = await Promise.all([
        db.sale.findMany({
          where: {
            accountId,
            saleDate: { gte: monthStart, lte: monthEnd },
          },
          include: {
            payments: { select: { amount: true } },
          },
        }),
        db.purchase.findMany({
          where: {
            accountId,
            invoiceDate: { gte: monthStart, lte: monthEnd },
          },
          include: {
            costCategory: { select: { costType: true } },
          },
        }),
        db.projection.findUnique({
          where: {
            accountId_year_month: { accountId, year, month },
          },
        }),
      ]);

      // ─── Calculate REAL KPIs ───
      let totalVentas = 0; // total with IVA
      let totalSubtotal = 0; // net (without IVA)
      let totalCM = 0;
      let totalCobrado = 0;
      const countSales = sales.length;

      for (const sale of sales) {
        const subtotal = sale.unitPrice * sale.quantity * (1 - sale.discountPct / 100);
        const ivaAmount = isRI ? subtotal * (account.ivaRate / 100) : 0;
        const total = subtotal + ivaAmount;
        const variableCostTotal = sale.unitCost * sale.quantity;
        const cm = subtotal - variableCostTotal;

        totalVentas += total;
        totalSubtotal += subtotal;
        totalCM += cm;
        totalCobrado += sale.payments.reduce((s, p) => s + p.amount, 0);
      }

      // Expenses
      let totalCF = 0;

      for (const purchase of purchases) {
        const subtotal = purchase.unitCost * purchase.quantity * (1 - purchase.discountPct / 100);
        const total = subtotal + purchase.ivaAmount;
        if (purchase.costCategory.costType === "fijo") totalCF += total;
      }

      // Derived real KPIs
      const realVentas = r2(totalVentas);
      const realRentabilidad = totalSubtotal > 0 ? r2((totalCM / totalSubtotal) * 100) : 0;
      const realUtilidad = r2(totalCM - totalCF);
      const realTicketPromedio = countSales > 0 ? r2(totalVentas / countSales) : 0;
      const realCMPromedio = countSales > 0 ? r2((totalCM / totalSubtotal) * 100) : 0;
      const realPctCobrado = totalVentas > 0 ? r2((totalCobrado / totalVentas) * 100) : 0;
      const realPendiente = r2(totalVentas - totalCobrado);

      // ─── Projection data ───
      const projectedSales = projection?.projectedSales ?? null;
      const exchangeRate = projection?.exchangeRate ?? null;

      // Projected KPIs (derived from projectedSales if set)
      // For projected rentabilidad, utilidad, ticket — we use last month's ratios as baseline
      // OR just show the projected sales and leave other projected fields as N/A
      // Business Rule #13 only requires Ventas, Rentabilidad, Utilidad, Utilidad USD as projected
      // For MVP: projected Utilidad = projectedSales * (real margin%) - CF

      const projRentabilidad = projectedSales && projectedSales > 0
        ? realRentabilidad // assume same margin as actual
        : null;

      const projUtilidad = projectedSales && projectedSales > 0
        ? r2(projectedSales * (realRentabilidad / 100) - totalCF)
        : null;

      const realUtilidadUSD = exchangeRate && exchangeRate > 0
        ? r2(realUtilidad / exchangeRate)
        : null;

      const projUtilidadUSD = projUtilidad !== null && exchangeRate && exchangeRate > 0
        ? r2(projUtilidad / exchangeRate)
        : null;

      // Variations
      const varVentas = projectedSales && projectedSales > 0
        ? r2(((realVentas - projectedSales) / projectedSales) * 100)
        : null;

      const varUtilidad = projUtilidad !== null
        ? r2(realUtilidad - projUtilidad)
        : null;

      const varUtilidadUSD = projUtilidadUSD !== null && realUtilidadUSD !== null
        ? r2(realUtilidadUSD - projUtilidadUSD)
        : null;

      const advancement = projectedSales && projectedSales > 0
        ? r2((realVentas / projectedSales) * 100)
        : null;

      return {
        year,
        month,
        projection: {
          projectedSales,
          exchangeRate,
          notes: projection?.notes ?? null,
        },
        // Main scorecard (BR #13 table)
        scorecard: {
          ventas: {
            projected: projectedSales,
            real: realVentas,
            variation: varVentas,
            unit: "$",
          },
          rentabilidad: {
            projected: projRentabilidad,
            real: realRentabilidad,
            variation: projRentabilidad !== null ? r2(realRentabilidad - projRentabilidad) : null,
            unit: "%",
          },
          utilidad: {
            projected: projUtilidad,
            real: realUtilidad,
            variation: varUtilidad,
            unit: "$",
          },
          utilidadUSD: {
            projected: projUtilidadUSD,
            real: realUtilidadUSD,
            variation: varUtilidadUSD,
            unit: "USD",
          },
        },
        // Additional KPIs (BR #13 bottom section)
        kpis: {
          ticketPromedio: realTicketPromedio,
          cmPromedio: realCMPromedio,
          cantidadVentas: countSales,
          pctCobrado: realPctCobrado,
          montoPendiente: realPendiente,
          advancement,
        },
        // Raw totals for context
        totals: {
          subtotal: r2(totalSubtotal),
          cm: r2(totalCM),
          cobrado: r2(totalCobrado),
          costosFijos: r2(totalCF),
        },
      };
    }),
});
