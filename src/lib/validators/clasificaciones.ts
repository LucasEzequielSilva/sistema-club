import { z } from "zod";

// ProductCategory
export const createProductCategorySchema = z.object({
  accountId: z.string().min(1, "Account ID requerido"),
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
  accountId: z.string().min(1, "Account ID requerido"),
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
  accountId: z.string().min(1, "Account ID requerido"),
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

// PaymentAccount
export const createPaymentAccountSchema = z.object({
  accountId: z.string().min(1, "Account ID requerido"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres"),
  provider: z
    .string()
    .max(100, "El proveedor no puede tener más de 100 caracteres")
    .optional()
    .nullable(),
  identifier: z
    .string()
    .max(120, "El identificador no puede tener más de 120 caracteres")
    .optional()
    .nullable(),
  isDefault: z.boolean().optional().default(false),
});

export const updatePaymentAccountSchema = z.object({
  id: z.string().cuid("Invalid payment account ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .optional(),
  provider: z
    .string()
    .max(100, "El proveedor no puede tener más de 100 caracteres")
    .optional()
    .nullable(),
  identifier: z
    .string()
    .max(120, "El identificador no puede tener más de 120 caracteres")
    .optional()
    .nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// PaymentChannel
export const createPaymentChannelSchema = z.object({
  accountId: z.string().min(1, "Account ID requerido"),
  paymentAccountId: z.string().cuid("Cuenta receptora inválida"),
  paymentMethodId: z.string().cuid("Método de pago inválido").optional().nullable(),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres"),
  accreditationDays: z
    .number()
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo")
    .default(0),
  feePct: z.number().min(0, "No puede ser negativo").max(100, "No puede ser mayor a 100").default(0),
  isDefault: z.boolean().optional().default(false),
});

export const updatePaymentChannelSchema = z.object({
  id: z.string().cuid("Invalid payment channel ID"),
  paymentAccountId: z.string().cuid("Cuenta receptora inválida").optional(),
  paymentMethodId: z.string().cuid("Método de pago inválido").optional().nullable(),
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
  feePct: z.number().min(0, "No puede ser negativo").max(100, "No puede ser mayor a 100").optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// Type exports
export type CreateProductCategory = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategory = z.infer<typeof updateProductCategorySchema>;

export type CreateCostCategory = z.infer<typeof createCostCategorySchema>;
export type UpdateCostCategory = z.infer<typeof updateCostCategorySchema>;

export type CreatePaymentMethod = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethod = z.infer<typeof updatePaymentMethodSchema>;
export type CreatePaymentAccount = z.infer<typeof createPaymentAccountSchema>;
export type UpdatePaymentAccount = z.infer<typeof updatePaymentAccountSchema>;
export type CreatePaymentChannel = z.infer<typeof createPaymentChannelSchema>;
export type UpdatePaymentChannel = z.infer<typeof updatePaymentChannelSchema>;
