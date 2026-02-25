import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../init";
import { db } from "@/server/db";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/lib/validators/proveedores";

export const proveedoresRouter = router({
  // ——————————————————————————————
  // LIST  (con búsqueda por nombre)
  // ——————————————————————————————
  list: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const suppliers = await db.supplier.findMany({
        where: {
          accountId: input.accountId,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.search && {
            name: { contains: input.search },
          }),
        },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { purchases: true },
          },
        },
      });
      return suppliers;
    }),

  // ——————————————————————————————
  // GET BY ID  (para el detalle)
  // ——————————————————————————————
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const supplier = await db.supplier.findUnique({
        where: { id: input.id },
        include: {
          purchases: {
            orderBy: { invoiceDate: "desc" },
            take: 20,
            include: {
              costCategory: true,
            },
          },
          _count: {
            select: { purchases: true },
          },
        },
      });

      if (!supplier) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proveedor no encontrado",
        });
      }

      return supplier;
    }),

  // ——————————————————————————————
  // CREATE
  // ——————————————————————————————
  create: publicProcedure
    .input(createSupplierSchema)
    .mutation(async ({ input }) => {
      // Check for duplicate name within the account
      const existing = await db.supplier.findFirst({
        where: {
          accountId: input.accountId,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe un proveedor con el nombre "${input.name}"`,
        });
      }

      return db.supplier.create({
        data: {
          accountId: input.accountId,
          name: input.name,
          cuit: input.cuit || null,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          notes: input.notes || null,
        },
      });
    }),

  // ——————————————————————————————
  // UPDATE
  // ——————————————————————————————
  update: publicProcedure
    .input(updateSupplierSchema)
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;

      // Verify it exists
      const current = await db.supplier.findUnique({ where: { id } });
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proveedor no encontrado",
        });
      }

      // Duplicate name check (excluding itself)
      if (fields.name) {
        const dup = await db.supplier.findFirst({
          where: {
            accountId: current.accountId,
            name: fields.name,
            id: { not: id },
          },
        });
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Ya existe un proveedor con el nombre "${fields.name}"`,
          });
        }
      }

      return db.supplier.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.cuit !== undefined && { cuit: fields.cuit || null }),
          ...(fields.phone !== undefined && { phone: fields.phone || null }),
          ...(fields.email !== undefined && { email: fields.email || null }),
          ...(fields.address !== undefined && { address: fields.address || null }),
          ...(fields.notes !== undefined && { notes: fields.notes || null }),
          ...(fields.isActive !== undefined && { isActive: fields.isActive }),
        },
      });
    }),

  // ——————————————————————————————
  // SOFT DELETE  (isActive = false)
  // ——————————————————————————————
  softDelete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const supplier = await db.supplier.findUnique({
        where: { id: input.id },
        include: { _count: { select: { purchases: true } } },
      });

      if (!supplier) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proveedor no encontrado",
        });
      }

      return db.supplier.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  // ——————————————————————————————
  // HARD DELETE  (solo si no tiene compras)
  // ——————————————————————————————
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const count = await db.purchase.count({
        where: { supplierId: input.id },
      });

      if (count > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `No se puede eliminar: el proveedor tiene ${count} compra(s) registrada(s). Desactívalo en su lugar.`,
        });
      }

      await db.supplier.delete({ where: { id: input.id } });
      return { success: true };
    }),
});


