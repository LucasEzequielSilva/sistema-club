import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { db } from "@/server/db";

// ============================================================
// Helpers
// ============================================================

function calcSaleSubtotal(
  unitPrice: number,
  quantity: number,
  discountPct: number
) {
  return unitPrice * quantity * (1 - discountPct / 100);
}

function calcPurchaseTotal(
  unitCost: number,
  quantity: number,
  discountPct: number,
  ivaAmount: number
) {
  return unitCost * quantity * (1 - discountPct / 100) + ivaAmount;
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function getMonthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ============================================================
// Router
// ============================================================

export const estadosResultadosRouter = router({
  // ——————————————————————————————
  // FINANCIAL STATEMENT (Estado Financiero)
  // Cash-based: uses accreditationDate
  // Saldo Anterior + Cobranzas - Pagos = Superávit/Déficit
  // ——————————————————————————————
  financialStatement: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number().min(0).max(11),
      })
    )
    .query(async ({ input, ctx }) => {
      const { from, to } = getMonthRange(input.year, input.month);

      // Cobranzas: sale payments accredited in this month
      const salePayments = await db.salePayment.findMany({
        where: {
          sale: { accountId: ctx.accountId },
          accreditationDate: { gte: from, lte: to },
        },
        include: {
          paymentMethod: { select: { name: true } },
        },
      });

      // Pagos: purchase payments accredited in this month
      const purchasePayments = await db.purchasePayment.findMany({
        where: {
          purchase: { accountId: ctx.accountId },
          accreditationDate: { gte: from, lte: to },
        },
        include: {
          paymentMethod: { select: { name: true } },
        },
      });

      const totalCobranzas = salePayments.reduce((sum, p) => sum + p.amount, 0);
      const totalPagos = purchasePayments.reduce((sum, p) => sum + p.amount, 0);
      const superavit = totalCobranzas - totalPagos;

      // Group by payment method
      const cobranzasByMethod = new Map<string, { name: string; total: number; count: number }>();
      for (const p of salePayments) {
        const key = p.paymentMethod.name;
        const existing = cobranzasByMethod.get(key);
        if (existing) {
          existing.total += p.amount;
          existing.count++;
        } else {
          cobranzasByMethod.set(key, { name: key, total: p.amount, count: 1 });
        }
      }

      const pagosByMethod = new Map<string, { name: string; total: number; count: number }>();
      for (const p of purchasePayments) {
        const key = p.paymentMethod.name;
        const existing = pagosByMethod.get(key);
        if (existing) {
          existing.total += p.amount;
          existing.count++;
        } else {
          pagosByMethod.set(key, { name: key, total: p.amount, count: 1 });
        }
      }

      return {
        month: MONTH_NAMES[input.month],
        year: input.year,
        totalCobranzas: r2(totalCobranzas),
        totalPagos: r2(totalPagos),
        superavit: r2(superavit),
        countCobranzas: salePayments.length,
        countPagos: purchasePayments.length,
        cobranzasByMethod: Array.from(cobranzasByMethod.values())
          .map((m) => ({ ...m, total: r2(m.total) }))
          .sort((a, b) => b.total - a.total),
        pagosByMethod: Array.from(pagosByMethod.values())
          .map((m) => ({ ...m, total: r2(m.total) }))
          .sort((a, b) => b.total - a.total),
      };
    }),

  // ——————————————————————————————
  // ANNUAL GRID (12-month economic + financial summary)
  // ——————————————————————————————
  annualGrid: protectedProcedure
    .input(
      z.object({
        year: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const account = await db.account.findUnique({
        where: { id: ctx.accountId },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      // Load all sales for the year
      const yearFrom = new Date(input.year, 0, 1);
      const yearTo = new Date(input.year, 11, 31, 23, 59, 59, 999);

      const [sales, purchases, salePayments, purchasePayments] = await Promise.all([
        db.sale.findMany({
          where: { accountId: ctx.accountId, saleDate: { gte: yearFrom, lte: yearTo } },
        }),
        db.purchase.findMany({
          where: { accountId: ctx.accountId, invoiceDate: { gte: yearFrom, lte: yearTo } },
          include: { costCategory: { select: { costType: true } } },
        }),
        db.salePayment.findMany({
          where: {
            sale: { accountId: ctx.accountId },
            accreditationDate: { gte: yearFrom, lte: yearTo },
          },
        }),
        db.purchasePayment.findMany({
          where: {
            purchase: { accountId: ctx.accountId },
            accreditationDate: { gte: yearFrom, lte: yearTo },
          },
        }),
      ]);

      // Build 12-month grid
      const months = Array.from({ length: 12 }, (_, i) => {
        const { from, to } = getMonthRange(input.year, i);

        // ─── Economic (uses transaction dates) ───
        let ventas = 0;
        let costosVariables = 0;
        let costosFijos = 0;
        let impuestos = 0;

        for (const sale of sales) {
          if (sale.saleDate >= from && sale.saleDate <= to) {
            const subtotal = calcSaleSubtotal(sale.unitPrice, sale.quantity, sale.discountPct);
            ventas += subtotal;
            costosVariables += sale.unitCost * sale.quantity;
          }
        }

        for (const purchase of purchases) {
          if (purchase.invoiceDate >= from && purchase.invoiceDate <= to) {
            const total = calcPurchaseTotal(
              purchase.unitCost,
              purchase.quantity,
              purchase.discountPct,
              purchase.ivaAmount
            );
            switch (purchase.costCategory.costType) {
              case "variable":
                costosVariables += total;
                break;
              case "fijo":
                costosFijos += total;
                break;
              case "impuestos":
                impuestos += total;
                break;
            }
          }
        }

        const cm = ventas - costosVariables;
        const ebitda = cm - costosFijos;
        const neto = ebitda - impuestos;

        // ─── Financial (uses accreditation dates) ───
        let cobranzas = 0;
        let pagos = 0;

        for (const sp of salePayments) {
          if (sp.accreditationDate && sp.accreditationDate >= from && sp.accreditationDate <= to) {
            cobranzas += sp.amount;
          }
        }

        for (const pp of purchasePayments) {
          if (pp.accreditationDate && pp.accreditationDate >= from && pp.accreditationDate <= to) {
            pagos += pp.amount;
          }
        }

        const superavit = cobranzas - pagos;

        return {
          month: i,
          name: MONTH_NAMES[i].substring(0, 3),
          fullName: MONTH_NAMES[i],
          economic: {
            ventas: r2(ventas),
            costosVariables: r2(costosVariables),
            cm: r2(cm),
            costosFijos: r2(costosFijos),
            ebitda: r2(ebitda),
            impuestos: r2(impuestos),
            neto: r2(neto),
            margenCM: ventas > 0 ? r2((cm / ventas) * 100) : 0,
          },
          financial: {
            cobranzas: r2(cobranzas),
            pagos: r2(pagos),
            superavit: r2(superavit),
          },
        };
      });

      // Yearly totals
      const totals = {
        economic: {
          ventas: r2(months.reduce((s, m) => s + m.economic.ventas, 0)),
          costosVariables: r2(months.reduce((s, m) => s + m.economic.costosVariables, 0)),
          cm: r2(months.reduce((s, m) => s + m.economic.cm, 0)),
          costosFijos: r2(months.reduce((s, m) => s + m.economic.costosFijos, 0)),
          ebitda: r2(months.reduce((s, m) => s + m.economic.ebitda, 0)),
          impuestos: r2(months.reduce((s, m) => s + m.economic.impuestos, 0)),
          neto: r2(months.reduce((s, m) => s + m.economic.neto, 0)),
          margenCM: 0,
        },
        financial: {
          cobranzas: r2(months.reduce((s, m) => s + m.financial.cobranzas, 0)),
          pagos: r2(months.reduce((s, m) => s + m.financial.pagos, 0)),
          superavit: r2(months.reduce((s, m) => s + m.financial.superavit, 0)),
        },
      };
      totals.economic.margenCM =
        totals.economic.ventas > 0
          ? r2((totals.economic.cm / totals.economic.ventas) * 100)
          : 0;

      return { year: input.year, months, totals };
    }),
});
