import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";

/**
 * Defines your router context — what variables do you have access to when processing a request?
 *
 * Reads the session cookie and exposes `session` if valid. The HTTP handler passes the
 * Request object so we can read its cookies.
 */
export const createTRPCContext = async (opts?: { req?: Request }) => {
  const req = opts?.req;
  let session: { email: string; accountId: string } | null = null;

  if (req) {
    // Parse cookies from the Request manually (fetch adapter — no req.cookies).
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cookies = Object.fromEntries(
      cookieHeader
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => {
          const idx = c.indexOf("=");
          if (idx === -1) return [c, ""] as const;
          return [c.slice(0, idx), decodeURIComponent(c.slice(idx + 1))] as const;
        })
    );
    const token = cookies[COOKIE_NAME];
    if (token) {
      const payload = await verifySessionToken(token);
      if (payload) {
        session = { email: payload.email, accountId: payload.accountId };
      }
    }
  }

  return { req, session };
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/**
 * Procedure que requiere sesión válida — `ctx.accountId` y `ctx.email` quedan garantizados.
 * Ningún router debería leer `accountId` desde `input` — usar `ctx.accountId` siempre.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.accountId || !ctx.session?.email) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesión requerida" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      accountId: ctx.session.accountId,
      email: ctx.session.email,
    },
  });
});

/**
 * Procedure de admin — además de sesión, valida whitelist de emails.
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminEmail(ctx.email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acceso de admin requerido" });
  }
  return next({ ctx });
});
