import { z } from "zod";

// ============================================================
// Product
// ============================================================

export const createProductSchema = z.object({
  accountId: z.string().min(1, "Account ID requerido"),
  categoryId: z.string().cuid("Categoría es obligatoria"),
  subcategoryId: z.string().cuid("Subcategoría inválida").optional().nullable(),
  supplierId: z.string().cuid("Invalid supplier ID").optional().nullable(),

  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(200, "Máximo 200 caracteres"),
  barcode: z
    .string()
    .max(50, "Máximo 50 caracteres")
    .optional()
    .or(z.literal("")),
  sku: z
    .string()
    .max(50, "Máximo 50 caracteres")
    .optional()
    .or(z.literal("")),
  unit: z.enum(["unidad", "kg", "litro", "metro", "par"]).default("unidad"),
  origin: z.enum(["fabricado", "comprado"]).default("comprado"),

  // Stock
  initialStock: z.number().min(0, "Stock inicial no puede ser negativo").default(0),
  minStock: z.number().min(0, "Stock mínimo no puede ser negativo").default(0),

  // Cost components
  acquisitionCost: z.number().min(0, "El costo no puede ser negativo").default(0),
  rawMaterialCost: z.number().min(0, "El costo no puede ser negativo").default(0),
  laborCost: z.number().min(0, "El costo no puede ser negativo").default(0),
  packagingCost: z.number().min(0, "El costo no puede ser negativo").default(0),
});

export const updateProductSchema = z.object({
  id: z.string().cuid("Invalid product ID"),
  categoryId: z.string().cuid("Invalid category ID").optional(),
  subcategoryId: z.string().cuid("Subcategoría inválida").optional().nullable(),
  supplierId: z.string().cuid("Invalid supplier ID").optional().nullable(),

  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(200, "Máximo 200 caracteres")
    .optional(),
  barcode: z.string().max(50).optional().nullable(),
  sku: z.string().max(50).optional().nullable(),
  unit: z.enum(["unidad", "kg", "litro", "metro", "par"]).optional(),
  origin: z.enum(["fabricado", "comprado"]).optional(),

  // Stock
  initialStock: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),

  // Cost components
  acquisitionCost: z.number().min(0).optional(),
  rawMaterialCost: z.number().min(0).optional(),
  laborCost: z.number().min(0).optional(),
  packagingCost: z.number().min(0).optional(),
  effectiveDate: z.coerce.date().optional(),

  isActive: z.boolean().optional(),
});

// ============================================================
// Price List Items (markup per product per list)
// ============================================================

export const updatePriceListItemSchema = z.object({
  priceListId: z.string().cuid("Invalid price list ID"),
  productId: z.string().cuid("Invalid product ID"),
  markupPct: z.number().min(0, "El markup no puede ser negativo"),
});

export const bulkUpdatePriceListItemsSchema = z.object({
  productId: z.string().cuid("Invalid product ID"),
  items: z.array(
    z.object({
      priceListId: z.string().cuid("Invalid price list ID"),
      markupPct: z.number().min(0, "El markup no puede ser negativo"),
    })
  ),
});

// ============================================================
// Types
// ============================================================

export type CreateProduct = z.infer<typeof createProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type UpdatePriceListItem = z.infer<typeof updatePriceListItemSchema>;
export type BulkUpdatePriceListItems = z.infer<typeof bulkUpdatePriceListItemsSchema>;
