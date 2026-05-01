/**
 * UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN tienen que estar
 * seteadas en Vercel (Settings → Env Vars). Free tier de Upstash es
 * suficiente. Sin estas vars, el rate limit no se aplica (modo dev).
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// Si no hay creds (dev local sin Upstash), usar un mock que siempre permite.
const redis = url && token ? new Redis({ url, token }) : null;

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type Limiter = {
  limit: (id: string) => Promise<LimitResult>;
};

function makeLimiter(prefix: string, limit: number, window: string): Limiter {
  if (!redis) {
    return {
      async limit() {
        return { success: true, limit, remaining: limit, reset: Date.now() };
      },
    };
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    analytics: false,
    prefix: `acelerator:${prefix}`,
  });
}

// Por endpoint, ajustá según uso esperado:
export const loginLimiter = makeLimiter("login", 5, "5 m");        // 5 intentos cada 5 min
export const supportLimiter = makeLimiter("support", 10, "10 m");  // 10 reportes cada 10 min
export const adminApiLimiter = makeLimiter("admin-api", 60, "1 m"); // 60 req/min
export const bugCaptureLimiter = makeLimiter("bug-capture", 30, "1 m"); // 30 errors/min

/** Identificador del cliente: IP del header de Vercel + fallback. */
export function clientId(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim();
  if (ip) return ip;
  return req.headers.get("x-real-ip") ?? "anon";
}

/** Helper que devuelve respuesta 429 lista para usar. */
export function rateLimitedResponse(reset: number) {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: "Demasiados intentos. Probá de nuevo en un rato.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
