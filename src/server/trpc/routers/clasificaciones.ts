import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { db } from "@/server/db";
import {
  createProductCategorySchema,
  updateProductCategorySchema,
  createProductSubcategorySchema,
  updateProductSubcategorySchema,
  createCostCategorySchema,
  updateCostCategorySchema,
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  createPaymentAccountSchema,
  updatePaymentAccountSchema,
  createPaymentChannelSchema,
  updatePaymentChannelSchema,
  updatePriceListSchema,
} from "@/lib/validators/clasificaciones";
import { TRPCError } from "@trpc/server";

// ===========================
// PRODUCT CATEGORIES
// ===========================

export const clasificacionesRouter = router({
  // Product Categories
  listProductCategories: protectedProcedure
    .input(
      z
        .object({
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const categories = await db.productCategory.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input?.isActive !== undefined && { isActive: input.isActive }),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return categories;
    }),

  createProductCategory: protectedProcedure
    .input(createProductCategorySchema)
    .mutation(async ({ input, ctx }) => {
      // Check for duplicate name
      const existing = await db.productCategory.findFirst({
        where: {
          accountId: ctx.accountId,
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
        data: {
          accountId: ctx.accountId,
          name: input.name,
          description: input.description,
          sortOrder: input.sortOrder,
        },
      });

      return category;
    }),

  updateProductCategory: protectedProcedure
    .input(updateProductCategorySchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const current = await db.productCategory.findFirst({
        where: { id, accountId: ctx.accountId },
      });
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clasificación no encontrada",
        });
      }

      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );

      // Check for duplicate name if changing it
      if (data.name) {
        const existing = await db.productCategory.findFirst({
          where: {
            accountId: ctx.accountId,
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

  deleteProductCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const category = await db.productCategory.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clasificación no encontrada",
        });
      }

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
  // PRODUCT SUBCATEGORIES
  // ===========================

  listProductSubcategories: protectedProcedure
    .input(
      z
        .object({
          categoryId: z.string().optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return db.productSubcategory.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input?.categoryId && { categoryId: input.categoryId }),
          ...(input?.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    }),

  createProductSubcategory: protectedProcedure
    .input(createProductSubcategorySchema)
    .mutation(async ({ input, ctx }) => {
      const category = await db.productCategory.findFirst({
        where: { id: input.categoryId, accountId: ctx.accountId },
      });
      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Categoría no encontrada",
        });
      }

      const existing = await db.productSubcategory.findFirst({
        where: { categoryId: input.categoryId, name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe una subcategoría "${input.name}" en esta categoría`,
        });
      }

      return db.productSubcategory.create({
        data: {
          accountId: ctx.accountId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          sortOrder: input.sortOrder,
        },
      });
    }),

  updateProductSubcategory: protectedProcedure
    .input(updateProductSubcategorySchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const current = await db.productSubcategory.findFirst({
        where: { id, accountId: ctx.accountId },
      });
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subcategoría no encontrada",
        });
      }

      if (data.name || data.categoryId) {
        const targetCategoryId = data.categoryId ?? current.categoryId;
        const targetName = data.name ?? current.name;
        const existing = await db.productSubcategory.findFirst({
          where: {
            categoryId: targetCategoryId,
            name: targetName,
            id: { not: id },
          },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ya existe una subcategoría "${targetName}" en esa categoría`,
          });
        }
      }

      return db.productSubcategory.update({
        where: { id },
        data,
      });
    }),

  deleteProductSubcategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const subcat = await db.productSubcategory.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!subcat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subcategoría no encontrada",
        });
      }

      const productsCount = await db.product.count({
        where: { subcategoryId: input.id },
      });

      if (productsCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `No se puede eliminar: hay ${productsCount} producto(s) usando esta subcategoría. Desactívala en su lugar.`,
        });
      }

      await db.productSubcategory.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ===========================
  // COST CATEGORIES
  // ===========================

  listCostCategories: protectedProcedure
    .input(
      z
        .object({
          costType: z.enum(["variable", "fijo", "impuestos"]).optional(),
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const categories = await db.costCategory.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input?.costType && { costType: input.costType }),
          ...(input?.isActive !== undefined && { isActive: input.isActive }),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return categories;
    }),

  createCostCategory: protectedProcedure
    .input(createCostCategorySchema)
    .mutation(async ({ input, ctx }) => {
      // Check for duplicate name
      const existing = await db.costCategory.findFirst({
        where: {
          accountId: ctx.accountId,
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
        data: {
          accountId: ctx.accountId,
          name: input.name,
          costType: input.costType,
          description: input.description,
          sortOrder: input.sortOrder,
        },
      });

      return category;
    }),

  updateCostCategory: protectedProcedure
    .input(updateCostCategorySchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const current = await db.costCategory.findFirst({
        where: { id, accountId: ctx.accountId },
      });
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clasificación de costo no encontrada",
        });
      }

      // Check for duplicate name if changing it
      if (data.name) {
        const existing = await db.costCategory.findFirst({
          where: {
            accountId: ctx.accountId,
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

  deleteCostCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const cat = await db.costCategory.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!cat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Clasificación de costo no encontrada",
        });
      }

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

  bootstrapPaymentRouting: protectedProcedure.mutation(async ({ ctx }) => {
    let defaultAccount = await db.paymentAccount.findFirst({
      where: { accountId: ctx.accountId, isDefault: true, isActive: true },
    });

    if (!defaultAccount) {
      defaultAccount = await db.paymentAccount.create({
        data: {
          accountId: ctx.accountId,
          name: "Cuenta principal",
          provider: "interna",
          isDefault: true,
        },
      });
    }

    const methods = await db.paymentMethod.findMany({
      where: { accountId: ctx.accountId, isActive: true },
      orderBy: { name: "asc" },
    });

    let createdChannels = 0;
    for (const method of methods) {
      const existing = await db.paymentChannel.findFirst({
        where: {
          accountId: ctx.accountId,
          paymentMethodId: method.id,
        },
      });

      if (!existing) {
        await db.paymentChannel.create({
          data: {
            accountId: ctx.accountId,
            paymentAccountId: defaultAccount.id,
            paymentMethodId: method.id,
            name: method.name,
            accreditationDays: method.accreditationDays,
            feePct: 0,
          },
        });
        createdChannels += 1;
      }
    }

    const hasDefaultChannel = await db.paymentChannel.findFirst({
      where: { accountId: ctx.accountId, isDefault: true, isActive: true },
    });

    if (!hasDefaultChannel) {
      const firstChannel = await db.paymentChannel.findFirst({
        where: { accountId: ctx.accountId, isActive: true },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      });
      if (firstChannel) {
        await db.paymentChannel.update({
          where: { id: firstChannel.id },
          data: { isDefault: true },
        });
      }
    }

    return {
      paymentAccountId: defaultAccount.id,
      createdChannels,
      methodsCount: methods.length,
    };
  }),

  listPaymentAccounts: protectedProcedure
    .input(
      z
        .object({
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return db.paymentAccount.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input?.isActive !== undefined && { isActive: input.isActive }),
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    }),

  createPaymentAccount: protectedProcedure
    .input(createPaymentAccountSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await db.paymentAccount.findFirst({
        where: {
          accountId: ctx.accountId,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe una cuenta receptora con el nombre "${input.name}"`,
        });
      }

      const hasDefault =
        (await db.paymentAccount.count({
          where: { accountId: ctx.accountId, isDefault: true, isActive: true },
        })) > 0;

      const makeDefault = input.isDefault || !hasDefault;

      if (makeDefault) {
        await db.paymentAccount.updateMany({
          where: { accountId: ctx.accountId },
          data: { isDefault: false },
        });
      }

      return db.paymentAccount.create({
        data: {
          accountId: ctx.accountId,
          name: input.name,
          provider: input.provider || null,
          identifier: input.identifier || null,
          isDefault: makeDefault,
        },
      });
    }),

  updatePaymentAccount: protectedProcedure
    .input(updatePaymentAccountSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const current = await db.paymentAccount.findFirst({
        where: { id, accountId: ctx.accountId },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta receptora no encontrada" });
      }

      if (data.name) {
        const existing = await db.paymentAccount.findFirst({
          where: {
            accountId: ctx.accountId,
            name: data.name,
            id: { not: id },
          },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ya existe una cuenta receptora con el nombre "${data.name}"`,
          });
        }
      }

      if (data.isDefault) {
        await db.paymentAccount.updateMany({
          where: { accountId: ctx.accountId },
          data: { isDefault: false },
        });
      }

      return db.paymentAccount.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.provider !== undefined && { provider: data.provider || null }),
          ...(data.identifier !== undefined && { identifier: data.identifier || null }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
    }),

  deletePaymentAccount: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const acc = await db.paymentAccount.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!acc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta receptora no encontrada" });
      }

      const channelsCount = await db.paymentChannel.count({
        where: { paymentAccountId: input.id },
      });
      const salePaymentsCount = await db.salePayment.count({
        where: { paymentAccountId: input.id },
      });
      const purchasePaymentsCount = await db.purchasePayment.count({
        where: { paymentAccountId: input.id },
      });

      const totalCount = channelsCount + salePaymentsCount + purchasePaymentsCount;
      if (totalCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `No se puede eliminar: hay ${totalCount} referencia(s) a esta cuenta receptora.`,
        });
      }

      await db.paymentAccount.delete({ where: { id: input.id } });
      return { success: true };
    }),

  listPaymentChannels: protectedProcedure
    .input(
      z
        .object({
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return db.paymentChannel.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input?.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          paymentAccount: { select: { id: true, name: true, isDefault: true } },
          paymentMethod: { select: { id: true, name: true } },
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    }),

  createPaymentChannel: protectedProcedure
    .input(createPaymentChannelSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await db.paymentChannel.findFirst({
        where: {
          accountId: ctx.accountId,
          name: input.name,
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe un canal con el nombre "${input.name}"`,
        });
      }

      const account = await db.paymentAccount.findFirst({
        where: { id: input.paymentAccountId, accountId: ctx.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta receptora no encontrada",
        });
      }

      if (input.paymentMethodId) {
        const method = await db.paymentMethod.findFirst({
          where: { id: input.paymentMethodId, accountId: ctx.accountId },
        });
        if (!method) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Método de pago no encontrado",
          });
        }
      }

      const hasDefault =
        (await db.paymentChannel.count({
          where: { accountId: ctx.accountId, isDefault: true, isActive: true },
        })) > 0;

      const makeDefault = input.isDefault || !hasDefault;
      if (makeDefault) {
        await db.paymentChannel.updateMany({
          where: { accountId: ctx.accountId },
          data: { isDefault: false },
        });
      }

      return db.paymentChannel.create({
        data: {
          accountId: ctx.accountId,
          paymentAccountId: input.paymentAccountId,
          paymentMethodId: input.paymentMethodId || null,
          name: input.name,
          accreditationDays: input.accreditationDays,
          feePct: input.feePct,
          isDefault: makeDefault,
        },
      });
    }),

  updatePaymentChannel: protectedProcedure
    .input(updatePaymentChannelSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const current = await db.paymentChannel.findFirst({
        where: { id, accountId: ctx.accountId },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Canal no encontrado" });
      }

      if (data.name) {
        const existing = await db.paymentChannel.findFirst({
          where: {
            accountId: ctx.accountId,
            name: data.name,
            id: { not: id },
          },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ya existe un canal con el nombre "${data.name}"`,
          });
        }
      }

      if (data.paymentAccountId) {
        const account = await db.paymentAccount.findFirst({
          where: { id: data.paymentAccountId, accountId: ctx.accountId },
        });
        if (!account) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cuenta receptora no encontrada",
          });
        }
      }

      if (data.paymentMethodId) {
        const method = await db.paymentMethod.findFirst({
          where: { id: data.paymentMethodId, accountId: ctx.accountId },
        });
        if (!method) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Método de pago no encontrado",
          });
        }
      }

      if (data.isDefault) {
        await db.paymentChannel.updateMany({
          where: { accountId: ctx.accountId },
          data: { isDefault: false },
        });
      }

      return db.paymentChannel.update({
        where: { id },
        data: {
          ...(data.paymentAccountId !== undefined && {
            paymentAccountId: data.paymentAccountId,
          }),
          ...(data.paymentMethodId !== undefined && {
            paymentMethodId: data.paymentMethodId || null,
          }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.accreditationDays !== undefined && {
            accreditationDays: data.accreditationDays,
          }),
          ...(data.feePct !== undefined && { feePct: data.feePct }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
    }),

  deletePaymentChannel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const channel = await db.paymentChannel.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Canal no encontrado" });
      }

      const salePaymentsCount = await db.salePayment.count({
        where: { paymentChannelId: input.id },
      });
      const purchasePaymentsCount = await db.purchasePayment.count({
        where: { paymentChannelId: input.id },
      });
      const totalCount = salePaymentsCount + purchasePaymentsCount;

      if (totalCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `No se puede eliminar: hay ${totalCount} pago(s) usando este canal.`,
        });
      }

      await db.paymentChannel.delete({ where: { id: input.id } });
      return { success: true };
    }),

  listPaymentMethods: protectedProcedure
    .input(
      z
        .object({
          isActive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const methods = await db.paymentMethod.findMany({
        where: {
          accountId: ctx.accountId,
          ...(input?.isActive !== undefined && { isActive: input.isActive }),
        },
        orderBy: { name: "asc" },
      });
      return methods;
    }),

  createPaymentMethod: protectedProcedure
    .input(createPaymentMethodSchema)
    .mutation(async ({ input, ctx }) => {
      // Check for duplicate name
      const existing = await db.paymentMethod.findFirst({
        where: {
          accountId: ctx.accountId,
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
        data: {
          accountId: ctx.accountId,
          name: input.name,
          accreditationDays: input.accreditationDays,
        },
      });

      const defaultAccount = await db.paymentAccount.findFirst({
        where: {
          accountId: ctx.accountId,
          isDefault: true,
          isActive: true,
        },
      });

      if (defaultAccount) {
        await db.paymentChannel.create({
          data: {
            accountId: ctx.accountId,
            paymentAccountId: defaultAccount.id,
            paymentMethodId: method.id,
            name: method.name,
            accreditationDays: method.accreditationDays,
            feePct: 0,
          },
        });
      }

      return method;
    }),

  updatePaymentMethod: protectedProcedure
    .input(updatePaymentMethodSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const current = await db.paymentMethod.findFirst({
        where: { id, accountId: ctx.accountId },
      });
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Método de pago no encontrado",
        });
      }

      // Check for duplicate name if changing it
      if (data.name) {
        const existing = await db.paymentMethod.findFirst({
          where: {
            accountId: ctx.accountId,
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

      if (data.accreditationDays !== undefined) {
        await db.paymentChannel.updateMany({
          where: { paymentMethodId: id },
          data: { accreditationDays: data.accreditationDays },
        });
      }

      return method;
    }),

  deletePaymentMethod: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const method = await db.paymentMethod.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!method) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Método de pago no encontrado",
        });
      }

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

      const channelsCount = await db.paymentChannel.count({
        where: {
          paymentMethodId: input.id,
        },
      });

      const totalCount = salePaymentsCount + purchasePaymentsCount + channelsCount;

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

  // ===========================
  // PRICE LISTS
  // ===========================

  updatePriceList: protectedProcedure
    .input(updatePriceListSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const current = await db.priceList.findFirst({
        where: { id, accountId: ctx.accountId },
      });
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lista de precios no encontrada",
        });
      }

      if (data.name) {
        const dup = await db.priceList.findFirst({
          where: {
            accountId: ctx.accountId,
            name: data.name,
            id: { not: id },
          },
        });
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ya existe una lista con el nombre "${data.name}"`,
          });
        }
      }

      if (data.isDefault) {
        await db.priceList.updateMany({
          where: { accountId: ctx.accountId },
          data: { isDefault: false },
        });
      }

      return db.priceList.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.roundingMode !== undefined && {
            roundingMode: data.roundingMode,
          }),
        },
      });
    }),
});
