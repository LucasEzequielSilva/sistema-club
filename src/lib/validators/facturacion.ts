import { z } from "zod";

// ============================================================
// AFIP Config
// ============================================================

export const saveAfipConfigSchema = z.object({
  cuit: z
    .string()
    .min(11, "CUIT debe tener 11 digitos")
    .max(13, "CUIT invalido")
    .transform((val) => val.replace(/-/g, "")), // Strip dashes
  puntoVenta: z.number().int().min(1, "Punto de venta debe ser >= 1").max(99999),
  accessToken: z.string().min(1, "Access token es obligatorio"),
  cert: z.string().optional().nullable(),
  privateKey: z.string().optional().nullable(),
  isProduction: z.boolean().default(false),
});

// ============================================================
// Invoice creation
// ============================================================

export const createInvoiceSchema = z.object({
  saleId: z.string().cuid("Invalid sale ID").optional().nullable(),

  // AFIP fields
  invoiceType: z.number().int(), // 1, 6, 11, etc.
  concepto: z.number().int().min(1).max(3).default(1), // 1=Productos
  invoiceDate: z.coerce.date({ message: "Fecha es obligatoria" }),

  // Customer
  docTipo: z.number().int(), // 80, 86, 96, 99
  docNro: z.string().default("0"),
  customerName: z.string().max(200).optional().nullable(),

  // Amounts
  netAmount: z.number().min(0, "Importe neto debe ser >= 0"),
  exemptAmount: z.number().min(0).default(0),
  ivaAmount: z.number().min(0).default(0),
  tributesAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0.01, "El total debe ser mayor a 0"),
});

// ============================================================
// Types
// ============================================================

export type SaveAfipConfig = z.infer<typeof saveAfipConfigSchema>;
export type CreateInvoice = z.infer<typeof createInvoiceSchema>;
