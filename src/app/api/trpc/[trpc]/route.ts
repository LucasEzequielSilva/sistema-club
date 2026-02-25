import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/server/trpc/router";
import { createTRPCContext } from "@/server/trpc/init";

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
    createContext: createTRPCContext,
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}:`,
              error
            );
          }
        : undefined,
  }).then(setCorsHeaders);

export const GET = handler;
export const POST = handler;
