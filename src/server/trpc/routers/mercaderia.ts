import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { db } from "@/server/db";
import {
  createMerchandiseEntrySchema,
  createStockAdjustmentSchema,
} from "@/lib/validators/mercaderia";

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

const ADJUSTMENT_LABELS: Record<string, string> = {
  recount: "Reconteo",
  loss: "Pérdida",
  damage: "Daño",
  other: "Otro",
};

// ============================================================
// Router
// ============================================================

export const mercaderiaRouter = router({
  // ——————————————————————————————
  // LIST MOVEMENTS (all types, with filters)
  // ——————————————————————————————
  listMovements: protectedProcedure
    .input(
      z
        .object({
          productId: z.string().optional(),
          movementType: z.string().optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const movements = await db.stockMovement.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input?.productId && { productId: input.productId }),
          ...(input?.movementType && { movementType: input.movementType }),
          ...(input?.dateFrom || input?.dateTo
            ? {
                movementDate: {
                  ...(input?.dateFrom && { gte: input.dateFrom }),
                  ...(input?.dateTo && { lte: input.dateTo }),
                },
              }
            : {}),
        },
        orderBy: { movementDate: "desc" },
        include: {
          product: {
            select: { id: true, name: true, unit: true },
          },
        },
        take: 500,
      });

      return movements;
    }),

  // ——————————————————————————————
  // GET STOCK SUMMARY (per product)
  // ——————————————————————————————
  getStockSummary: protectedProcedure.query(async ({ ctx }) => {
    const products = await db.product.findMany({
      where: {
        accountId: ctx.accountId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        unit: true,
        initialStock: true,
        minStock: true,
        acquisitionCost: true,
        rawMaterialCost: true,
        laborCost: true,
        packagingCost: true,
      },
      orderBy: { name: "asc" },
    });

    // Get aggregated stock movements per product
    const stockAgg = await db.stockMovement.groupBy({
      by: ["productId"],
      where: { accountId: ctx.accountId },
      _sum: { quantity: true },
    });

    const stockMap = new Map(
      stockAgg.map((s) => [s.productId, s._sum.quantity ?? 0])
    );

    const summary = products.map((p) => {
      const movementTotal = stockMap.get(p.id) ?? 0;
      const currentStock = p.initialStock + movementTotal;
      const unitCost = calcUnitCost(p);
      const valuedStock = currentStock * unitCost;
      const isLowStock = currentStock <= p.minStock;

      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        currentStock,
        minStock: p.minStock,
        unitCost: Math.round(unitCost * 100) / 100,
        valuedStock: Math.round(valuedStock * 100) / 100,
        isLowStock,
      };
    });

    // Aggregate totals
    const totalProducts = summary.length;
    const totalValued = summary.reduce((sum, p) => sum + p.valuedStock, 0);
    const lowStockCount = summary.filter((p) => p.isLowStock).length;

    return {
      products: summary,
      totals: {
        totalProducts,
        totalValued: Math.round(totalValued * 100) / 100,
        lowStockCount,
      },
    };
  }),

  // ——————————————————————————————
  // CREATE MERCHANDISE ENTRY (ingreso de mercadería)
  // ——————————————————————————————
  createEntry: protectedProcedure
    .input(createMerchandiseEntrySchema)
    .mutation(async ({ input, ctx }) => {
      // Validate product exists in this account
      const product = await db.product.findFirst({
        where: { id: input.productId, accountId: ctx.accountId },
      });
      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      const movement = await db.stockMovement.create({
        data: {
          accountId: ctx.accountId,
          productId: input.productId,
          movementType: "merchandise_entry",
          quantity: input.quantity, // always positive
          unitCost: input.unitCost,
          referenceType: "merchandise_entry",
          movementDate: input.movementDate,
          notes: input.notes || null,
        },
      });

      return movement;
    }),

  // ——————————————————————————————
  // CREATE STOCK ADJUSTMENT (ajuste manual)
  // ——————————————————————————————
  createAdjustment: protectedProcedure
    .input(createStockAdjustmentSchema)
    .mutation(async ({ input, ctx }) => {
      // Validate product exists in this account
      const product = await db.product.findFirst({
        where: { id: input.productId, accountId: ctx.accountId },
      });
      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      const label = ADJUSTMENT_LABELS[input.adjustmentType] || input.adjustmentType;
      const notesPrefix = `[${label}]`;
      const fullNotes = input.notes
        ? `${notesPrefix} ${input.notes}`
        : notesPrefix;

      const movement = await db.stockMovement.create({
        data: {
          accountId: ctx.accountId,
          productId: input.productId,
          movementType: "adjustment",
          quantity: input.quantity, // can be positive or negative
          unitCost: input.unitCost ?? null,
          referenceType: "adjustment",
          movementDate: input.movementDate,
          notes: fullNotes,
        },
      });

      return movement;
    }),

  // ——————————————————————————————
  // DELETE MOVEMENT (only for merchandise_entry and adjustment)
  // ——————————————————————————————
  deleteMovement: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const movement = await db.stockMovement.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!movement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Movimiento no encontrado",
        });
      }

      // Only allow deleting merchandise_entry and adjustment types
      if (
        movement.movementType !== "merchandise_entry" &&
        movement.movementType !== "adjustment"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Solo se pueden eliminar ingresos de mercadería y ajustes manuales. Las ventas y compras se eliminan desde sus módulos.",
        });
      }

      await db.stockMovement.delete({ where: { id: input.id } });

      return { success: true };
    }),
});
