import { z } from "zod";

// ============================================================
// Bank Account
// ============================================================

export const createBankAccountSchema = z.object({
  accountId: z.string().min(1, "Account ID requerido"),
  name: z.string().min(1, "Nombre es obligatorio").max(100, "Máximo 100 caracteres"),
  initialBalance: z.number().default(0),
  balanceDate: z.coerce.date().optional().nullable(),
});

export const updateBankAccountSchema = z.object({
  id: z.string().cuid("Invalid bank account ID"),
  name: z.string().min(1).max(100).optional(),
  initialBalance: z.number().optional(),
  balanceDate: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================================
// Cash Flow Entry (manual)
// ============================================================

export const createCashFlowEntrySchema = z.object({
  accountId: z.string(),
  bankAccountId: z.string().min(1, "Seleccioná una cuenta"),
  entryDate: z.coerce.date({ message: "Fecha es obligatoria" }),
  movementType: z.enum(["ingreso", "egreso"], { message: "Seleccioná un tipo" }),
  concept: z.string().min(1, "Concepto es obligatorio").max(200, "Máximo 200 caracteres"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  notes: z.string().max(500).optional(),
});

// ============================================================
// Types
// ============================================================

export type CreateBankAccount = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccount = z.infer<typeof updateBankAccountSchema>;
export type CreateCashFlowEntry = z.infer<typeof createCashFlowEntrySchema>;
