import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { upsertProjectionSchema } from "@/lib/validators/cashflow";

// ============================================================
// Helpers
// ============================================================

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Business Rule #12: weeks are 1-7, 8-14, 15-21, 22-28, 29-end */
function getWeekIndex(day: number): number {
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  if (day <= 28) return 3;
  return 4; // 29-31
}

function getWeekLabel(weekIndex: number): string {
  const labels = ["Sem 1 (1-7)", "Sem 2 (8-14)", "Sem 3 (15-21)", "Sem 4 (22-28)", "Sem 5 (29+)"];
  return labels[weekIndex] || `Sem ${weekIndex + 1}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ============================================================
// Router
// ============================================================

export const cashflowRouter = router({
  // ——————————————————————————————
  // GET WEEKLY PROJECTION for a month
  // Core algorithm: groups pending payments into weekly buckets
  // ——————————————————————————————
  getWeeklyProjection: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(), // 0-indexed
      })
    )
    .query(async ({ input, ctx }) => {
      const { year, month } = input;
      const accountId = ctx.accountId;
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      const totalDays = daysInMonth(year, month);
      const weekCount = totalDays > 28 ? 5 : 4;

      // ─── 1. Fetch all pending/partial sale payments with accreditationDate in this month ───
      // These are EXPECTED inflows: payments already registered but not yet accrued,
      // OR already accrued in this month
      const salePayments = await db.salePayment.findMany({
        where: {
          sale: { accountId },
          accreditationDate: { gte: monthStart, lte: monthEnd },
        },
        include: {
          paymentMethod: { select: { name: true } },
          sale: {
            select: {
              id: true,
              status: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { accreditationDate: "asc" },
      });

      // ─── 2. Fetch all pending/partial purchase payments with accreditationDate in this month ───
      // These are EXPECTED outflows
      const purchasePayments = await db.purchasePayment.findMany({
        where: {
          purchase: { accountId },
          accreditationDate: { gte: monthStart, lte: monthEnd },
        },
        include: {
          paymentMethod: { select: { name: true } },
          purchase: {
            select: {
              id: true,
              status: true,
              description: true,
              product: { select: { name: true } },
              supplier: { select: { name: true } },
            },
          },
        },
        orderBy: { accreditationDate: "asc" },
      });

      // ─── 3. Also fetch purchases with dueDate in this month that are still unpaid ───
      // (for expenses that have due dates but no payments yet)
      const unpaidPurchases = await db.purchase.findMany({
        where: {
          accountId,
          dueDate: { gte: monthStart, lte: monthEnd },
          status: { in: ["pending", "partial", "overdue"] },
        },
        include: {
          costCategory: { select: { name: true, costType: true } },
          product: { select: { name: true } },
          supplier: { select: { name: true } },
          payments: { select: { amount: true } },
        },
        orderBy: { dueDate: "asc" },
      });

      // ─── 4. Fetch unpaid sales with dueDate in this month ───
      const unpaidSales = await db.sale.findMany({
        where: {
          accountId,
          dueDate: { gte: monthStart, lte: monthEnd },
          status: { in: ["pending", "partial", "overdue"] },
        },
        include: {
          product: { select: { name: true } },
          payments: { select: { amount: true } },
        },
        orderBy: { dueDate: "asc" },
      });

      // Helper: compute sale total (derived field)
      function calcSaleTotal(sale: { unitPrice: number; quantity: number; discountPct: number }) {
        const subtotal = sale.unitPrice * sale.quantity * (1 - sale.discountPct / 100);
        // IVA would be added here for RI accounts, but for simplicity use subtotal
        // since sale payments track what's actually owed
        return subtotal;
      }

      // ─── 5. Fetch manual CashFlowEntries in this month ───
      const manualEntries = await db.cashFlowEntry.findMany({
        where: {
          accountId,
          entryDate: { gte: monthStart, lte: monthEnd },
        },
        include: {
          bankAccount: { select: { name: true } },
        },
        orderBy: { entryDate: "asc" },
      });

      // ─── 6. Build weekly buckets ───
      type FlowItem = {
        id: string;
        date: Date;
        direction: "ingreso" | "egreso";
        concept: string;
        method: string;
        amount: number;
        source: "cobro" | "pago" | "pendiente_cobro" | "pendiente_pago" | "manual";
        isPending: boolean; // true = projected/expected, false = confirmed
      };

      const allItems: FlowItem[] = [];

      // Sale payments (confirmed inflows)
      for (const sp of salePayments) {
        allItems.push({
          id: `sp-${sp.id}`,
          date: sp.accreditationDate!,
          direction: "ingreso",
          concept: `Cobro — ${sp.sale.product?.name || "Venta"}`,
          method: sp.paymentMethod.name,
          amount: sp.amount,
          source: "cobro",
          isPending: false,
        });
      }

      // Purchase payments (confirmed outflows)
      for (const pp of purchasePayments) {
        const conceptName = pp.purchase.product?.name || pp.purchase.description || "Gasto";
        allItems.push({
          id: `pp-${pp.id}`,
          date: pp.accreditationDate!,
          direction: "egreso",
          concept: `Pago — ${conceptName}`,
          method: pp.paymentMethod.name,
          amount: pp.amount,
          source: "pago",
          isPending: false,
        });
      }

      // Unpaid sales (projected inflows by dueDate)
      for (const sale of unpaidSales) {
        const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0);
        const saleTotal = calcSaleTotal(sale);
        const remaining = saleTotal - totalPaid;
        if (remaining > 0 && sale.dueDate) {
          allItems.push({
            id: `us-${sale.id}`,
            date: sale.dueDate,
            direction: "ingreso",
            concept: `Pendiente cobro — ${sale.product?.name || "Venta"}`,
            method: "Por cobrar",
            amount: r2(remaining),
            source: "pendiente_cobro",
            isPending: true,
          });
        }
      }

      // Unpaid purchases (projected outflows by dueDate)
      for (const purchase of unpaidPurchases) {
        const totalPaid = purchase.payments.reduce((s, p) => s + p.amount, 0);
        const subtotal = purchase.unitCost * purchase.quantity * (1 - purchase.discountPct / 100);
        const total = subtotal + purchase.ivaAmount;
        const remaining = total - totalPaid;
        if (remaining > 0 && purchase.dueDate) {
          allItems.push({
            id: `up-${purchase.id}`,
            date: purchase.dueDate,
            direction: "egreso",
            concept: `Pendiente pago — ${purchase.product?.name || purchase.description || purchase.costCategory.name}`,
            method: purchase.supplier?.name || "Por pagar",
            amount: r2(remaining),
            source: "pendiente_pago",
            isPending: true,
          });
        }
      }

      // Manual entries
      for (const entry of manualEntries) {
        allItems.push({
          id: `me-${entry.id}`,
          date: entry.entryDate,
          direction: entry.movementType === "ingreso" || entry.movementType === "apertura" ? "ingreso" : "egreso",
          concept: entry.concept || `Manual (${entry.movementType})`,
          method: entry.bankAccount.name,
          amount: entry.amount,
          source: "manual",
          isPending: false,
        });
      }

      // ─── 7. Group into weeks ───
      type WeekBucket = {
        weekIndex: number;
        label: string;
        items: FlowItem[];
        totalIngresos: number;
        totalEgresos: number;
        neto: number;
        ingresosConfirmed: number;
        egresoConfirmed: number;
        ingresosPending: number;
        egresosPending: number;
      };

      const weeks: WeekBucket[] = [];
      for (let w = 0; w < weekCount; w++) {
        weeks.push({
          weekIndex: w,
          label: getWeekLabel(w),
          items: [],
          totalIngresos: 0,
          totalEgresos: 0,
          neto: 0,
          ingresosConfirmed: 0,
          egresoConfirmed: 0,
          ingresosPending: 0,
          egresosPending: 0,
        });
      }

      for (const item of allItems) {
        const day = new Date(item.date).getDate();
        let wi = getWeekIndex(day);
        if (wi >= weekCount) wi = weekCount - 1; // clamp

        weeks[wi].items.push(item);

        if (item.direction === "ingreso") {
          weeks[wi].totalIngresos += item.amount;
          if (item.isPending) {
            weeks[wi].ingresosPending += item.amount;
          } else {
            weeks[wi].ingresosConfirmed += item.amount;
          }
        } else {
          weeks[wi].totalEgresos += item.amount;
          if (item.isPending) {
            weeks[wi].egresosPending += item.amount;
          } else {
            weeks[wi].egresoConfirmed += item.amount;
          }
        }
      }

      // Compute neto per week
      for (const w of weeks) {
        w.totalIngresos = r2(w.totalIngresos);
        w.totalEgresos = r2(w.totalEgresos);
        w.neto = r2(w.totalIngresos - w.totalEgresos);
        w.ingresosConfirmed = r2(w.ingresosConfirmed);
        w.egresoConfirmed = r2(w.egresoConfirmed);
        w.ingresosPending = r2(w.ingresosPending);
        w.egresosPending = r2(w.egresosPending);
      }

      // ─── 8. Running balance ───
      // Get opening balance from bank accounts
      const bankAccounts = await db.bankAccount.findMany({
        where: { accountId, isActive: true },
        include: { cashFlowEntries: true },
      });

      let openingBalance = 0;
      for (const acc of bankAccounts) {
        let bal = acc.initialBalance;
        for (const entry of acc.cashFlowEntries) {
          // Only count entries BEFORE this month for opening balance
          if (new Date(entry.entryDate) < monthStart) {
            if (entry.movementType === "ingreso" || entry.movementType === "apertura") {
              bal += entry.amount;
            } else if (entry.movementType === "egreso") {
              bal -= entry.amount;
            }
          }
        }
        openingBalance += bal;
      }

      // Also add confirmed sale/purchase payments from before this month
      const priorSalePayments = await db.salePayment.findMany({
        where: {
          sale: { accountId },
          accreditationDate: { lt: monthStart },
        },
        select: { amount: true },
      });
      const priorPurchasePayments = await db.purchasePayment.findMany({
        where: {
          purchase: { accountId },
          accreditationDate: { lt: monthStart },
        },
        select: { amount: true },
      });

      for (const p of priorSalePayments) openingBalance += p.amount;
      for (const p of priorPurchasePayments) openingBalance -= p.amount;

      openingBalance = r2(openingBalance);

      // Running balance per week
      const runningBalances: number[] = [];
      let running = openingBalance;
      for (const w of weeks) {
        running = r2(running + w.neto);
        runningBalances.push(running);
      }

      // ─── 9. Totals ───
      const totalIngresos = r2(weeks.reduce((s, w) => s + w.totalIngresos, 0));
      const totalEgresos = r2(weeks.reduce((s, w) => s + w.totalEgresos, 0));

      // ─── 10. Load manual projection if exists ───
      const projection = await db.projection.findUnique({
        where: {
          accountId_year_month: { accountId, year, month },
        },
      });

      return {
        year,
        month,
        weekCount,
        openingBalance,
        closingBalance: runningBalances[runningBalances.length - 1] ?? openingBalance,
        weeks,
        runningBalances,
        totals: {
          ingresos: totalIngresos,
          egresos: totalEgresos,
          neto: r2(totalIngresos - totalEgresos),
          itemCount: allItems.length,
        },
        projection: projection
          ? {
              projectedSales: projection.projectedSales,
              exchangeRate: projection.exchangeRate,
              notes: projection.notes,
            }
          : null,
      };
    }),

  // ——————————————————————————————
  // GET ITEMS for a specific week (detail drill-down)
  // ——————————————————————————————
  getWeekDetail: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        weekIndex: z.number().int().min(0).max(4),
      })
    )
    .query(async ({ input, ctx }) => {
      // Re-use the same query logic but return items for a specific week only
      // For simplicity, call the full projection and filter
      // (In production, you'd optimize this)
      const { year, month, weekIndex } = input;
      const accountId = ctx.accountId;
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

      // Get week date range
      const weekStarts = [1, 8, 15, 22, 29];
      const totalDays = daysInMonth(year, month);
      const startDay = weekStarts[weekIndex];
      const endDay = weekIndex === 4 ? totalDays : weekStarts[weekIndex + 1] - 1;

      const weekStart = new Date(year, month, startDay);
      const weekEnd = new Date(year, month, endDay, 23, 59, 59);

      // Sale payments in this week
      const salePayments = await db.salePayment.findMany({
        where: {
          sale: { accountId },
          accreditationDate: { gte: weekStart, lte: weekEnd },
        },
        include: {
          paymentMethod: { select: { name: true } },
          sale: {
            select: {
              unitPrice: true,
              quantity: true,
              discountPct: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { accreditationDate: "asc" },
      });

      // Purchase payments in this week
      const purchasePayments = await db.purchasePayment.findMany({
        where: {
          purchase: { accountId },
          accreditationDate: { gte: weekStart, lte: weekEnd },
        },
        include: {
          paymentMethod: { select: { name: true } },
          purchase: {
            select: {
              description: true,
              product: { select: { name: true } },
              supplier: { select: { name: true } },
            },
          },
        },
        orderBy: { accreditationDate: "asc" },
      });

      // Manual entries in this week
      const manualEntries = await db.cashFlowEntry.findMany({
        where: {
          accountId,
          entryDate: { gte: weekStart, lte: weekEnd },
        },
        include: {
          bankAccount: { select: { name: true } },
        },
        orderBy: { entryDate: "asc" },
      });

      // Pending sales due in this week
      const unpaidSales = await db.sale.findMany({
        where: {
          accountId,
          dueDate: { gte: weekStart, lte: weekEnd },
          status: { in: ["pending", "partial", "overdue"] },
        },
        include: {
          product: { select: { name: true } },
          payments: { select: { amount: true } },
        },
      });

      // Pending purchases due in this week
      const unpaidPurchases = await db.purchase.findMany({
        where: {
          accountId,
          dueDate: { gte: weekStart, lte: weekEnd },
          status: { in: ["pending", "partial", "overdue"] },
        },
        include: {
          product: { select: { name: true } },
          supplier: { select: { name: true } },
          costCategory: { select: { name: true } },
          payments: { select: { amount: true } },
        },
      });

      type DetailItem = {
        id: string;
        date: Date;
        direction: "ingreso" | "egreso";
        concept: string;
        detail: string;
        amount: number;
        isPending: boolean;
      };

      const items: DetailItem[] = [];

      // Helper for sale total
      function calcSaleTotal2(s: { unitPrice: number; quantity: number; discountPct: number }) {
        return s.unitPrice * s.quantity * (1 - s.discountPct / 100);
      }

      for (const sp of salePayments) {
        const sTotal = r2(calcSaleTotal2(sp.sale));
        items.push({
          id: sp.id,
          date: sp.accreditationDate!,
          direction: "ingreso",
          concept: `Cobro — ${sp.sale.product?.name || "Venta"}`,
          detail: `${sp.paymentMethod.name} | Total venta: $${sTotal}`,
          amount: sp.amount,
          isPending: false,
        });
      }

      for (const pp of purchasePayments) {
        items.push({
          id: pp.id,
          date: pp.accreditationDate!,
          direction: "egreso",
          concept: `Pago — ${pp.purchase.product?.name || pp.purchase.description || "Gasto"}`,
          detail: `${pp.paymentMethod.name}${pp.purchase.supplier ? ` | ${pp.purchase.supplier.name}` : ""}`,
          amount: pp.amount,
          isPending: false,
        });
      }

      for (const entry of manualEntries) {
        items.push({
          id: entry.id,
          date: entry.entryDate,
          direction: entry.movementType === "ingreso" || entry.movementType === "apertura" ? "ingreso" : "egreso",
          concept: entry.concept || "Manual",
          detail: entry.bankAccount.name,
          amount: entry.amount,
          isPending: false,
        });
      }

      for (const sale of unpaidSales) {
        const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0);
        const saleTotal = calcSaleTotal2(sale);
        const remaining = saleTotal - totalPaid;
        if (remaining > 0) {
          items.push({
            id: sale.id,
            date: sale.dueDate!,
            direction: "ingreso",
            concept: `Pendiente cobro — ${sale.product?.name || "Venta"}`,
            detail: `Adeuda $${r2(remaining)} de $${r2(saleTotal)}`,
            amount: r2(remaining),
            isPending: true,
          });
        }
      }

      for (const purchase of unpaidPurchases) {
        const totalPaid = purchase.payments.reduce((s, p) => s + p.amount, 0);
        const subtotal = purchase.unitCost * purchase.quantity * (1 - purchase.discountPct / 100);
        const total = subtotal + purchase.ivaAmount;
        const remaining = total - totalPaid;
        if (remaining > 0) {
          items.push({
            id: purchase.id,
            date: purchase.dueDate!,
            direction: "egreso",
            concept: `Pendiente pago — ${purchase.product?.name || purchase.costCategory.name}`,
            detail: `${purchase.supplier?.name || "Sin proveedor"} | Adeuda $${r2(remaining)}`,
            amount: r2(remaining),
            isPending: true,
          });
        }
      }

      items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        weekIndex,
        label: getWeekLabel(weekIndex),
        dateRange: `${startDay}-${endDay}`,
        items,
        totals: {
          ingresos: r2(items.filter((i) => i.direction === "ingreso").reduce((s, i) => s + i.amount, 0)),
          egresos: r2(items.filter((i) => i.direction === "egreso").reduce((s, i) => s + i.amount, 0)),
        },
      };
    }),

  // ——————————————————————————————
  // UPSERT PROJECTION (manual monthly targets)
  // ——————————————————————————————
  upsertProjection: protectedProcedure
    .input(upsertProjectionSchema)
    .mutation(async ({ input, ctx }) => {
      const { year, month, ...fields } = input;
      const accountId = ctx.accountId;

      return db.projection.upsert({
        where: {
          accountId_year_month: { accountId, year, month },
        },
        create: {
          accountId,
          year,
          month,
          projectedSales: fields.projectedSales ?? null,
          exchangeRate: fields.exchangeRate ?? null,
          notes: fields.notes ?? null,
        },
        update: {
          ...(fields.projectedSales !== undefined && { projectedSales: fields.projectedSales }),
          ...(fields.exchangeRate !== undefined && { exchangeRate: fields.exchangeRate }),
          ...(fields.notes !== undefined && { notes: fields.notes }),
        },
      });
    }),
});
