import { z } from "zod";
import { noScripts } from "@/lib/sanitize";

export const createSupplierSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(150, "Máximo 150 caracteres")
    .refine(noScripts, "El nombre contiene caracteres no permitidos"),
  cuit: z
    .string()
    .max(20, "Máximo 20 caracteres")
    .refine(noScripts, "El CUIT contiene caracteres no permitidos")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(50, "Máximo 50 caracteres")
    .refine(noScripts, "El teléfono contiene caracteres no permitidos")
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
    .refine(noScripts, "La dirección contiene caracteres no permitidos")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(1000, "Máximo 1000 caracteres")
    .refine(noScripts, "Las notas contienen caracteres no permitidos")
    .optional()
    .or(z.literal("")),
});

export const updateSupplierSchema = z.object({
  id: z.string().cuid("Invalid supplier ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(150, "Máximo 150 caracteres")
    .refine(noScripts, "El nombre contiene caracteres no permitidos")
    .optional(),
  cuit: z
    .string()
    .max(20)
    .refine(noScripts, "El CUIT contiene caracteres no permitidos")
    .optional()
    .nullable(),
  phone: z
    .string()
    .max(50)
    .refine(noScripts, "El teléfono contiene caracteres no permitidos")
    .optional()
    .nullable(),
  email: z.string().email("Email inválido").max(150).optional().nullable(),
  address: z
    .string()
    .max(300)
    .refine(noScripts, "La dirección contiene caracteres no permitidos")
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(1000)
    .refine(noScripts, "Las notas contienen caracteres no permitidos")
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

export type CreateSupplier = z.infer<typeof createSupplierSchema>;
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>;
