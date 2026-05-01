import { z } from "zod";
import { noScripts } from "@/lib/sanitize";

const NOTES_ERR = "Las notas contienen caracteres no permitidos";

// ============================================================
// Merchandise Entry (ingreso de mercadería — producción/fabricación)
// ============================================================

export const createMerchandiseEntrySchema = z.object({
  productId: z.string().cuid("Producto es obligatorio"),

  quantity: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
  unitCost: z.number().min(0, "El costo no puede ser negativo"),
  movementDate: z.coerce.date({ message: "Fecha es obligatoria" }),
  notes: z
    .string()
    .max(1000, "Máximo 1000 caracteres")
    .refine(noScripts, NOTES_ERR)
    .optional()
    .or(z.literal("")),
});

// ============================================================
// Stock Adjustment (ajuste manual: recount, pérdida, robo, daño)
// ============================================================

export const createStockAdjustmentSchema = z.object({
  productId: z.string().cuid("Producto es obligatorio"),

  adjustmentType: z.enum(["recount", "loss", "damage", "other"], {
    message: "Tipo de ajuste es obligatorio",
  }),
  // quantity can be positive (found extra) or negative (lost/damaged)
  quantity: z.number().refine((v) => v !== 0, "La cantidad no puede ser 0"),
  unitCost: z
    .number()
    .min(0, "El costo no puede ser negativo")
    .optional()
    .nullable(),
  movementDate: z.coerce.date({ message: "Fecha es obligatoria" }),
  notes: z
    .string()
    .max(1000, "Máximo 1000 caracteres")
    .refine(noScripts, NOTES_ERR)
    .optional()
    .or(z.literal("")),
});

// ============================================================
// Types
// ============================================================

export type CreateMerchandiseEntry = z.infer<
  typeof createMerchandiseEntrySchema
>;
export type CreateStockAdjustment = z.infer<
  typeof createStockAdjustmentSchema
>;
