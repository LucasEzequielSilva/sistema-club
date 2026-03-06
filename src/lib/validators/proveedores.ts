import { z } from "zod";

export const createSupplierSchema = z.object({
  accountId: z.string().min(1, "Account ID requerido"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(150, "Máximo 150 caracteres"),
  cuit: z
    .string()
    .max(20, "Máximo 20 caracteres")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(50, "Máximo 50 caracteres")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Email inválido")
    .max(150, "Máximo 150 caracteres")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .max(300, "Máximo 300 caracteres")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export const updateSupplierSchema = z.object({
  id: z.string().cuid("Invalid supplier ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(150, "Máximo 150 caracteres")
    .optional(),
  cuit: z.string().max(20).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Email inválido").max(150).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateSupplier = z.infer<typeof createSupplierSchema>;
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>;
