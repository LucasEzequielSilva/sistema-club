import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../init";
import { db } from "@/server/db";
import {
  createProductSchema,
  updateProductSchema,
  bulkUpdatePriceListItemsSchema,
} from "@/lib/validators/productos";

// ============================================================
// Helpers — pricing calculations (all in backend per architecture decision)
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

function calcPricing(
  unitCost: number,
  markupPct: number,
  account: { taxStatus: string; ivaRate: number; includeIvaInCost: boolean }
) {
  // If RI and cost includes IVA, extract IVA from cost for margin calculations
  let costForMargin = unitCost;
  if (
    account.taxStatus === "responsable_inscripto" &&
    account.includeIvaInCost
  ) {
    costForMargin = unitCost / (1 + account.ivaRate / 100);
  }

  const salePrice = unitCost * (1 + markupPct / 100);

  const salePriceWithIva =
    account.taxStatus === "responsable_inscripto"
      ? salePrice * (1 + account.ivaRate / 100)
      : null;

  const contributionMargin = salePrice - costForMargin;
  const marginPct = salePrice > 0 ? (contributionMargin / salePrice) * 100 : 0;

  return {
    unitCost,
    costForMargin,
    salePrice: Math.round(salePrice * 100) / 100,
    salePriceWithIva:
      salePriceWithIva !== null
        ? Math.round(salePriceWithIva * 100) / 100
        : null,
    contributionMargin: Math.round(contributionMargin * 100) / 100,
    marginPct: Math.round(marginPct * 100) / 100,
  };
}

// ============================================================
// Router
// ============================================================

