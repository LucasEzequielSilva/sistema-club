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
  createPaymentAccountSchema,
  updatePaymentAccountSchema,
  createPaymentChannelSchema,
  updatePaymentChannelSchema,
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

  bootstrapPaymentRouting: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input }) => {
      let defaultAccount = await db.paymentAccount.findFirst({
        where: { accountId: input.accountId, isDefault: true, isActive: true },
      });

      if (!defaultAccount) {
        defaultAccount = await db.paymentAccount.create({
          data: {
            accountId: input.accountId,
            name: "Cuenta principal",
            provider: "interna",
            isDefault: true,
          },
        });
      }

      const methods = await db.paymentMethod.findMany({
        where: { accountId: input.accountId, isActive: true },
        orderBy: { name: "asc" },
      });

      let createdChannels = 0;
      for (const method of methods) {
        const existing = await db.paymentChannel.findFirst({
          where: {
            accountId: input.accountId,
            paymentMethodId: method.id,
          },
        });

        if (!existing) {
          await db.paymentChannel.create({
            data: {
              accountId: input.accountId,
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
        where: { accountId: input.accountId, isDefault: true, isActive: true },
      });

      if (!hasDefaultChannel) {
        const firstChannel = await db.paymentChannel.findFirst({
          where: { accountId: input.accountId, isActive: true },
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

  listPaymentAccounts: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.paymentAccount.findMany({
        where: {
          accountId: input.accountId,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    }),

  createPaymentAccount: publicProcedure
    .input(createPaymentAccountSchema)
    .mutation(async ({ input }) => {
      const existing = await db.paymentAccount.findFirst({
        where: {
          accountId: input.accountId,
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
          where: { accountId: input.accountId, isDefault: true, isActive: true },
        })) > 0;

      const makeDefault = input.isDefault || !hasDefault;

      if (makeDefault) {
        await db.paymentAccount.updateMany({
          where: { accountId: input.accountId },
          data: { isDefault: false },
        });
      }

      return db.paymentAccount.create({
        data: {
          accountId: input.accountId,
          name: input.name,
          provider: input.provider || null,
          identifier: input.identifier || null,
          isDefault: makeDefault,
        },
      });
    }),

  updatePaymentAccount: publicProcedure
    .input(updatePaymentAccountSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      const current = await db.paymentAccount.findUnique({ where: { id } });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta receptora no encontrada" });
      }

      if (data.name) {
        const existing = await db.paymentAccount.findFirst({
          where: {
            accountId: current.accountId,
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
          where: { accountId: current.accountId },
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

  deletePaymentAccount: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
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

  listPaymentChannels: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.paymentChannel.findMany({
        where: {
          accountId: input.accountId,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          paymentAccount: { select: { id: true, name: true, isDefault: true } },
          paymentMethod: { select: { id: true, name: true } },
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    }),

  createPaymentChannel: publicProcedure
    .input(createPaymentChannelSchema)
    .mutation(async ({ input }) => {
      const existing = await db.paymentChannel.findFirst({
        where: {
          accountId: input.accountId,
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
        where: { id: input.paymentAccountId, accountId: input.accountId },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cuenta receptora no encontrada",
        });
      }

      if (input.paymentMethodId) {
        const method = await db.paymentMethod.findFirst({
          where: { id: input.paymentMethodId, accountId: input.accountId },
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
          where: { accountId: input.accountId, isDefault: true, isActive: true },
        })) > 0;

      const makeDefault = input.isDefault || !hasDefault;
      if (makeDefault) {
        await db.paymentChannel.updateMany({
          where: { accountId: input.accountId },
          data: { isDefault: false },
        });
      }

      return db.paymentChannel.create({
        data: {
          accountId: input.accountId,
          paymentAccountId: input.paymentAccountId,
          paymentMethodId: input.paymentMethodId || null,
          name: input.name,
          accreditationDays: input.accreditationDays,
          feePct: input.feePct,
          isDefault: makeDefault,
        },
      });
    }),

  updatePaymentChannel: publicProcedure
    .input(updatePaymentChannelSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      const current = await db.paymentChannel.findUnique({ where: { id } });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Canal no encontrado" });
      }

      if (data.name) {
        const existing = await db.paymentChannel.findFirst({
          where: {
            accountId: current.accountId,
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
          where: { id: data.paymentAccountId, accountId: current.accountId },
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
          where: { id: data.paymentMethodId, accountId: current.accountId },
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
          where: { accountId: current.accountId },
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

  deletePaymentChannel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
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

      const defaultAccount = await db.paymentAccount.findFirst({
        where: {
          accountId: input.accountId,
          isDefault: true,
          isActive: true,
        },
      });

      if (defaultAccount) {
        await db.paymentChannel.create({
          data: {
            accountId: input.accountId,
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

      if (data.accreditationDays !== undefined) {
        await db.paymentChannel.updateMany({
          where: { paymentMethodId: id },
          data: { accreditationDays: data.accreditationDays },
        });
      }

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
});
