import { z } from "zod";

// ============================================================
// Projection (manual monthly targets)
// ============================================================

export const upsertProjectionSchema = z.object({
  accountId: z.string(),
  year: z.number().int().min(2020).max(2040),
  month: z.number().int().min(0).max(11), // JS month (0-indexed)
  projectedSales: z.number().min(0).optional().nullable(),
  exchangeRate: z.number().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// ============================================================
// What-if override (client-side only, not persisted)
// ============================================================

export const whatIfOverrideSchema = z.object({
  id: z.string(), // payment id
  type: z.enum(["sale_payment", "purchase_payment"]),
  newDate: z.coerce.date().optional(), // move accreditation/due date
  newAmount: z.number().positive().optional(), // adjust amount
  excluded: z.boolean().optional(), // exclude from projection
});

// ============================================================
// Types
// ============================================================

export type UpsertProjection = z.infer<typeof upsertProjectionSchema>;
export type WhatIfOverride = z.infer<typeof whatIfOverrideSchema>;
