import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/server/trpc/router";
import { createTRPCContext } from "@/server/trpc/init";
import { makeLogger } from "@/lib/logger";

const logger = makeLogger("trpc");

/**
 * CORS allowlist. Cookies-based auth requires a specific origin (no wildcard)
 * + Allow-Credentials. Si el origen no está en la lista, no devolvemos headers
 * CORS y el browser bloquea el request cross-origin.
 */
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL ?? "https://acelerator.matirandazzook.com",
  "http://localhost:3001",
  "http://localhost:3000",
].filter(Boolean);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    };
  }
  return {};
}

const applyCorsHeaders = (response: Response, req: Request) => {
  const headers = corsHeadersFor(req);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
};

export const OPTIONS = (req: Request) => {
  return applyCorsHeaders(new Response(null, { status: 200 }), req);
};

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError: ({ path, error, type }) => {
      // En prod nos interesan errores de servidor, no UNAUTHORIZED/FORBIDDEN/BAD_REQUEST normales.
      const skip = ["UNAUTHORIZED", "FORBIDDEN", "BAD_REQUEST", "NOT_FOUND"];
      if (skip.includes(error.code)) return;
      logger.error("tRPC procedure failed", error, {
        path: path ?? "<no-path>",
        type,
        code: error.code,
      });
    },
  }).then((response) => applyCorsHeaders(response, req));

export const GET = handler;
export const POST = handler;
