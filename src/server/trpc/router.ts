/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */

import { router } from "./init";
import { clasificacionesRouter } from "./routers/clasificaciones";
import { proveedoresRouter } from "./routers/proveedores";
import { productosRouter } from "./routers/productos";
import { ventasRouter } from "./routers/ventas";
import { comprasRouter } from "./routers/compras";
import { mercaderiaRouter } from "./routers/mercaderia";
import { resumenRouter } from "./routers/resumen";
import { estadosResultadosRouter } from "./routers/estados-resultados";
import { cuentasRouter } from "./routers/cuentas";
import { cashflowRouter } from "./routers/cashflow";
import { tableroRouter } from "./routers/tablero";
import { cuadroResumenRouter } from "./routers/cuadro-resumen";
import { facturacionRouter } from "./routers/facturacion";

export const appRouter = router({
  clasificaciones: clasificacionesRouter,
  proveedores: proveedoresRouter,
  productos: productosRouter,
  ventas: ventasRouter,
  compras: comprasRouter,
  mercaderia: mercaderiaRouter,
  resumen: resumenRouter,
  estadosResultados: estadosResultadosRouter,
  cuentas: cuentasRouter,
  cashflow: cashflowRouter,
  tablero: tableroRouter,
  cuadroResumen: cuadroResumenRouter,
  facturacion: facturacionRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
