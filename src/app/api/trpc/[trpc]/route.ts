import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/server/trpc/router";
import { createTRPCContext } from "@/server/trpc/init";
import { makeLogger } from "@/lib/logger";

const logger = makeLogger("trpc");

/**
 * Configure basic CORS headers
 * You must consider whether you want this in production and alter your return
 * statement accordingly. Otherwise you open up your server to all requests.
 */
const setCorsHeaders = (response: Response) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return response;
};

export const OPTIONS = () => {
  return setCorsHeaders(new Response(null, { status: 200 }));
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
  }).then(setCorsHeaders);

export const GET = handler;
export const POST = handler;
