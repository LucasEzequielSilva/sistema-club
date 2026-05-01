import { z } from "zod";
import { noScripts } from "@/lib/sanitize";

const NAME_ERR = "El nombre contiene caracteres no permitidos";
const DESC_ERR = "La descripción contiene caracteres no permitidos";

// ProductCategory
export const createProductCategorySchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .refine(noScripts, DESC_ERR)
    .optional(),
  sortOrder: z.number().int().default(0),
});

export const updateProductCategorySchema = z.object({
  id: z.string().cuid("Invalid category ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR)
    .optional(),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .refine(noScripts, DESC_ERR)
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// ProductSubcategory
export const createProductSubcategorySchema = z.object({
  categoryId: z.string().cuid("Categoría inválida"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .refine(noScripts, DESC_ERR)
    .optional(),
  sortOrder: z.number().int().default(0),
});

export const updateProductSubcategorySchema = z.object({
  id: z.string().cuid("Invalid subcategory ID"),
  categoryId: z.string().cuid("Categoría inválida").optional(),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR)
    .optional(),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .refine(noScripts, DESC_ERR)
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// CostCategory
export const createCostCategorySchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR),
  costType: z.enum(["variable", "fijo", "impuestos"]),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .refine(noScripts, DESC_ERR)
    .optional(),
  sortOrder: z.number().int().default(0),
});

export const updateCostCategorySchema = z.object({
  id: z.string().cuid("Invalid category ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR)
    .optional(),
  costType: z.enum(["variable", "fijo", "impuestos"]).optional(),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres")
    .refine(noScripts, DESC_ERR)
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// PriceList
export const updatePriceListSchema = z.object({
  id: z.string().cuid("Invalid price list ID"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR)
    .optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  roundingMode: z.enum(["none", "up10", "up50", "up100"]).optional(),
});

// PaymentMethod
export const createPaymentMethodSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR),
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
    .refine(noScripts, NAME_ERR)
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
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR),
  provider: z
    .string()
    .max(100, "El proveedor no puede tener más de 100 caracteres")
    .refine(noScripts, "El proveedor contiene caracteres no permitidos")
    .optional()
    .nullable(),
  identifier: z
    .string()
    .max(120, "El identificador no puede tener más de 120 caracteres")
    .refine(noScripts, "El identificador contiene caracteres no permitidos")
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
    .refine(noScripts, NAME_ERR)
    .optional(),
  provider: z
    .string()
    .max(100, "El proveedor no puede tener más de 100 caracteres")
    .refine(noScripts, "El proveedor contiene caracteres no permitidos")
    .optional()
    .nullable(),
  identifier: z
    .string()
    .max(120, "El identificador no puede tener más de 120 caracteres")
    .refine(noScripts, "El identificador contiene caracteres no permitidos")
    .optional()
    .nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// PaymentChannel
export const createPaymentChannelSchema = z.object({
  paymentAccountId: z.string().cuid("Cuenta receptora inválida"),
  paymentMethodId: z.string().cuid("Tipo de pago inválido"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR),
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
  paymentMethodId: z.string().cuid("Tipo de pago inválido").optional(),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede tener más de 100 caracteres")
    .refine(noScripts, NAME_ERR)
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

export type CreateProductSubcategory = z.infer<typeof createProductSubcategorySchema>;
export type UpdateProductSubcategory = z.infer<typeof updateProductSubcategorySchema>;

export type CreateCostCategory = z.infer<typeof createCostCategorySchema>;
export type UpdateCostCategory = z.infer<typeof updateCostCategorySchema>;

export type CreatePaymentMethod = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethod = z.infer<typeof updatePaymentMethodSchema>;
export type CreatePaymentAccount = z.infer<typeof createPaymentAccountSchema>;
export type UpdatePaymentAccount = z.infer<typeof updatePaymentAccountSchema>;
export type CreatePaymentChannel = z.infer<typeof createPaymentChannelSchema>;
export type UpdatePaymentChannel = z.infer<typeof updatePaymentChannelSchema>;
export type UpdatePriceList = z.infer<typeof updatePriceListSchema>;
