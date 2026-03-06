import { z } from "zod";
import { router, publicProcedure } from "../init";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";

export const usersRouter = router({
  list: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      return db.user.findMany({
        where: { accountId: input.accountId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        email: z.string().email(),
        password: z.string().min(4),
        name: z.string().optional(),
        role: z.enum(["admin", "viewer"]).default("admin"),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await db.user.findFirst({
        where: { email: input.email.trim().toLowerCase() },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya existe un usuario con ese email.",
        });
      }
      return db.user.create({
        data: {
          accountId: input.accountId,
          email: input.email.trim().toLowerCase(),
          password: input.password,
          name: input.name ?? null,
          role: input.role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        accountId: z.string(),
        email: z.string().email().optional(),
        password: z.string().min(4).optional(),
        name: z.string().optional(),
        role: z.enum(["admin", "viewer"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, accountId, ...data } = input;
      const user = await db.user.findFirst({ where: { id, accountId } });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado." });
      }
      return db.user.update({
        where: { id },
        data: {
          ...(data.email && { email: data.email.trim().toLowerCase() }),
          ...(data.password && { password: data.password }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.role && { role: data.role }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string(), accountId: z.string() }))
    .mutation(async ({ input }) => {
      const user = await db.user.findFirst({
        where: { id: input.id, accountId: input.accountId },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado." });
      }
      await db.user.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