export const productosRouter = router({
  // ——————————————————————————————
  // LIST (with search, filters, computed fields)
  // ——————————————————————————————
  list: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        search: z.string().optional(),
        categoryId: z.string().optional(),
        supplierId: z.string().optional(),
        isActive: z.boolean().optional(),
        lowStockOnly: z.boolean().optional(),
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

      const products = await db.product.findMany({
        where: {
          accountId: input.accountId,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.search && { name: { contains: input.search } }),
          ...(input.categoryId && { categoryId: input.categoryId }),
          ...(input.supplierId && { supplierId: input.supplierId }),
        },
        orderBy: { name: "asc" },
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          priceListItems: {
            include: {
              priceList: { select: { id: true, name: true, isDefault: true } },
            },
          },
          _count: {
            select: { sales: true, purchases: true, stockMovements: true },
          },
        },
      });

      // Calculate current stock for each product
      const productIds = products.map((p) => p.id);
      const stockAgg = await db.stockMovement.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _sum: { quantity: true },
      });
      const stockMap = new Map(
        stockAgg.map((s) => [s.productId, s._sum.quantity ?? 0])
      );

      // Enrich each product with computed fields
      const enriched = products.map((product) => {
        const unitCost = calcUnitCost(product);
        const currentStock =
          product.initialStock + (stockMap.get(product.id) ?? 0);
        const isLowStock = currentStock <= product.minStock;

        // Calculate default price list pricing
        const defaultPriceItem = product.priceListItems.find(
          (item) => item.priceList.isDefault
        );
        const defaultPricing = defaultPriceItem
          ? calcPricing(unitCost, defaultPriceItem.markupPct, account)
          : null;

        return {
          ...product,
          unitCost: Math.round(unitCost * 100) / 100,
          currentStock,
          isLowStock,
          defaultPricing,
        };
      });

      // Apply low stock filter after computation
      if (input.lowStockOnly) {
        return enriched.filter((p) => p.isLowStock);
      }

      return enriched;
    }),

  // ——————————————————————————————
  // GET BY ID (full detail with pricing for all lists + stock)
  // ——————————————————————————————
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const product = await db.product.findUnique({
        where: { id: input.id },
        include: {
          account: {
            select: {
              id: true,
              taxStatus: true,
              ivaRate: true,
              includeIvaInCost: true,
            },
          },
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          priceListItems: {
            include: {
              priceList: {
                select: {
                  id: true,
                  name: true,
                  isDefault: true,
                  sortOrder: true,
                },
              },
            },
            orderBy: { priceList: { sortOrder: "asc" } },
          },
          stockMovements: {
            orderBy: { movementDate: "desc" },
            take: 50,
          },
          _count: {
            select: { sales: true, purchases: true, stockMovements: true },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      const unitCost = calcUnitCost(product);

      // Calculate stock from movements
      const stockAgg = await db.stockMovement.aggregate({
        where: { productId: product.id },
        _sum: { quantity: true },
      });
      const currentStock =
        product.initialStock + (stockAgg._sum.quantity ?? 0);
      const isLowStock = currentStock <= product.minStock;

      // Calculate pricing for each price list
      const pricingByList = product.priceListItems.map((item) => ({
        priceListId: item.priceList.id,
        priceListName: item.priceList.name,
        isDefault: item.priceList.isDefault,
        markupPct: item.markupPct,
        ...calcPricing(unitCost, item.markupPct, product.account),
      }));

      // Valued stock = currentStock * current unitCost
      const valuedStock = Math.round(currentStock * unitCost * 100) / 100;

      return {
        ...product,
        unitCost: Math.round(unitCost * 100) / 100,
        currentStock,
        isLowStock,
        valuedStock,
        pricingByList,
      };
    }),

  // ——————————————————————————————
  // GET PRICE LISTS (for the account, to populate dropdowns)
  // ——————————————————————————————
  getPriceLists: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      return db.priceList.findMany({
        where: { accountId: input.accountId, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
    }),

  // ——————————————————————————————
  // CREATE
  // ——————————————————————————————
  create: publicProcedure
    .input(createProductSchema)
    .mutation(async ({ input }) => {
      // Check for duplicate name
      const existing = await db.product.findFirst({
        where: { accountId: input.accountId, name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe un producto con el nombre "${input.name}"`,
        });
      }

      // Create product
      const product = await db.product.create({
        data: {
          accountId: input.accountId,
          categoryId: input.categoryId,
          supplierId: input.supplierId || null,
          name: input.name,
          barcode: input.barcode || null,
          sku: input.sku || null,
          unit: input.unit,
          origin: input.origin,
          initialStock: input.initialStock,
          minStock: input.minStock,
          acquisitionCost: input.acquisitionCost,
          rawMaterialCost: input.rawMaterialCost,
          laborCost: input.laborCost,
          packagingCost: input.packagingCost,
          lastCostUpdate: new Date(),
        },
      });

      // Auto-create PriceListItems for all active price lists (with 0% markup)
      const priceLists = await db.priceList.findMany({
        where: { accountId: input.accountId, isActive: true },
      });

      if (priceLists.length > 0) {
        await db.priceListItem.createMany({
          data: priceLists.map((list) => ({
            priceListId: list.id,
            productId: product.id,
            markupPct: 0,
          })),
        });
      }

      // Create initial stock movement if initialStock > 0
      if (input.initialStock > 0) {
        const unitCost = calcUnitCost(input);
        await db.stockMovement.create({
          data: {
            accountId: input.accountId,
            productId: product.id,
            movementType: "initial",
            quantity: input.initialStock,
            unitCost,
            referenceType: "initial",
            movementDate: new Date(),
            notes: "Stock inicial al crear producto",
          },
        });
      }

      return product;
    }),

  // ——————————————————————————————
  // UPDATE
  // ——————————————————————————————
  update: publicProcedure
    .input(updateProductSchema)
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;

      const current = await db.product.findUnique({ where: { id } });
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      // Duplicate name check
      if (fields.name) {
        const dup = await db.product.findFirst({
          where: {
            accountId: current.accountId,
            name: fields.name,
            id: { not: id },
          },
        });
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ya existe un producto con el nombre "${fields.name}"`,
          });
        }
      }

      // Detect cost change
      const costChanged =
        fields.acquisitionCost !== undefined ||
        fields.rawMaterialCost !== undefined ||
        fields.laborCost !== undefined ||
        fields.packagingCost !== undefined;

      return db.product.update({
        where: { id },
        data: {
          ...(fields.categoryId !== undefined && {
            categoryId: fields.categoryId,
          }),
          ...(fields.supplierId !== undefined && {
            supplierId: fields.supplierId || null,
          }),
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.barcode !== undefined && {
            barcode: fields.barcode || null,
          }),
          ...(fields.sku !== undefined && { sku: fields.sku || null }),
          ...(fields.unit !== undefined && { unit: fields.unit }),
          ...(fields.origin !== undefined && { origin: fields.origin }),
          ...(fields.initialStock !== undefined && {
            initialStock: fields.initialStock,
          }),
          ...(fields.minStock !== undefined && { minStock: fields.minStock }),
          ...(fields.acquisitionCost !== undefined && {
            acquisitionCost: fields.acquisitionCost,
          }),
          ...(fields.rawMaterialCost !== undefined && {
            rawMaterialCost: fields.rawMaterialCost,
          }),
          ...(fields.laborCost !== undefined && {
            laborCost: fields.laborCost,
          }),
          ...(fields.packagingCost !== undefined && {
            packagingCost: fields.packagingCost,
          }),
          ...(fields.isActive !== undefined && { isActive: fields.isActive }),
          ...(costChanged && { lastCostUpdate: new Date() }),
        },
      });
    }),

  // ——————————————————————————————
  // UPDATE PRICING (bulk update markups for a product across all lists)
  // ——————————————————————————————
  updatePricing: publicProcedure
    .input(bulkUpdatePriceListItemsSchema)
    .mutation(async ({ input }) => {
      const product = await db.product.findUnique({
        where: { id: input.productId },
      });
      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      // Upsert each price list item
      const results = await Promise.all(
        input.items.map((item) =>
          db.priceListItem.upsert({
            where: {
              priceListId_productId: {
                priceListId: item.priceListId,
                productId: input.productId,
              },
            },
            create: {
              priceListId: item.priceListId,
              productId: input.productId,
              markupPct: item.markupPct,
            },
            update: {
              markupPct: item.markupPct,
            },
          })
        )
      );

      return results;
    }),

  // ——————————————————————————————
  // SOFT DELETE (isActive = false)
  // ——————————————————————————————
  softDelete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const product = await db.product.findUnique({
        where: { id: input.id },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Producto no encontrado",
        });
      }

      return db.product.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  // ——————————————————————————————
  // HARD DELETE (only if no sales/purchases)
  // ——————————————————————————————
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [salesCount, purchasesCount] = await Promise.all([
        db.sale.count({ where: { productId: input.id } }),
        db.purchase.count({ where: { productId: input.id } }),
      ]);

      if (salesCount > 0 || purchasesCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `No se puede eliminar: el producto tiene ${salesCount} venta(s) y ${purchasesCount} compra(s). Desactivalo en su lugar.`,
        });
      }

      // Delete related records first (price list items + stock movements)
      await db.priceListItem.deleteMany({ where: { productId: input.id } });
      await db.stockMovement.deleteMany({ where: { productId: input.id } });
      await db.product.delete({ where: { id: input.id } });

      return { success: true };
    }),
});
