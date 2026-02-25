/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */

import { router } from "./init";
import { clasificacionesRouter } from "./routers/clasificaciones";
import { proveedoresRouter } from "./routers/proveedores";

export const appRouter = router({
  clasificaciones: clasificacionesRouter,
  proveedores: proveedoresRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
