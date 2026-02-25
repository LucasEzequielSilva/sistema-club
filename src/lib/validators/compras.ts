import { z } from "zod";

// ============================================================
// Purchase
// ============================================================

export const createPurchaseSchema = z.object({
  accountId: z.string().cuid("Invalid account ID"),
  supplierId: z.string().cuid("Proveedor inválido").optional().nullable(),
  productId: z.string().cuid("Producto inválido").optional().nullable(),
  costCategoryId: z.string().cuid("Clasificación de costo es obligatoria"),

  invoiceDate: z.coerce.date({ message: "Fecha de factura es obligatoria" }),
  description: z
    .string()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
  unitCost: z.number().min(0, "El costo no puede ser negativo"),
  quantity: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
  discountPct: z
    .number()
    .min(0, "El descuento no puede ser negativo")
    .max(100, "El descuento no puede ser mayor a 100%")
    .default(0),
  ivaAmount: z.number().min(0, "El IVA no puede ser negativo").default(0),

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

  // Inline payments (created with the purchase) — up to 2
  payments: z
    .array(
      z.object({
        paymentMethodId: z.string().cuid("Método de pago inválido"),
        amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
        paymentDate: z.coerce.date(),
      })
    )
    .max(2, "Máximo 2 medios de pago")
    .optional()
    .default([]),
});

export const updatePurchaseSchema = z.object({
  id: z.string().cuid("Invalid purchase ID"),
  supplierId: z.string().cuid("Proveedor inválido").optional().nullable(),
  costCategoryId: z.string().cuid("Clasificación inválida").optional(),

  invoiceDate: z.coerce.date().optional(),
  description: z.string().max(500).optional().nullable(),
  unitCost: z.number().min(0).optional(),
  quantity: z.number().min(0.01).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  ivaAmount: z.number().min(0).optional(),

  invoiceNumber: z.string().max(50).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// ============================================================
// Purchase Payment
// ============================================================

export const addPurchasePaymentSchema = z.object({
  purchaseId: z.string().cuid("Invalid purchase ID"),
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

export type CreatePurchase = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchase = z.infer<typeof updatePurchaseSchema>;
export type AddPurchasePayment = z.infer<typeof addPurchasePaymentSchema>;
