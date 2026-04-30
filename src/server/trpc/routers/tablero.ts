import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { db } from "@/server/db";

// ============================================================
// Helpers
// ============================================================

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function calcSaleDerived(
  unitPrice: number,
  quantity: number,
  discountPct: number,
  unitCost: number,
  ivaRate: number,
  isRI: boolean
) {
  const subtotal = unitPrice * quantity * (1 - discountPct / 100);
  const ivaAmount = isRI ? subtotal * (ivaRate / 100) : 0;
  const total = subtotal + ivaAmount;
  const variableCostTotal = unitCost * quantity;
  const contributionMargin = subtotal - variableCostTotal;
  const marginPct = subtotal > 0 ? (contributionMargin / subtotal) * 100 : 0;
  return { subtotal, ivaAmount, total, variableCostTotal, contributionMargin, marginPct };
}

// ============================================================
// Router
// ============================================================

export const tableroRouter = router({
  // ——————————————————————————————
  // GET DASHBOARD DATA (single query for everything)
  // ——————————————————————————————
  getDashboard: protectedProcedure
    .input(
      z.object({
        dateFrom: z.coerce.date(),
        dateTo: z.coerce.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { dateFrom, dateTo } = input;
      const accountId = ctx.accountId;

      const account = await db.account.findUnique({
        where: { id: accountId },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      const isRI = account.taxStatus === "responsable_inscripto";

      // ─── Parallel fetches ───
      const [sales, purchases, stockAlerts, recentSales, recentPurchases] =
        await Promise.all([
          // All sales in period
          db.sale.findMany({
            where: { accountId, saleDate: { gte: dateFrom, lte: dateTo } },
            include: {
              payments: { select: { amount: true } },
              product: { select: { name: true } },
              category: { select: { name: true } },
            },
          }),
          // All purchases in period
          db.purchase.findMany({
            where: { accountId, invoiceDate: { gte: dateFrom, lte: dateTo } },
            include: {
              payments: { select: { amount: true } },
              costCategory: { select: { name: true, costType: true } },
            },
          }),
          // Products with low stock
          db.product.findMany({
            where: { accountId, isActive: true },
            include: {
              stockMovements: { select: { quantity: true } },
            },
          }),
          // Last 5 sales
          db.sale.findMany({
            where: { accountId },
            orderBy: { saleDate: "desc" },
            take: 5,
            include: {
              product: { select: { name: true } },
              payments: { select: { amount: true } },
            },
          }),
          // Last 5 purchases
          db.purchase.findMany({
            where: { accountId },
            orderBy: { invoiceDate: "desc" },
            take: 5,
            include: {
              product: { select: { name: true } },
              costCategory: { select: { name: true } },
            },
          }),
        ]);

      // ─── KPIs from sales ───
      let totalVentas = 0;
      let totalSubtotal = 0;
      let totalCM = 0;
      let totalCobrado = 0;
      let countSales = sales.length;

      for (const sale of sales) {
        const derived = calcSaleDerived(
          sale.unitPrice,
          sale.quantity,
          sale.discountPct,
          sale.unitCost,
          account.ivaRate,
          isRI
        );
        totalVentas += derived.total;
        totalSubtotal += derived.subtotal;
        totalCM += derived.contributionMargin;

        const paid = sale.payments.reduce((s, p) => s + p.amount, 0);
        totalCobrado += paid;
      }

      const totalPendiente = totalVentas - totalCobrado;
      const ticketPromedio = countSales > 0 ? totalVentas / countSales : 0;
      const margenCM = totalSubtotal > 0 ? (totalCM / totalSubtotal) * 100 : 0;
      const pctCobrado = totalVentas > 0 ? (totalCobrado / totalVentas) * 100 : 0;

      // ─── KPIs from purchases ───
      let totalEgresos = 0;
      let totalCV = 0;
      let totalCF = 0;
      let totalImpuestos = 0;
      let totalPagado = 0;

      for (const purchase of purchases) {
        const subtotal = purchase.unitCost * purchase.quantity * (1 - purchase.discountPct / 100);
        const total = subtotal + purchase.ivaAmount;
        totalEgresos += total;

        const paid = purchase.payments.reduce((s, p) => s + p.amount, 0);
        totalPagado += paid;

        if (purchase.costCategory.costType === "variable") totalCV += total;
        else if (purchase.costCategory.costType === "fijo") totalCF += total;
        else if (purchase.costCategory.costType === "impuestos") totalImpuestos += total;
      }

      const utilidad = totalCM - totalCF;
      const ebitda = totalCM - totalCF;

      // ─── Stock alerts ───
      const lowStockProducts = stockAlerts
        .map((p) => {
          const movementTotal = p.stockMovements.reduce((s, m) => s + m.quantity, 0);
          const currentStock = p.initialStock + movementTotal;
          return {
            id: p.id,
            name: p.name,
            currentStock,
            minStock: p.minStock,
            isLow: currentStock <= p.minStock,
          };
        })
        .filter((p) => p.isLow);

      // ─── Daily sales for chart (group by day) ───
      const dailySalesMap = new Map<string, { ventas: number; cm: number; count: number }>();

      for (const sale of sales) {
        const dayKey = new Date(sale.saleDate).toISOString().split("T")[0];
        const derived = calcSaleDerived(
          sale.unitPrice,
          sale.quantity,
          sale.discountPct,
          sale.unitCost,
          account.ivaRate,
          isRI
        );

        const existing = dailySalesMap.get(dayKey) || { ventas: 0, cm: 0, count: 0 };
        existing.ventas += derived.total;
        existing.cm += derived.contributionMargin;
        existing.count += 1;
        dailySalesMap.set(dayKey, existing);
      }

      // Fill gaps (all days in range)
      const dailySales: { date: string; ventas: number; cm: number; count: number }[] = [];
      const current = new Date(dateFrom);
      const end = new Date(dateTo);
      while (current <= end) {
        const key = current.toISOString().split("T")[0];
        const data = dailySalesMap.get(key) || { ventas: 0, cm: 0, count: 0 };
        dailySales.push({
          date: key,
          ventas: r2(data.ventas),
          cm: r2(data.cm),
          count: data.count,
        });
        current.setDate(current.getDate() + 1);
      }

      // ─── Sales by status (for pie chart) ───
      const statusCounts = { pending: 0, partial: 0, paid: 0, overdue: 0 };
      for (const sale of sales) {
        const status = sale.status as keyof typeof statusCounts;
        if (status in statusCounts) statusCounts[status]++;
      }

      // ─── Top products by revenue ───
      const productRevenueMap = new Map<string, { name: string; revenue: number; cm: number; qty: number }>();
      for (const sale of sales) {
        const name = sale.product?.name || "Sin producto";
        const derived = calcSaleDerived(
          sale.unitPrice,
          sale.quantity,
          sale.discountPct,
          sale.unitCost,
          account.ivaRate,
          isRI
        );
        const existing = productRevenueMap.get(name) || { name, revenue: 0, cm: 0, qty: 0 };
        existing.revenue += derived.total;
        existing.cm += derived.contributionMargin;
        existing.qty += sale.quantity;
        productRevenueMap.set(name, existing);
      }

      const topProducts = Array.from(productRevenueMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map((p) => ({
          name: p.name,
          revenue: r2(p.revenue),
          cm: r2(p.cm),
          qty: r2(p.qty),
        }));

      // ─── Expense by cost type (for pie chart) ───
      const expenseByType = [
        { name: "Variables", value: r2(totalCV), color: "#ef4444" },
        { name: "Fijos", value: r2(totalCF), color: "#f97316" },
        { name: "Impuestos", value: r2(totalImpuestos), color: "#8b5cf6" },
      ].filter((e) => e.value > 0);

      // ─── Recent activity ───
      const recentActivity = [
        ...recentSales.map((s) => ({
          id: s.id,
          type: "venta" as const,
          date: s.saleDate,
          concept: s.product?.name || "Venta",
          amount: r2(
            s.unitPrice * s.quantity * (1 - s.discountPct / 100) +
              (isRI ? s.unitPrice * s.quantity * (1 - s.discountPct / 100) * (account.ivaRate / 100) : 0)
          ),
          status: s.status,
        })),
        ...recentPurchases.map((p) => ({
          id: p.id,
          type: "compra" as const,
          date: p.invoiceDate,
          concept: p.product?.name || p.description || p.costCategory.name,
          amount: r2(
            p.unitCost * p.quantity * (1 - p.discountPct / 100) + p.ivaAmount
          ),
          status: p.status,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8);

      return {
        kpis: {
          totalVentas: r2(totalVentas),
          totalSubtotal: r2(totalSubtotal),
          totalCM: r2(totalCM),
          margenCM: r2(margenCM),
          totalCobrado: r2(totalCobrado),
          totalPendiente: r2(totalPendiente),
          pctCobrado: r2(pctCobrado),
          ticketPromedio: r2(ticketPromedio),
          countSales,
          totalEgresos: r2(totalEgresos),
          totalPagado: r2(totalPagado),
          totalCV: r2(totalCV),
          totalCF: r2(totalCF),
          totalImpuestos: r2(totalImpuestos),
          utilidad: r2(utilidad),
          ebitda: r2(ebitda),
        },
        charts: {
          dailySales,
          statusCounts,
          topProducts,
          expenseByType,
        },
        lowStockProducts,
        recentActivity,
      };
    }),
});
