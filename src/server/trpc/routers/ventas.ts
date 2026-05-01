import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { db } from "@/server/db";
import {
  createSaleSchema,
  updateSaleSchema,
  addSalePaymentSchema,
} from "@/lib/validators/ventas";
import { isDeposit, addDepositFlag, stripDepositFlag } from "@/lib/sale-flags";

// ============================================================
// Helpers
// ============================================================

function calcUnitCost(product: {
  acquisitionCost: number;
  rawMaterialCost: number;
  laborCost: number;
  packagingCost: number;
}) {
  return (
    product.acquisitionCost +
    product.rawMaterialCost +
    product.laborCost +
    product.packagingCost
  );
}

/** Derive sale status from payments vs total */
function deriveSaleStatus(
  totalPaid: number,
  saleTotal: number,
  dueDate: Date | null | undefined
): string {
  if (totalPaid >= saleTotal) return "paid";
  if (dueDate && new Date(dueDate) < new Date() && totalPaid < saleTotal) {
    return "overdue";
  }
  if (totalPaid > 0) return "partial";
  return "pending";
}

/** Compute sale derived fields */
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

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    ivaAmount: Math.round(ivaAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
    variableCostTotal: Math.round(variableCostTotal * 100) / 100,
    contributionMargin: Math.round(contributionMargin * 100) / 100,
    marginPct: Math.round(marginPct * 100) / 100,
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function resolvePaymentRouting(input: {
  accountId: string;
  paymentMethodId: string;
  paymentChannelId?: string | null;
  paymentAccountId?: string | null;
}) {
  const method = await db.paymentMethod.findFirst({
    where: {
      id: input.paymentMethodId,
      accountId: input.accountId,
    },
  });

  if (!method) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Método de pago no encontrado",
    });
  }

  let paymentChannelId: string | null = null;
  let paymentAccountId: string | null = input.paymentAccountId ?? null;
  let accreditationDays = method.accreditationDays;

  if (input.paymentChannelId) {
    const channel = await db.paymentChannel.findFirst({
      where: {
        id: input.paymentChannelId,
        accountId: input.accountId,
      },
    });

    if (!channel) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Canal de pago no encontrado",
      });
    }

    if (channel.paymentMethodId && channel.paymentMethodId !== method.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "El canal no corresponde al método de pago seleccionado",
      });
    }

    paymentChannelId = channel.id;
    paymentAccountId = paymentAccountId ?? channel.paymentAccountId;
    accreditationDays = channel.accreditationDays;
  } else {
    const defaultChannel = await db.paymentChannel.findFirst({
      where: {
        accountId: input.accountId,
        paymentMethodId: method.id,
        isActive: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    if (defaultChannel) {
      paymentChannelId = defaultChannel.id;
      paymentAccountId = paymentAccountId ?? defaultChannel.paymentAccountId;
      accreditationDays = defaultChannel.accreditationDays;
    }
  }

  if (paymentAccountId) {
    const account = await db.paymentAccount.findFirst({
      where: {
        id: paymentAccountId,
        accountId: input.accountId,
      },
      select: { id: true },
    });
    if (!account) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cuenta receptora no encontrada",
      });
    }
  } else {
    const defaultAccount = await db.paymentAccount.findFirst({
      where: {
        accountId: input.accountId,
        isActive: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    paymentAccountId = defaultAccount?.id ?? null;
  }

  return {
    paymentMethodId: method.id,
    paymentChannelId,
    paymentAccountId,
    accreditationDays,
  };
}

// ============================================================
// Router
// ============================================================

export const ventasRouter = router({
  // ——————————————————————————————
  // LIST (with filters, computed fields, pagination-ready)
  // ——————————————————————————————
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          productId: z.string().optional(),
          clientId: z.string().optional(),
          status: z.string().optional(), // pending | partial | paid | overdue
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
          invoicedOnly: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const account = await db.account.findUnique({
        where: { id: ctx.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta no encontrada",
        });
      }

      const sales = await db.sale.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input?.productId && { productId: input.productId }),
          ...(input?.clientId && { clientId: input.clientId }),
          ...(input?.status && { status: input.status }),
          ...(input?.invoicedOnly && { invoiced: true }),
          ...(input?.dateFrom || input?.dateTo
            ? {
                saleDate: {
                  ...(input?.dateFrom && { gte: input.dateFrom }),
                  ...(input?.dateTo && { lte: input.dateTo }),
                },
              }
            : {}),
        },
        orderBy: { saleDate: "desc" },
        include: {
          product: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          priceList: { select: { id: true, name: true } },
          payments: {
            include: {
              paymentMethod: { select: { id: true, name: true } },
              paymentAccount: { select: { id: true, name: true } },
              paymentChannel: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Enrich with computed fields
      const enriched = sales.map((sale) => {
        const derived = calcSaleDerived(
          sale.unitPrice,
          sale.quantity,
          sale.discountPct,
          sale.unitCost,
          account
        );
        const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
        const pendingAmount = derived.total - totalPaid;

        return {
          ...sale,
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
  getSummary: protectedProcedure
    .input(
      z
        .object({
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const account = await db.account.findUnique({
        where: { id: ctx.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta no encontrada",
        });
      }

      const dateFilter =
        input?.dateFrom || input?.dateTo
          ? {
              saleDate: {
                ...(input?.dateFrom && { gte: input.dateFrom }),
                ...(input?.dateTo && { lte: input.dateTo }),
              },
            }
          : {};

      const sales = await db.sale.findMany({
        where: { accountId: ctx.accountId, ...dateFilter },
        include: { payments: true },
      });

      let totalSales = 0;
      let totalCM = 0;
      let totalPaid = 0;
      const countSales = sales.length;
      let countInvoiced = 0;

      for (const sale of sales) {
        const derived = calcSaleDerived(
          sale.unitPrice,
          sale.quantity,
          sale.discountPct,
          sale.unitCost,
          account
        );
        totalSales += derived.total;
        totalCM += derived.contributionMargin;
        totalPaid += sale.payments.reduce((sum, p) => sum + p.amount, 0);
        if (sale.invoiced) countInvoiced++;
      }

      return {
        totalSales: Math.round(totalSales * 100) / 100,
        totalCM: Math.round(totalCM * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalPending: Math.round((totalSales - totalPaid) * 100) / 100,
        countSales,
        countInvoiced,
        avgTicket:
          countSales > 0
            ? Math.round((totalSales / countSales) * 100) / 100
            : 0,
      };
    }),

  // ——————————————————————————————
  // GET BY ID (full detail)
  // ——————————————————————————————
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const sale = await db.sale.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
        include: {
          account: {
            select: { taxStatus: true, ivaRate: true, includeIvaInCost: true },
          },
          product: {
            select: { id: true, name: true, unit: true },
          },
          category: { select: { id: true, name: true } },
          priceList: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          seller: { select: { id: true, displayName: true } },
          payments: {
            include: {
              paymentMethod: {
                select: { id: true, name: true, accreditationDays: true },
              },
              paymentAccount: { select: { id: true, name: true } },
              paymentChannel: { select: { id: true, name: true } },
            },
            orderBy: { paymentDate: "asc" },
          },
        },
      });

      if (!sale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Venta no encontrada",
        });
      }

      const derived = calcSaleDerived(
        sale.unitPrice,
        sale.quantity,
        sale.discountPct,
        sale.unitCost,
        sale.account
      );
      const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      const pendingAmount = derived.total - totalPaid;

      return {
        ...sale,
        ...derived,
        totalPaid: Math.round(totalPaid * 100) / 100,
        pendingAmount: Math.round(Math.max(pendingAmount, 0) * 100) / 100,
      };
    }),

  // ——————————————————————————————
  // GET PRODUCT PRICE (for auto-filling unit_price from price list)
  // ——————————————————————————————
  getProductPrice: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        priceListId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const product = await db.product.findFirst({
        where: { id: input.productId, accountId: ctx.accountId },
      });
      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      const account = await db.account.findUnique({
        where: { id: ctx.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta no encontrada",
        });
      }

      const priceListItem = await db.priceListItem.findUnique({
        where: {
          priceListId_productId: {
            priceListId: input.priceListId,
            productId: input.productId,
          },
        },
      });

      const historicalCost = await db.stockMovement.findFirst({
        where: {
          accountId: ctx.accountId,
          productId: input.productId,
          unitCost: { not: null },
          movementDate: { lte: new Date() },
        },
        orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
        select: { unitCost: true },
      });

      const unitCost = historicalCost?.unitCost ?? calcUnitCost(product);
      const markupPct = priceListItem?.markupPct ?? 0;
      const salePrice = unitCost * (1 + markupPct / 100);

      return {
        unitCost: Math.round(unitCost * 100) / 100,
        markupPct,
        salePrice: Math.round(salePrice * 100) / 100,
        categoryId: product.categoryId,
        hasListPrice: !!priceListItem && priceListItem.markupPct > 0,
      };
    }),

  // ——————————————————————————————
  // CREATE (with stock movement + inline payments)
  // ——————————————————————————————
  create: protectedProcedure
    .input(createSaleSchema)
    .mutation(async ({ input, ctx }) => {
      // Get product to snapshot unitCost (and validate it belongs to this account)
      const product = await db.product.findFirst({
        where: { id: input.productId, accountId: ctx.accountId },
      });
      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      const account = await db.account.findUnique({
        where: { id: ctx.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta no encontrada",
        });
      }

      const historicalCost = await db.stockMovement.findFirst({
        where: {
          accountId: ctx.accountId,
          productId: input.productId,
          unitCost: { not: null },
          movementDate: { lte: input.saleDate },
        },
        orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
        select: { unitCost: true },
      });

      const unitCost = historicalCost?.unitCost ?? calcUnitCost(product);

      // Calculate total to derive status
      const derived = calcSaleDerived(
        input.unitPrice,
        input.quantity,
        input.discountPct,
        unitCost,
        account
      );

      const totalPaid = input.payments.reduce((sum, p) => sum + p.amount, 0);
      const status = deriveSaleStatus(
        totalPaid,
        derived.total,
        input.dueDate
      );

      // Create sale
      const sale = await db.sale.create({
        data: {
          accountId: ctx.accountId,
          productId: input.productId,
          categoryId: input.categoryId,
          priceListId: input.priceListId || null,
          clientId: input.clientId || null,
          sellerId: input.sellerId || null,
          saleDate: input.saleDate,
          origin: input.origin,
          unitPrice: input.unitPrice,
          unitCost,
          quantity: input.quantity,
          discountPct: input.discountPct,
          invoiced: input.invoiced,
          invoiceNumber: input.invoiceNumber || null,
          dueDate: input.dueDate || null,
          notes: input.notes || null,
          status,
        },
      });

      // Create inline payments (with accreditation date calculation)
      if (input.payments.length > 0) {
        for (const payment of input.payments) {
          const routing = await resolvePaymentRouting({
            accountId: ctx.accountId,
            paymentMethodId: payment.paymentMethodId,
            paymentChannelId: payment.paymentChannelId,
            paymentAccountId: payment.paymentAccountId,
          });
          const accreditationDate = addDays(payment.paymentDate, routing.accreditationDays);

          await db.salePayment.create({
            data: {
              saleId: sale.id,
              paymentMethodId: routing.paymentMethodId,
              paymentChannelId: routing.paymentChannelId,
              paymentAccountId: routing.paymentAccountId,
              amount: payment.amount,
              paymentDate: payment.paymentDate,
              accreditationDate,
            },
          });
        }
      }

      // Create stock movement (negative quantity for sale)
      await db.stockMovement.create({
        data: {
          accountId: ctx.accountId,
          productId: input.productId,
          movementType: "sale",
          quantity: -input.quantity,
          unitCost,
          referenceType: "sale",
          referenceId: sale.id,
          movementDate: input.saleDate,
          notes: `Venta #${sale.id.slice(-6)}`,
        },
      });

      return sale;
    }),

  // ——————————————————————————————
  // UPDATE (no stock recalc — only metadata fields)
  // ——————————————————————————————
  update: protectedProcedure
    .input(updateSaleSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;

      const current = await db.sale.findFirst({
        where: { id, accountId: ctx.accountId },
        include: { payments: true },
      });
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Venta no encontrada",
        });
      }

      const account = await db.account.findUnique({
        where: { id: current.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta no encontrada",
        });
      }

      // Recalculate status if price/qty/discount/dueDate changed
      const newUnitPrice = fields.unitPrice ?? current.unitPrice;
      const newQuantity = fields.quantity ?? current.quantity;
      const newDiscountPct = fields.discountPct ?? current.discountPct;
      const newDueDate =
        fields.dueDate !== undefined ? fields.dueDate : current.dueDate;
      const newSaleDate = fields.saleDate ?? current.saleDate;

      let recalculatedUnitCost = current.unitCost;
      if (fields.saleDate !== undefined) {
        const historicalCost = await db.stockMovement.findFirst({
          where: {
            accountId: current.accountId,
            productId: current.productId,
            unitCost: { not: null },
            movementDate: { lte: newSaleDate },
          },
          orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
          select: { unitCost: true },
        });
        recalculatedUnitCost = historicalCost?.unitCost ?? current.unitCost;
      }

      const derived = calcSaleDerived(
        newUnitPrice,
        newQuantity,
        newDiscountPct,
        recalculatedUnitCost,
        account
      );

      const totalPaid = current.payments.reduce(
        (sum, p) => sum + p.amount,
        0
      );
      const newStatus = deriveSaleStatus(
        totalPaid,
        derived.total,
        newDueDate
      );

      return db.sale.update({
        where: { id },
        data: {
          ...(fields.priceListId !== undefined && {
            priceListId: fields.priceListId || null,
          }),
          ...(fields.clientId !== undefined && {
            clientId: fields.clientId || null,
          }),
          ...(fields.saleDate !== undefined && { saleDate: fields.saleDate }),
          ...(fields.saleDate !== undefined && { unitCost: recalculatedUnitCost }),
          ...(fields.origin !== undefined && { origin: fields.origin }),
          ...(fields.unitPrice !== undefined && {
            unitPrice: fields.unitPrice,
          }),
          ...(fields.quantity !== undefined && { quantity: fields.quantity }),
          ...(fields.discountPct !== undefined && {
            discountPct: fields.discountPct,
          }),
          ...(fields.invoiced !== undefined && { invoiced: fields.invoiced }),
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
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const sale = await db.sale.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!sale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Venta no encontrada",
        });
      }

      // Delete stock movement linked to this sale
      await db.stockMovement.deleteMany({
        where: { referenceId: input.id, referenceType: "sale" },
      });

      // Delete payments
      await db.salePayment.deleteMany({ where: { saleId: input.id } });

      // Delete the sale
      await db.sale.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ——————————————————————————————
  // ADD PAYMENT (post-creation partial payment)
  // ——————————————————————————————
  addPayment: protectedProcedure
    .input(addSalePaymentSchema)
    .mutation(async ({ input, ctx }) => {
      const sale = await db.sale.findFirst({
        where: { id: input.saleId, accountId: ctx.accountId },
        include: { payments: true, account: true },
      });
      if (!sale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Venta no encontrada",
        });
      }

      const routing = await resolvePaymentRouting({
        accountId: sale.accountId,
        paymentMethodId: input.paymentMethodId,
        paymentChannelId: input.paymentChannelId,
        paymentAccountId: input.paymentAccountId,
      });
      const accreditationDate = addDays(input.paymentDate, routing.accreditationDays);

      const payment = await db.salePayment.create({
        data: {
          saleId: input.saleId,
          paymentMethodId: routing.paymentMethodId,
          paymentChannelId: routing.paymentChannelId,
          paymentAccountId: routing.paymentAccountId,
          amount: input.amount,
          paymentDate: input.paymentDate,
          accreditationDate,
          notes: input.notes || null,
        },
      });

      // Recalculate and update sale status
      const allPayments = [
        ...sale.payments,
        { amount: input.amount },
      ];
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

      const derived = calcSaleDerived(
        sale.unitPrice,
        sale.quantity,
        sale.discountPct,
        sale.unitCost,
        sale.account
      );

      const newStatus = deriveSaleStatus(
        totalPaid,
        derived.total,
        sale.dueDate
      );

      await db.sale.update({
        where: { id: input.saleId },
        data: { status: newStatus },
      });

      return payment;
    }),

  // ——————————————————————————————
  // REMOVE PAYMENT
  // ——————————————————————————————
  removePayment: protectedProcedure
    .input(z.object({ paymentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const payment = await db.salePayment.findFirst({
        where: { id: input.paymentId, sale: { accountId: ctx.accountId } },
        include: {
          sale: {
            include: { payments: true, account: true },
          },
        },
      });

      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cobro no encontrado",
        });
      }

      // Delete the payment
      await db.salePayment.delete({ where: { id: input.paymentId } });

      // Recalculate status
      const remainingPayments = payment.sale.payments.filter(
        (p) => p.id !== input.paymentId
      );
      const totalPaid = remainingPayments.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      const derived = calcSaleDerived(
        payment.sale.unitPrice,
        payment.sale.quantity,
        payment.sale.discountPct,
        payment.sale.unitCost,
        payment.sale.account
      );

      const newStatus = deriveSaleStatus(
        totalPaid,
        derived.total,
        payment.sale.dueDate
      );

      await db.sale.update({
        where: { id: payment.sale.id },
        data: { status: newStatus },
      });

      return { success: true };
    }),

  // ——————————————————————————————
  // CONVERT DEPOSIT TO FULL SALE (strip [SEÑA] prefix from notes)
  // ——————————————————————————————
  convertDepositToSale: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const sale = await db.sale.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!sale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Venta no encontrada",
        });
      }
      if (!isDeposit(sale.notes)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta venta no está marcada como seña",
        });
      }
      return db.sale.update({
        where: { id: sale.id },
        data: { notes: stripDepositFlag(sale.notes) },
      });
    }),

  // ——————————————————————————————
  // MARK AS DEPOSIT (prepend [SEÑA] to notes)
  // ——————————————————————————————
  markAsDeposit: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const sale = await db.sale.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!sale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Venta no encontrada",
        });
      }
      if (isDeposit(sale.notes)) return sale;
      return db.sale.update({
        where: { id: sale.id },
        data: { notes: addDepositFlag(sale.notes) },
      });
    }),

  // ——————————————————————————————
  // CONVERT ALL DEPOSITS IN A POS TICKET TO FULL SALES
  // ——————————————————————————————
  convertDepositTicket: protectedProcedure
    .input(z.object({ ticketId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const sales = await db.sale.findMany({
        where: {
          accountId: ctx.accountId,
          notes: { contains: `[POS_TICKET:${input.ticketId}]` },
        },
      });
      if (sales.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket no encontrado",
        });
      }
      const depositos = sales.filter((s) => isDeposit(s.notes));
      if (depositos.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ese ticket no está marcado como seña",
        });
      }
      await db.$transaction(
        depositos.map((s) =>
          db.sale.update({
            where: { id: s.id },
            data: { notes: stripDepositFlag(s.notes) },
          })
        )
      );
      return { success: true, converted: depositos.length };
    }),

  // ——————————————————————————————
  // MARK ALL SALES IN A POS TICKET AS DEPOSIT
  // ——————————————————————————————
  markTicketAsDeposit: protectedProcedure
    .input(z.object({ ticketId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const sales = await db.sale.findMany({
        where: {
          accountId: ctx.accountId,
          notes: { contains: `[POS_TICKET:${input.ticketId}]` },
        },
      });
      if (sales.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket no encontrado",
        });
      }
      await db.$transaction(
        sales.map((s) =>
          db.sale.update({
            where: { id: s.id },
            data: { notes: addDepositFlag(s.notes) },
          })
        )
      );
      return { success: true, marked: sales.length };
    }),
});
