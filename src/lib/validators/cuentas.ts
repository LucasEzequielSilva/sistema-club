import { z } from "zod";
import { noScripts } from "@/lib/sanitize";

const NAME_ERR = "El nombre contiene caracteres no permitidos";
const NOTES_ERR = "Las notas contienen caracteres no permitidos";
const CONCEPT_ERR = "El concepto contiene caracteres no permitidos";

// ============================================================
// Bank Account
// ============================================================

export const createBankAccountSchema = z.object({
  name: z
    .string()
    .min(1, "Nombre es obligatorio")
    .max(100, "Máximo 100 caracteres")
    .refine(noScripts, NAME_ERR),
  initialBalance: z.number().default(0),
  balanceDate: z.coerce.date().optional().nullable(),
});

export const updateBankAccountSchema = z.object({
  id: z.string().cuid("Invalid bank account ID"),
  name: z
    .string()
    .min(1)
    .max(100)
    .refine(noScripts, NAME_ERR)
    .optional(),
  initialBalance: z.number().optional(),
  balanceDate: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================================
// Cash Flow Entry (manual)
// ============================================================

export const createCashFlowEntrySchema = z.object({
  bankAccountId: z.string().min(1, "Seleccioná una cuenta"),
  entryDate: z.coerce.date({ message: "Fecha es obligatoria" }),
  movementType: z.enum(["ingreso", "egreso"], { message: "Seleccioná un tipo" }),
  concept: z
    .string()
    .min(1, "Concepto es obligatorio")
    .max(200, "Máximo 200 caracteres")
    .refine(noScripts, CONCEPT_ERR),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  notes: z
    .string()
    .max(500)
    .refine(noScripts, NOTES_ERR)
    .optional(),
});

// ============================================================
// Types
// ============================================================

export type CreateBankAccount = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccount = z.infer<typeof updateBankAccountSchema>;
export type CreateCashFlowEntry = z.infer<typeof createCashFlowEntrySchema>;
