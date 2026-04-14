import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../init";
import { db } from "@/server/db";
import {
  createSaleSchema,
  updateSaleSchema,
  addSalePaymentSchema,
} from "@/lib/validators/ventas";

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
  list: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        search: z.string().optional(),
        productId: z.string().optional(),
        clientId: z.string().optional(),
        status: z.string().optional(), // pending | partial | paid | overdue
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        invoicedOnly: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const account = await db.account.findUnique({
        where: { id: input.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta no encontrada",
        });
      }

      const sales = await db.sale.findMany({
        where: {
          accountId: input.accountId,
          ...(input.productId && { productId: input.productId }),
          ...(input.clientId && { clientId: input.clientId }),
          ...(input.status && { status: input.status }),
          ...(input.invoicedOnly && { invoiced: true }),
          ...(input.dateFrom || input.dateTo
            ? {
                saleDate: {
                  ...(input.dateFrom && { gte: input.dateFrom }),
                  ...(input.dateTo && { lte: input.dateTo }),
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
  getSummary: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const account = await db.account.findUnique({
        where: { id: input.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta no encontrada",
        });
      }

      const dateFilter =
        input.dateFrom || input.dateTo
          ? {
              saleDate: {
                ...(input.dateFrom && { gte: input.dateFrom }),
                ...(input.dateTo && { lte: input.dateTo }),
              },
            }
          : {};

      const sales = await db.sale.findMany({
        where: { accountId: input.accountId, ...dateFilter },
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
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const sale = await db.sale.findUnique({
        where: { id: input.id },
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
  getProductPrice: publicProcedure
    .input(
      z.object({
        productId: z.string(),
        priceListId: z.string(),
        accountId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const product = await db.product.findUnique({
        where: { id: input.productId },
      });
      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      const account = await db.account.findUnique({
        where: { id: input.accountId },
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
          accountId: input.accountId,
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
      };
    }),

  // ——————————————————————————————
  // CREATE (with stock movement + inline payments)
  // ——————————————————————————————
  create: publicProcedure
    .input(createSaleSchema)
    .mutation(async ({ input }) => {
      // Get product to snapshot unitCost
      const product = await db.product.findUnique({
        where: { id: input.productId },
      });
      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      const account = await db.account.findUnique({
        where: { id: input.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta no encontrada",
        });
      }

      const historicalCost = await db.stockMovement.findFirst({
        where: {
          accountId: input.accountId,
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
          accountId: input.accountId,
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
            accountId: input.accountId,
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
          accountId: input.accountId,
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
  update: publicProcedure
    .input(updateSaleSchema)
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;

      const current = await db.sale.findUnique({
        where: { id },
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
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const sale = await db.sale.findUnique({ where: { id: input.id } });
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
  addPayment: publicProcedure
    .input(addSalePaymentSchema)
    .mutation(async ({ input }) => {
      const sale = await db.sale.findUnique({
        where: { id: input.saleId },
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
  removePayment: publicProcedure
    .input(z.object({ paymentId: z.string() }))
    .mutation(async ({ input }) => {
      const payment = await db.salePayment.findUnique({
        where: { id: input.paymentId },
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
});
