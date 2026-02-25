import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../init";
import { db } from "@/server/db";
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  addPurchasePaymentSchema,
} from "@/lib/validators/compras";

// ============================================================
// Helpers
// ============================================================

/** Derive purchase status from payments vs total */
function derivePurchaseStatus(
  totalPaid: number,
  purchaseTotal: number,
  dueDate: Date | null | undefined,
  currentStatus: string
): string {
  if (totalPaid >= purchaseTotal) return "paid";
  if (dueDate && new Date(dueDate) < new Date() && totalPaid < purchaseTotal) {
    return "overdue";
  }
  if (totalPaid > 0) return "partial";
  return "pending";
}

/** Compute purchase derived fields */
function calcPurchaseDerived(
  unitCost: number,
  quantity: number,
  discountPct: number,
  ivaAmount: number
) {
  const subtotal = unitCost * quantity * (1 - discountPct / 100);
  const total = subtotal + ivaAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================
// Router
// ============================================================

export const comprasRouter = router({
  // ——————————————————————————————
  // LIST (with filters, computed fields)
  // ——————————————————————————————
  list: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        search: z.string().optional(),
        supplierId: z.string().optional(),
        productId: z.string().optional(),
        costCategoryId: z.string().optional(),
        status: z.string().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const purchases = await db.purchase.findMany({
        where: {
          accountId: input.accountId,
          ...(input.supplierId && { supplierId: input.supplierId }),
          ...(input.productId && { productId: input.productId }),
          ...(input.costCategoryId && {
            costCategoryId: input.costCategoryId,
          }),
          ...(input.status && { status: input.status }),
          ...(input.dateFrom || input.dateTo
            ? {
                invoiceDate: {
                  ...(input.dateFrom && { gte: input.dateFrom }),
                  ...(input.dateTo && { lte: input.dateTo }),
                },
              }
            : {}),
          ...(input.search
            ? {
                OR: [
                  {
                    description: {
                      contains: input.search,
                    },
                  },
                  { invoiceNumber: { contains: input.search } },
                ],
              }
            : {}),
        },
        orderBy: { invoiceDate: "desc" },
        include: {
          supplier: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
          costCategory: { select: { id: true, name: true, costType: true } },
          payments: {
            include: {
              paymentMethod: { select: { name: true } },
            },
          },
        },
      });

      // Enrich with computed fields
      const enriched = purchases.map((purchase) => {
        const derived = calcPurchaseDerived(
          purchase.unitCost,
          purchase.quantity,
          purchase.discountPct,
          purchase.ivaAmount
        );
        const totalPaid = purchase.payments.reduce(
          (sum, p) => sum + p.amount,
          0
        );
        const pendingAmount = derived.total - totalPaid;

        return {
          ...purchase,
          ...derived,
          totalPaid: Math.round(totalPaid * 100) / 100,
          pendingAmount: Math.round(Math.max(pendingAmount, 0) * 100) / 100,
        };
      });

      return enriched;
    }),

  // ——————————————————————————————
  // GET SUMMARY (totals for footer)
  // ——————————————————————————————
  getSummary: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const dateFilter =
        input.dateFrom || input.dateTo
          ? {
              invoiceDate: {
                ...(input.dateFrom && { gte: input.dateFrom }),
                ...(input.dateTo && { lte: input.dateTo }),
              },
            }
          : {};

      const purchases = await db.purchase.findMany({
        where: { accountId: input.accountId, ...dateFilter },
        include: {
          payments: true,
          costCategory: { select: { costType: true } },
        },
      });

      let totalPurchases = 0;
      let totalPaid = 0;
      let countPurchases = purchases.length;
      let totalVariable = 0;
      let totalFijo = 0;
      let totalImpuestos = 0;

      for (const purchase of purchases) {
        const derived = calcPurchaseDerived(
          purchase.unitCost,
          purchase.quantity,
          purchase.discountPct,
          purchase.ivaAmount
        );
        totalPurchases += derived.total;
        totalPaid += purchase.payments.reduce((sum, p) => sum + p.amount, 0);

        // Classify by cost type
        switch (purchase.costCategory.costType) {
          case "variable":
            totalVariable += derived.total;
            break;
          case "fijo":
            totalFijo += derived.total;
            break;
          case "impuestos":
            totalImpuestos += derived.total;
            break;
        }
      }

      return {
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalPending: Math.round((totalPurchases - totalPaid) * 100) / 100,
        countPurchases,
        totalVariable: Math.round(totalVariable * 100) / 100,
        totalFijo: Math.round(totalFijo * 100) / 100,
        totalImpuestos: Math.round(totalImpuestos * 100) / 100,
      };
    }),

  // ——————————————————————————————
  // GET BY ID (full detail)
  // ——————————————————————————————
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const purchase = await db.purchase.findUnique({
        where: { id: input.id },
        include: {
          account: {
            select: { taxStatus: true, ivaRate: true },
          },
          supplier: { select: { id: true, name: true } },
          product: {
            select: { id: true, name: true, unit: true },
          },
          costCategory: {
            select: { id: true, name: true, costType: true },
          },
          payments: {
            include: {
              paymentMethod: {
                select: { id: true, name: true, accreditationDays: true },
              },
            },
            orderBy: { paymentDate: "asc" },
          },
        },
      });

      if (!purchase) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compra no encontrada",
        });
      }

      const derived = calcPurchaseDerived(
        purchase.unitCost,
        purchase.quantity,
        purchase.discountPct,
        purchase.ivaAmount
      );
      const totalPaid = purchase.payments.reduce(
        (sum, p) => sum + p.amount,
        0
      );
      const pendingAmount = derived.total - totalPaid;

      return {
        ...purchase,
        ...derived,
        totalPaid: Math.round(totalPaid * 100) / 100,
        pendingAmount: Math.round(Math.max(pendingAmount, 0) * 100) / 100,
      };
    }),

  // ——————————————————————————————
  // CREATE (with stock movement + inline payments)
  // ——————————————————————————————
  create: publicProcedure
    .input(createPurchaseSchema)
    .mutation(async ({ input }) => {
      // Validate product exists if provided
      let product = null;
      if (input.productId) {
        product = await db.product.findUnique({
          where: { id: input.productId },
        });
        if (!product) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Producto no encontrado",
          });
        }
      }

      // Validate supplier exists if provided
      if (input.supplierId) {
        const supplier = await db.supplier.findUnique({
          where: { id: input.supplierId },
        });
        if (!supplier) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Proveedor no encontrado",
          });
        }
      }

      // Validate cost category
      const costCategory = await db.costCategory.findUnique({
        where: { id: input.costCategoryId },
      });
      if (!costCategory) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clasificación de costo no encontrada",
        });
      }

      // Calculate total to derive status
      const derived = calcPurchaseDerived(
        input.unitCost,
        input.quantity,
        input.discountPct,
        input.ivaAmount
      );

      const totalPaid = input.payments.reduce((sum, p) => sum + p.amount, 0);
      const status = derivePurchaseStatus(
        totalPaid,
        derived.total,
        input.dueDate,
        "pending"
      );

      // Create purchase
      const purchase = await db.purchase.create({
        data: {
          accountId: input.accountId,
          supplierId: input.supplierId || null,
          productId: input.productId || null,
          costCategoryId: input.costCategoryId,
          invoiceDate: input.invoiceDate,
          description: input.description || null,
          unitCost: input.unitCost,
          quantity: input.quantity,
          discountPct: input.discountPct,
          ivaAmount: input.ivaAmount,
          invoiceNumber: input.invoiceNumber || null,
          dueDate: input.dueDate || null,
          notes: input.notes || null,
          status,
        },
      });

      // Create inline payments (with accreditation date calculation)
      if (input.payments.length > 0) {
        for (const payment of input.payments) {
          const method = await db.paymentMethod.findUnique({
            where: { id: payment.paymentMethodId },
          });
          const accreditationDate = method
            ? addDays(payment.paymentDate, method.accreditationDays)
            : payment.paymentDate;

          await db.purchasePayment.create({
            data: {
              purchaseId: purchase.id,
              paymentMethodId: payment.paymentMethodId,
              amount: payment.amount,
              paymentDate: payment.paymentDate,
              accreditationDate,
            },
          });
        }
      }

      // Create stock movement (positive quantity for purchase) — only if product
      if (input.productId) {
        await db.stockMovement.create({
          data: {
            accountId: input.accountId,
            productId: input.productId,
            movementType: "purchase",
            quantity: input.quantity, // positive for purchase
            unitCost: input.unitCost,
            referenceType: "purchase",
            referenceId: purchase.id,
            movementDate: input.invoiceDate,
            notes: `Compra #${purchase.id.slice(-6)}`,
          },
        });

        // Update product's lastCostUpdate
        await db.product.update({
          where: { id: input.productId },
          data: { lastCostUpdate: new Date() },
        });
      }

      return purchase;
    }),

  // ——————————————————————————————
  // UPDATE (no stock recalc — only metadata fields)
  // ——————————————————————————————
  update: publicProcedure
    .input(updatePurchaseSchema)
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;

      const current = await db.purchase.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compra no encontrada",
        });
      }

      // Recalculate status if cost/qty/discount/iva/dueDate changed
      const newUnitCost = fields.unitCost ?? current.unitCost;
      const newQuantity = fields.quantity ?? current.quantity;
      const newDiscountPct = fields.discountPct ?? current.discountPct;
      const newIvaAmount = fields.ivaAmount ?? current.ivaAmount;
      const newDueDate =
        fields.dueDate !== undefined ? fields.dueDate : current.dueDate;

      const derived = calcPurchaseDerived(
        newUnitCost,
        newQuantity,
        newDiscountPct,
        newIvaAmount
      );

      const totalPaid = current.payments.reduce(
        (sum, p) => sum + p.amount,
        0
      );
      const newStatus = derivePurchaseStatus(
        totalPaid,
        derived.total,
        newDueDate,
        current.status
      );

      return db.purchase.update({
        where: { id },
        data: {
          ...(fields.supplierId !== undefined && {
            supplierId: fields.supplierId || null,
          }),
          ...(fields.costCategoryId !== undefined && {
            costCategoryId: fields.costCategoryId,
          }),
          ...(fields.invoiceDate !== undefined && {
            invoiceDate: fields.invoiceDate,
          }),
          ...(fields.description !== undefined && {
            description: fields.description || null,
          }),
          ...(fields.unitCost !== undefined && { unitCost: fields.unitCost }),
          ...(fields.quantity !== undefined && { quantity: fields.quantity }),
          ...(fields.discountPct !== undefined && {
            discountPct: fields.discountPct,
          }),
          ...(fields.ivaAmount !== undefined && {
            ivaAmount: fields.ivaAmount,
          }),
          ...(fields.invoiceNumber !== undefined && {
            invoiceNumber: fields.invoiceNumber || null,
          }),
          ...(fields.dueDate !== undefined && {
            dueDate: fields.dueDate || null,
          }),
          ...(fields.notes !== undefined && { notes: fields.notes || null }),
          status: newStatus,
        },
      });
    }),

  // ——————————————————————————————
  // DELETE (reverse stock movement)
  // ——————————————————————————————
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const purchase = await db.purchase.findUnique({
        where: { id: input.id },
      });
      if (!purchase) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compra no encontrada",
        });
      }

      // Delete stock movement linked to this purchase
      await db.stockMovement.deleteMany({
        where: { referenceId: input.id, referenceType: "purchase" },
      });

      // Delete payments
      await db.purchasePayment.deleteMany({
        where: { purchaseId: input.id },
      });

      // Delete the purchase
      await db.purchase.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ——————————————————————————————
  // ADD PAYMENT (post-creation partial payment)
  // ——————————————————————————————
  addPayment: publicProcedure
    .input(addPurchasePaymentSchema)
    .mutation(async ({ input }) => {
      const purchase = await db.purchase.findUnique({
        where: { id: input.purchaseId },
        include: { payments: true },
      });
      if (!purchase) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compra no encontrada",
        });
      }

      // Get payment method for accreditation
      const method = await db.paymentMethod.findUnique({
        where: { id: input.paymentMethodId },
      });
      if (!method) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Método de pago no encontrado",
        });
      }

      const accreditationDate = addDays(
        input.paymentDate,
        method.accreditationDays
      );

      const payment = await db.purchasePayment.create({
        data: {
          purchaseId: input.purchaseId,
          paymentMethodId: input.paymentMethodId,
          amount: input.amount,
          paymentDate: input.paymentDate,
          accreditationDate,
          notes: input.notes || null,
        },
      });

      // Recalculate and update purchase status
      const allPayments = [...purchase.payments, { amount: input.amount }];
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

      const derived = calcPurchaseDerived(
        purchase.unitCost,
        purchase.quantity,
        purchase.discountPct,
        purchase.ivaAmount
      );

      const newStatus = derivePurchaseStatus(
        totalPaid,
        derived.total,
        purchase.dueDate,
        purchase.status
      );

      await db.purchase.update({
        where: { id: input.purchaseId },
        data: { status: newStatus },
      });

      return payment;
    }),

  // ——————————————————————————————
  // REMOVE PAYMENT
  // ——————————————————————————————
  removePayment: publicProcedure
    .input(z.object({ paymentId: z.string() }))
    .mutation(async ({ input }) => {
      const payment = await db.purchasePayment.findUnique({
        where: { id: input.paymentId },
        include: {
          purchase: {
            include: { payments: true },
          },
        },
      });

      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pago no encontrado",
        });
      }

      // Delete the payment
      await db.purchasePayment.delete({ where: { id: input.paymentId } });

      // Recalculate status
      const remainingPayments = payment.purchase.payments.filter(
        (p) => p.id !== input.paymentId
      );
      const totalPaid = remainingPayments.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      const derived = calcPurchaseDerived(
        payment.purchase.unitCost,
        payment.purchase.quantity,
        payment.purchase.discountPct,
        payment.purchase.ivaAmount
      );

      const newStatus = derivePurchaseStatus(
        totalPaid,
        derived.total,
        payment.purchase.dueDate,
        payment.purchase.status
      );

      await db.purchase.update({
        where: { id: payment.purchase.id },
        data: { status: newStatus },
      });

      return { success: true };
    }),
});
