import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { db } from "@/server/db";
import {
  saveAfipConfigSchema,
  createInvoiceSchema,
} from "@/lib/validators/facturacion";
import {
  INVOICE_TYPE_NAMES,
  DOC_TYPE_NAMES,
  formatInvoiceNumber,
  determineInvoiceType,
  testAfipConnection,
  getLastVoucherNumber,
  createNextVoucher,
  type AfipConfig,
} from "@/server/services/afip";

// ============================================================
// Helpers
// ============================================================

async function getAfipConfig(accountId: string): Promise<AfipConfig & { puntoVenta: number }> {
  const config = await db.afipConfig.findUnique({
    where: { accountId },
  });
  if (!config) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AFIP no esta configurado. Ve a la pestaña Configuracion para ingresar tus credenciales.",
    });
  }
  return {
    cuit: config.cuit,
    accessToken: config.accessToken,
    cert: config.cert,
    privateKey: config.privateKey,
    isProduction: config.isProduction,
    puntoVenta: config.puntoVenta,
  };
}

function calcSaleTotal(sale: {
  unitPrice: number;
  quantity: number;
  discountPct: number;
}) {
  return sale.unitPrice * sale.quantity * (1 - sale.discountPct / 100);
}

// ============================================================
// Router
// ============================================================

