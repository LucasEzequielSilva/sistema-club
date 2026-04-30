import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { db } from "@/server/db";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  createCashFlowEntrySchema,
} from "@/lib/validators/cuentas";

// ============================================================
// Helpers
// ============================================================

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

// ============================================================
// Router
// ============================================================

export const cuentasRouter = router({
  // ——————————————————————————————
  // LIST BANK ACCOUNTS (with computed balance)
  // ——————————————————————————————
  listAccounts: protectedProcedure
    .input(
      z
        .object({
          includeInactive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const accounts = await db.bankAccount.findMany({
        where: {
          accountId: ctx.accountId,
          ...(!input?.includeInactive && { isActive: true }),
        },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { cashFlowEntries: true } },
        },
      });

      // Calculate current balance for each account
      const enriched = await Promise.all(
        accounts.map(async (acc) => {
          const entries = await db.cashFlowEntry.findMany({
            where: { bankAccountId: acc.id },
          });

          let balance = acc.initialBalance;
          for (const entry of entries) {
            if (entry.movementType === "ingreso" || entry.movementType === "apertura") {
              balance += entry.amount;
            } else if (entry.movementType === "egreso") {
              balance -= entry.amount;
            }
            // transferencia: handled as egreso from source + ingreso in dest
          }

          return {
            ...acc,
            currentBalance: r2(balance),
            entryCount: acc._count.cashFlowEntries,
          };
        })
      );

      return enriched;
    }),

  // ——————————————————————————————
  // CREATE BANK ACCOUNT
  // ——————————————————————————————
  createAccount: protectedProcedure
    .input(createBankAccountSchema)
    .mutation(async ({ input, ctx }) => {
      const account = await db.bankAccount.create({
        data: {
          accountId: ctx.accountId,
          name: input.name,
          initialBalance: input.initialBalance,
          balanceDate: input.balanceDate || null,
        },
      });
      return account;
    }),

  // ——————————————————————————————
  // UPDATE BANK ACCOUNT
  // ——————————————————————————————
  updateAccount: protectedProcedure
    .input(updateBankAccountSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;
      const existing = await db.bankAccount.findFirst({
        where: { id, accountId: ctx.accountId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }

      return db.bankAccount.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.initialBalance !== undefined && { initialBalance: fields.initialBalance }),
          ...(fields.balanceDate !== undefined && { balanceDate: fields.balanceDate || null }),
          ...(fields.isActive !== undefined && { isActive: fields.isActive }),
        },
      });
    }),

  // ——————————————————————————————
  // DELETE BANK ACCOUNT (only if no entries)
  // ——————————————————————————————
  deleteAccount: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const account = await db.bankAccount.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
        include: { _count: { select: { cashFlowEntries: true } } },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });
      }
      if (account._count.cashFlowEntries > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No se puede eliminar una cuenta con movimientos. Desactivala en su lugar.",
        });
      }

      await db.bankAccount.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ——————————————————————————————
  // GET CASH FLOW (movements for a bank account in a period)
  // Combines CashFlowEntry manual entries + auto-derived from payments
  // ——————————————————————————————
  getCashFlow: protectedProcedure
    .input(
      z.object({
        bankAccountId: z.string().optional(), // if not provided, all accounts
        dateFrom: z.coerce.date(),
        dateTo: z.coerce.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Get manual cash flow entries
      const entries = await db.cashFlowEntry.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input.bankAccountId && { bankAccountId: input.bankAccountId }),
          entryDate: { gte: input.dateFrom, lte: input.dateTo },
        },
        include: {
          bankAccount: { select: { id: true, name: true } },
        },
        orderBy: { entryDate: "desc" },
      });

      // Also get sale payments (cobranzas) accredited in period
      const salePayments = await db.salePayment.findMany({
        where: {
          sale: { accountId: ctx.accountId },
          accreditationDate: { gte: input.dateFrom, lte: input.dateTo },
        },
        include: {
          paymentMethod: { select: { name: true } },
          sale: {
            select: {
              id: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { accreditationDate: "desc" },
      });

      // Get purchase payments (pagos) accredited in period
      const purchasePayments = await db.purchasePayment.findMany({
        where: {
          purchase: { accountId: ctx.accountId },
          accreditationDate: { gte: input.dateFrom, lte: input.dateTo },
        },
        include: {
          paymentMethod: { select: { name: true } },
          purchase: {
            select: {
              id: true,
              description: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { accreditationDate: "desc" },
      });

      // Build unified flow items
      type FlowItem = {
        id: string;
        date: Date;
        type: "ingreso" | "egreso" | "manual";
        concept: string;
        method: string;
        amount: number;
        source: "venta" | "compra" | "manual";
      };

      const flowItems: FlowItem[] = [];

      // Sale payments as ingresos
      for (const sp of salePayments) {
        flowItems.push({
          id: sp.id,
          date: sp.accreditationDate!,
          type: "ingreso",
          concept: `Cobro venta — ${sp.sale.product?.name || "Producto"}`,
          method: sp.paymentMethod.name,
          amount: sp.amount,
          source: "venta",
        });
      }

      // Purchase payments as egresos
      for (const pp of purchasePayments) {
        const conceptName =
          pp.purchase.product?.name || pp.purchase.description || "Gasto";
        flowItems.push({
          id: pp.id,
          date: pp.accreditationDate!,
          type: "egreso",
          concept: `Pago compra — ${conceptName}`,
          method: pp.paymentMethod.name,
          amount: pp.amount,
          source: "compra",
        });
      }

      // Manual entries
      for (const entry of entries) {
        flowItems.push({
          id: entry.id,
          date: entry.entryDate,
          type: entry.movementType === "ingreso" ? "ingreso" : "egreso",
          concept: entry.concept || `Movimiento manual (${entry.movementType})`,
          method: entry.bankAccount.name,
          amount: entry.amount,
          source: "manual",
        });
      }

      // Sort by date desc
      flowItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Totals
      const totalIngresos = flowItems
        .filter((f) => f.type === "ingreso")
        .reduce((sum, f) => sum + f.amount, 0);
      const totalEgresos = flowItems
        .filter((f) => f.type === "egreso")
        .reduce((sum, f) => sum + f.amount, 0);

      return {
        items: flowItems,
        totals: {
          ingresos: r2(totalIngresos),
          egresos: r2(totalEgresos),
          neto: r2(totalIngresos - totalEgresos),
          count: flowItems.length,
        },
      };
    }),

  // ——————————————————————————————
  // CREATE MANUAL CASH FLOW ENTRY
  // ——————————————————————————————
  createEntry: protectedProcedure
    .input(createCashFlowEntrySchema)
    .mutation(async ({ input, ctx }) => {
      // Verify bank account exists and belongs to this account
      const account = await db.bankAccount.findFirst({
        where: { id: input.bankAccountId, accountId: ctx.accountId },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta bancaria no encontrada" });
      }

      return db.cashFlowEntry.create({
        data: {
          accountId: ctx.accountId,
          bankAccountId: input.bankAccountId,
          entryDate: input.entryDate,
          movementType: input.movementType,
          concept: input.concept,
          amount: input.amount,
          notes: input.notes || null,
        },
      });
    }),

  // ——————————————————————————————
  // DELETE MANUAL CASH FLOW ENTRY (only manual ones)
  // ——————————————————————————————
  deleteEntry: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const entry = await db.cashFlowEntry.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Movimiento no encontrado" });
      }
      // Only allow deletion of manual entries (no relatedSaleId/relatedPurchaseId)
      if (entry.relatedSaleId || entry.relatedPurchaseId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No se puede eliminar un movimiento automático. Eliminá la venta o compra asociada.",
        });
      }

      await db.cashFlowEntry.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ——————————————————————————————
  // GET BALANCES SUMMARY (all accounts)
  // ——————————————————————————————
  getBalancesSummary: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await db.bankAccount.findMany({
      where: { accountId: ctx.accountId, isActive: true },
      include: { cashFlowEntries: true },
    });

    // Also need to compute from sale/purchase payments for auto-derived
    // For now, balance = initialBalance + manual entries
    // (Full auto-derived balance requires assigning payments to bank accounts,
    // which we don't have yet — deferred to future iteration)
    const balances = accounts.map((acc) => {
      let balance = acc.initialBalance;
      for (const entry of acc.cashFlowEntries) {
        if (entry.movementType === "ingreso" || entry.movementType === "apertura") {
          balance += entry.amount;
        } else if (entry.movementType === "egreso") {
          balance -= entry.amount;
        }
      }

      return {
        id: acc.id,
        name: acc.name,
        initialBalance: acc.initialBalance,
        currentBalance: r2(balance),
        entryCount: acc.cashFlowEntries.length,
      };
    });

    const totalBalance = balances.reduce((sum, b) => sum + b.currentBalance, 0);

    return {
      accounts: balances,
      totalBalance: r2(totalBalance),
    };
  }),
});
