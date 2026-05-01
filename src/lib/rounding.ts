export type RoundingMode = "none" | "up10" | "up50" | "up100";

const ROUNDING_MODES: ReadonlyArray<RoundingMode> = [
  "none",
  "up10",
  "up50",
  "up100",
];

export function isRoundingMode(value: unknown): value is RoundingMode {
  return typeof value === "string" && (ROUNDING_MODES as readonly string[]).includes(value);
}

export function normalizeRoundingMode(value: unknown): RoundingMode {
  return isRoundingMode(value) ? value : "none";
}

export function roundPrice(value: number, mode: RoundingMode): number {
  if (mode === "none" || !value || !Number.isFinite(value)) return value;
  const step = mode === "up10" ? 10 : mode === "up50" ? 50 : 100;
  return Math.ceil(value / step) * step;
}

/**
 * Dado un costo + un precio final redondeado, devuelve el markup que
 * produce ese precio. Útil para recalcular markup después del redondeo.
 *
 * El precio final puede ser con IVA o sin IVA. El cálculo es el mismo
 * porque IVA se aplica como factor independiente.
 */
export function deriveMarkup(unitCost: number, salePriceNet: number): number {
  if (unitCost <= 0) return 0;
  return ((salePriceNet - unitCost) / unitCost) * 100;
}