export const facturacionRouter = router({
  // ——————————————————————————————
  // GET AFIP CONFIG
  // ——————————————————————————————
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await db.afipConfig.findUnique({
      where: { accountId: ctx.accountId },
    });
    if (!config) return null;

    return {
      id: config.id,
      cuit: config.cuit,
      puntoVenta: config.puntoVenta,
      accessToken: config.accessToken,
      hasCert: !!config.cert,
      hasKey: !!config.privateKey,
      isProduction: config.isProduction,
      updatedAt: config.updatedAt,
    };
  }),

  // ——————————————————————————————
  // SAVE AFIP CONFIG
  // ——————————————————————————————
  saveConfig: protectedProcedure
    .input(saveAfipConfigSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await db.afipConfig.findUnique({
        where: { accountId: ctx.accountId },
      });

      if (existing) {
        return db.afipConfig.update({
          where: { accountId: ctx.accountId },
          data: {
            cuit: input.cuit,
            puntoVenta: input.puntoVenta,
            accessToken: input.accessToken,
            cert: input.cert || null,
            privateKey: input.privateKey || null,
            isProduction: input.isProduction,
          },
        });
      }

      return db.afipConfig.create({
        data: {
          accountId: ctx.accountId,
          cuit: input.cuit,
          puntoVenta: input.puntoVenta,
          accessToken: input.accessToken,
          cert: input.cert || null,
          privateKey: input.privateKey || null,
          isProduction: input.isProduction,
        },
      });
    }),

  // ——————————————————————————————
  // TEST AFIP CONNECTION
  // ——————————————————————————————
  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const config = await getAfipConfig(ctx.accountId);
    try {
      const status = await testAfipConnection(config);
      return {
        success: true,
        appServer: status.AppServer,
        dbServer: status.DbServer,
        authServer: status.AuthServer,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      return {
        success: false,
        error: message,
      };
    }
  }),

  // ——————————————————————————————
  // GET LAST INVOICE NUMBER
  // ——————————————————————————————
  getLastNumber: protectedProcedure
    .input(
      z.object({
        invoiceType: z.number().int(),
      })
    )
    .query(async ({ input, ctx }) => {
      const config = await getAfipConfig(ctx.accountId);
      try {
        const lastNumber = await getLastVoucherNumber(
          config,
          config.puntoVenta,
          input.invoiceType
        );
        return { lastNumber, nextNumber: lastNumber + 1 };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error consultando AFIP";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error AFIP: ${message}`,
        });
      }
    }),

  // ——————————————————————————————
  // GET UNINVOICED SALES (for linking)
  // ——————————————————————————————
  getUninvoicedSales: protectedProcedure.query(async ({ ctx }) => {
    const sales = await db.sale.findMany({
      where: {
        accountId: ctx.accountId,
        invoiced: false,
      },
      orderBy: { saleDate: "desc" },
      take: 50,
      include: {
        product: { select: { name: true } },
        client: { select: { name: true, cuit: true, clientType: true } },
      },
    });

    return sales.map((sale) => ({
      id: sale.id,
      saleDate: sale.saleDate,
      productName: sale.product.name,
      clientName: sale.client?.name ?? null,
      clientCuit: sale.client?.cuit ?? null,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      discountPct: sale.discountPct,
      subtotal: Math.round(calcSaleTotal(sale) * 100) / 100,
      origin: sale.origin,
    }));
  }),

  // ——————————————————————————————
  // CREATE INVOICE (calls AFIP)
  // ——————————————————————————————
  create: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ input, ctx }) => {
      const config = await getAfipConfig(ctx.accountId);

      const account = await db.account.findUnique({
        where: { id: ctx.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta no encontrada",
        });
      }

      const invoiceTypeName =
        INVOICE_TYPE_NAMES[input.invoiceType] ?? `Tipo ${input.invoiceType}`;

      // Call AFIP to create the voucher
      let afipResult: { CAE: string; CAEFchVto: string; voucherNumber: number };
      try {
        afipResult = await createNextVoucher(config, {
          invoiceType: input.invoiceType,
          puntoVenta: config.puntoVenta,
          concepto: input.concepto,
          docTipo: input.docTipo,
          docNro: input.docNro,
          invoiceDate: input.invoiceDate,
          netAmount: input.netAmount,
          exemptAmount: input.exemptAmount,
          ivaAmount: input.ivaAmount,
          tributesAmount: input.tributesAmount,
          totalAmount: input.totalAmount,
          ivaRate: account.ivaRate,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error AFIP: ${message}`,
        });
      }

      // Parse CAE expiration date
      let caeExpiration: Date | null = null;
      if (afipResult.CAEFchVto) {
        const dateStr = afipResult.CAEFchVto.replace(/-/g, "");
        if (dateStr.length === 8) {
          const y = parseInt(dateStr.substring(0, 4));
          const m = parseInt(dateStr.substring(4, 6)) - 1;
          const d = parseInt(dateStr.substring(6, 8));
          caeExpiration = new Date(y, m, d);
        }
      }

      // Save invoice to database
      const invoice = await db.invoice.create({
        data: {
          accountId: ctx.accountId,
          saleId: input.saleId || null,
          invoiceType: input.invoiceType,
          invoiceTypeName,
          puntoVenta: config.puntoVenta,
          invoiceNumber: afipResult.voucherNumber,
          invoiceDate: input.invoiceDate,
          concepto: input.concepto,
          docTipo: input.docTipo,
          docNro: input.docNro,
          customerName: input.customerName || null,
          netAmount: input.netAmount,
          exemptAmount: input.exemptAmount,
          ivaAmount: input.ivaAmount,
          tributesAmount: input.tributesAmount,
          totalAmount: input.totalAmount,
          cae: afipResult.CAE,
          caeExpiration,
          afipResult: "A",
        },
      });

      // If linked to a sale, mark it as invoiced (validate it belongs to this account)
      if (input.saleId) {
        const linkedSale = await db.sale.findFirst({
          where: { id: input.saleId, accountId: ctx.accountId },
          select: { id: true },
        });
        if (!linkedSale) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Venta vinculada no encontrada",
          });
        }

        const formattedNumber = formatInvoiceNumber(
          config.puntoVenta,
          afipResult.voucherNumber
        );
        const typePrefix =
          input.invoiceType === 1
            ? "A"
            : input.invoiceType === 6
              ? "B"
              : input.invoiceType === 11
                ? "C"
                : "";

        await db.sale.update({
          where: { id: input.saleId },
          data: {
            invoiced: true,
            invoiceNumber: `${typePrefix}-${formattedNumber}`,
          },
        });
      }

      return {
        ...invoice,
        formattedNumber: formatInvoiceNumber(
          config.puntoVenta,
          afipResult.voucherNumber
        ),
      };
    }),

  // ——————————————————————————————
  // LIST INVOICES
  // ——————————————————————————————
  list: protectedProcedure
    .input(
      z
        .object({
          invoiceType: z.number().int().optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const invoices = await db.invoice.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input?.invoiceType && { invoiceType: input.invoiceType }),
          ...(input?.dateFrom || input?.dateTo
            ? {
                invoiceDate: {
                  ...(input?.dateFrom && { gte: input.dateFrom }),
                  ...(input?.dateTo && { lte: input.dateTo }),
                },
              }
            : {}),
          ...(input?.search && {
            OR: [
              { customerName: { contains: input.search } },
              { docNro: { contains: input.search } },
              { cae: { contains: input.search } },
            ],
          }),
        },
        orderBy: { invoiceDate: "desc" },
        include: {
          sale: {
            select: {
              id: true,
              product: { select: { name: true } },
            },
          },
        },
      });

      return invoices.map((inv) => ({
        ...inv,
        formattedNumber: formatInvoiceNumber(inv.puntoVenta, inv.invoiceNumber),
        docTipoName: DOC_TYPE_NAMES[inv.docTipo] ?? `Tipo ${inv.docTipo}`,
      }));
    }),

  // ——————————————————————————————
  // GET INVOICE BY ID
  // ——————————————————————————————
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const invoice = await db.invoice.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
        include: {
          sale: {
            select: {
              id: true,
              saleDate: true,
              unitPrice: true,
              quantity: true,
              discountPct: true,
              product: { select: { name: true } },
              client: { select: { name: true } },
            },
          },
          account: {
            select: { name: true, taxStatus: true, ivaRate: true },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Factura no encontrada",
        });
      }

      return {
        ...invoice,
        formattedNumber: formatInvoiceNumber(
          invoice.puntoVenta,
          invoice.invoiceNumber
        ),
        docTipoName: DOC_TYPE_NAMES[invoice.docTipo] ?? `Tipo ${invoice.docTipo}`,
      };
    }),

  // ——————————————————————————————
  // GET SUMMARY
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
      const dateFilter =
        input?.dateFrom || input?.dateTo
          ? {
              invoiceDate: {
                ...(input?.dateFrom && { gte: input.dateFrom }),
                ...(input?.dateTo && { lte: input.dateTo }),
              },
            }
          : {};

      const invoices = await db.invoice.findMany({
        where: { accountId: ctx.accountId, ...dateFilter },
      });

      let totalNeto = 0;
      let totalIva = 0;
      let totalFacturado = 0;
      let countA = 0;
      let countB = 0;
      let countC = 0;

      for (const inv of invoices) {
        totalNeto += inv.netAmount;
        totalIva += inv.ivaAmount;
        totalFacturado += inv.totalAmount;
        if (inv.invoiceType === 1) countA++;
        else if (inv.invoiceType === 6) countB++;
        else if (inv.invoiceType === 11) countC++;
      }

      return {
        totalNeto: Math.round(totalNeto * 100) / 100,
        totalIva: Math.round(totalIva * 100) / 100,
        totalFacturado: Math.round(totalFacturado * 100) / 100,
        count: invoices.length,
        countA,
        countB,
        countC,
      };
    }),

  // ——————————————————————————————
  // HELPER: Determine invoice type for account
  // ——————————————————————————————
  getInvoiceTypeForAccount: protectedProcedure
    .input(
      z.object({
        docTipo: z.number().int(),
      })
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

      const invoiceType = determineInvoiceType(
        account.taxStatus,
        input.docTipo
      );

      return {
        invoiceType,
        invoiceTypeName: INVOICE_TYPE_NAMES[invoiceType],
        taxStatus: account.taxStatus,
        ivaRate: account.ivaRate,
      };
    }),
});
