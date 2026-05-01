/**
 * Logger estructurado. En Vercel, los console.* salen a Functions Logs.
 * Este helper estandariza el formato y agrega contexto siempre.
 *
 * Niveles: info | warn | error
 * Formato: `[level][module] message :: ${JSON.stringify(context)}`
 */

type Ctx = Record<string, unknown>;

function fmt(level: string, module: string, message: string, ctx?: Ctx): string {
  const ts = new Date().toISOString();
  const ctxStr = ctx && Object.keys(ctx).length > 0 ? ` :: ${safeStringify(ctx)}` : "";
  return `[${ts}][${level}][${module}] ${message}${ctxStr}`;
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? String(v) : v));
  } catch {
    return "[unserializable]";
  }
}

export function makeLogger(module: string) {
  return {
    info(message: string, ctx?: Ctx) {
      console.log(fmt("INFO", module, message, ctx));
    },
    warn(message: string, ctx?: Ctx) {
      console.warn(fmt("WARN", module, message, ctx));
    },
    error(message: string, err?: unknown, ctx?: Ctx) {
      const errMeta =
        err instanceof Error
          ? { errorMessage: err.message, stack: err.stack?.slice(0, 1000) }
          : err
            ? { error: err }
            : {};
      console.error(fmt("ERROR", module, message, { ...ctx, ...errMeta }));
    },
  };
}

/** Helper para uso ad-hoc sin instanciar. */
export const log = makeLogger("app");
