import { z } from "zod";

// ============================================================
// Sale
// ============================================================

export const createSaleSchema = z.object({
  accountId: z.string().min(1, "Account ID requerido"),
  productId: z.string().cuid("Producto es obligatorio"),
  categoryId: z.string().cuid("Categoría es obligatoria"),
  priceListId: z.string().cuid("Invalid price list ID").optional().nullable(),
  clientId: z.string().cuid("Invalid client ID").optional().nullable(),
  sellerId: z.string().cuid("Invalid seller ID").optional().nullable(),

  saleDate: z.coerce.date({ message: "Fecha es obligatoria" }),
  origin: z.enum(["mayorista", "minorista"], {
    message: "Origen es obligatorio",
  }),
  unitPrice: z.number().min(0, "El precio no puede ser negativo"),
  quantity: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
  discountPct: z
    .number()
    .min(0, "El descuento no puede ser negativo")
    .max(100, "El descuento no puede ser mayor a 100%")
    .default(0),

  invoiced: z.boolean().default(false),
  invoiceNumber: z
    .string()
    .max(50, "Máximo 50 caracteres")
    .optional()
    .or(z.literal("")),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z
    .string()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),

  // Inline payments (created with the sale)
  payments: z
    .array(
      z.object({
        paymentMethodId: z.string().cuid("Método de pago inválido"),
        amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
        paymentDate: z.coerce.date(),
      })
    )
    .optional()
    .default([]),
});

export const updateSaleSchema = z.object({
  id: z.string().cuid("Invalid sale ID"),
  priceListId: z.string().cuid("Invalid price list ID").optional().nullable(),
  clientId: z.string().cuid("Invalid client ID").optional().nullable(),

  saleDate: z.coerce.date().optional(),
  origin: z.enum(["mayorista", "minorista"]).optional(),
  unitPrice: z.number().min(0).optional(),
  quantity: z.number().min(0.01).optional(),
  discountPct: z.number().min(0).max(100).optional(),

  invoiced: z.boolean().optional(),
  invoiceNumber: z.string().max(50).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// ============================================================
// Sale Payment
// ============================================================

export const addSalePaymentSchema = z.object({
  saleId: z.string().cuid("Invalid sale ID"),
  paymentMethodId: z.string().cuid("Método de pago es obligatorio"),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  paymentDate: z.coerce.date({ message: "Fecha de pago es obligatoria" }),
  notes: z
    .string()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

// ============================================================
// Types
// ============================================================

export type CreateSale = z.infer<typeof createSaleSchema>;
export type UpdateSale = z.infer<typeof updateSaleSchema>;
export type AddSalePayment = z.infer<typeof addSalePaymentSchema>;
