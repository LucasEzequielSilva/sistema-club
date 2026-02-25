/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */

import { router } from "./init";
import { clasificacionesRouter } from "./routers/clasificaciones";

export const appRouter = router({
  clasificaciones: clasificacionesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
