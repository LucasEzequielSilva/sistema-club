import { z } from "zod";

// ProductCategory
export const createProductCategorySchema = z.object({
  accountId: z.string().cuid("Invalid account ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres"),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .optional(),
  sortOrder: z.number().int().default(0),
});

export const updateProductCategorySchema = z.object({
  id: z.string().cuid("Invalid category ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .optional(),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// CostCategory
export const createCostCategorySchema = z.object({
  accountId: z.string().cuid("Invalid account ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres"),
  costType: z.enum(["variable", "fijo", "impuestos"]),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .optional(),
  sortOrder: z.number().int().default(0),
});

export const updateCostCategorySchema = z.object({
  id: z.string().cuid("Invalid category ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .optional(),
  costType: z.enum(["variable", "fijo", "impuestos"]).optional(),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// PaymentMethod
export const createPaymentMethodSchema = z.object({
  accountId: z.string().cuid("Invalid account ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres"),
  accreditationDays: z
    .number()
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo"),
});

export const updatePaymentMethodSchema = z.object({
  id: z.string().cuid("Invalid method ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .optional(),
  accreditationDays: z
    .number()
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo")
    .optional(),
  isActive: z.boolean().optional(),
});

// Type exports
export type CreateProductCategory = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategory = z.infer<typeof updateProductCategorySchema>;

export type CreateCostCategory = z.infer<typeof createCostCategorySchema>;
export type UpdateCostCategory = z.infer<typeof updateCostCategorySchema>;

export type CreatePaymentMethod = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethod = z.infer<typeof updatePaymentMethodSchema>;
