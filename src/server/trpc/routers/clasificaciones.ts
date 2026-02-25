import { z } from "zod";
import { router, publicProcedure } from "../init";
import { db } from "@/server/db";
import {
  createProductCategorySchema,
  updateProductCategorySchema,
  createCostCategorySchema,
  updateCostCategorySchema,
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
} from "@/lib/validators/clasificaciones";
import { TRPCError } from "@trpc/server";

// ===========================
// PRODUCT CATEGORIES
// ===========================

export const clasificacionesRouter = router({
  // Product Categories
  listProductCategories: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const categories = await db.productCategory.findMany({
        where: {
          accountId: input.accountId,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return categories;
    }),

  createProductCategory: publicProcedure
    .input(createProductCategorySchema)
    .mutation(async ({ input }) => {
      // Check for duplicate name
      const existing = await db.productCategory.findFirst({
        where: {
          accountId: input.accountId,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe una clasificación con el nombre "${input.name}"`,
        });
      }

      const category = await db.productCategory.create({
        data: input,
      });

      return category;
    }),

  updateProductCategory: publicProcedure
    .input(updateProductCategorySchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );

      // Check for duplicate name if changing it
      if (data.name) {
        const current = await db.productCategory.findUnique({
          where: { id },
        });

        if (!current) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Clasificación no encontrada",
          });
        }

        const existing = await db.productCategory.findFirst({
          where: {
            accountId: current.accountId,
            name: data.name,
            id: {
              not: id,
            },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ya existe una clasificación con el nombre "${data.name}"`,
          });
        }
      }

      const category = await db.productCategory.update({
        where: { id },
        data: cleanData,
      });

      return category;
    }),

  deleteProductCategory: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Check if there are products using this category
      const productsCount = await db.product.count({
        where: {
          categoryId: input.id,
        },
      });

      if (productsCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `No se puede eliminar: hay ${productsCount} producto(s) usando esta clasificación. Desactívala en su lugar.`,
        });
      }

      await db.productCategory.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // ===========================
  // COST CATEGORIES
  // ===========================

  listCostCategories: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        costType: z.enum(["variable", "fijo", "impuestos"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const categories = await db.costCategory.findMany({
        where: {
          accountId: input.accountId,
          ...(input.costType && { costType: input.costType }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return categories;
    }),

  createCostCategory: publicProcedure
    .input(createCostCategorySchema)
    .mutation(async ({ input }) => {
      // Check for duplicate name
      const existing = await db.costCategory.findFirst({
        where: {
          accountId: input.accountId,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe una clasificación de costo con el nombre "${input.name}"`,
        });
      }

      const category = await db.costCategory.create({
        data: input,
      });

      return category;
    }),

  updateCostCategory: publicProcedure
    .input(updateCostCategorySchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      // Check for duplicate name if changing it
      if (data.name) {
        const existing = await db.costCategory.findFirst({
          where: {
            name: data.name,
            id: {
              not: id,
            },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ya existe una clasificación de costo con el nombre "${data.name}"`,
          });
        }
      }

      // Check if changing costType with existing purchases
      if (data.costType) {
        const purchasesCount = await db.purchase.count({
          where: {
            costCategoryId: id,
          },
        });

        if (purchasesCount > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `No se puede cambiar el tipo: hay ${purchasesCount} egreso(s) con esta clasificación.`,
          });
        }
      }

      const category = await db.costCategory.update({
        where: { id },
        data,
      });

      return category;
    }),

  deleteCostCategory: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Check if there are purchases using this category
      const purchasesCount = await db.purchase.count({
        where: {
          costCategoryId: input.id,
        },
      });

      if (purchasesCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `No se puede eliminar: hay ${purchasesCount} egreso(s) usando esta clasificación. Desactívala en su lugar.`,
        });
      }

      await db.costCategory.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // ===========================
  // PAYMENT METHODS
  // ===========================

  listPaymentMethods: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const methods = await db.paymentMethod.findMany({
        where: {
          accountId: input.accountId,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        orderBy: { name: "asc" },
      });
      return methods;
    }),

  createPaymentMethod: publicProcedure
    .input(createPaymentMethodSchema)
    .mutation(async ({ input }) => {
      // Check for duplicate name
      const existing = await db.paymentMethod.findFirst({
        where: {
          accountId: input.accountId,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe un método de pago con el nombre "${input.name}"`,
        });
      }

      const method = await db.paymentMethod.create({
        data: input,
      });

      return method;
    }),

  updatePaymentMethod: publicProcedure
    .input(updatePaymentMethodSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      // Check for duplicate name if changing it
      if (data.name) {
        const existing = await db.paymentMethod.findFirst({
          where: {
            name: data.name,
            id: {
              not: id,
            },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ya existe un método de pago con el nombre "${data.name}"`,
          });
        }
      }

      const method = await db.paymentMethod.update({
        where: { id },
        data,
      });

      return method;
    }),

  deletePaymentMethod: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Check if there are payments using this method
      const salePaymentsCount = await db.salePayment.count({
        where: {
          paymentMethodId: input.id,
        },
      });

      const purchasePaymentsCount = await db.purchasePayment.count({
        where: {
          paymentMethodId: input.id,
        },
      });

      const totalCount = salePaymentsCount + purchasePaymentsCount;

      if (totalCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `No se puede eliminar: hay ${totalCount} pago(s) usando este método. Desactívalo en su lugar.`,
        });
      }

      await db.paymentMethod.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
