# Estado del MVP — Sistema Club

## Resumen ejecutivo

| Fase | Estado | Progreso |
|---|---|---|
| **Fase 0: Setup** | ✅ DONE | 100% |
| **Fase 1: TIER 1 Core** | ⬜ PENDIENTE | 0% |
| **Fase 2: TIER 2 Análisis** | ⬜ PENDIENTE | 0% |
| **Fase 3: POS** | ⬜ PENDIENTE | 0% |
| **Fase 4: Beta Testing** | ⬜ PENDIENTE | 0% |

---

## Fase 0: Setup fundacional ✅

### Estado: COMPLETADO (2025-02-25)

**Lo que se hizo:**

- [x] Crear proyecto Next.js 14 con TypeScript, Tailwind, App Router
- [x] Instalar dependencias core (Prisma, Zod, React Query, date-fns, decimal.js)
- [x] Inicializar Prisma con SQLite
- [x] Diseñar y validar schema de DB (19 tablas + 4 views previstas)
- [x] Crear migración inicial (`20260225101441_init`)
- [x] Generar Prisma Client
- [x] Crear estructura de carpetas (server, lib, components, docs)

**Stack confirmado:**

| Componente | Tecnología | Nota |
|---|---|---|
| Frontend | Next.js 14 (App Router) | ✅ |
| UI | shadcn/ui + Tailwind | Pendiente instalar |
| Backend | tRPC (en progreso) | Pendiente setup |
| ORM | Prisma 7 | ✅ |
| DB (dev) | SQLite | dev.db |
| DB (prod) | PostgreSQL + Supabase | Migración futura |
| Auth | Supabase Auth | Pendiente integrar |

**Base de datos:**

```
19 Tablas principales:
  - Core: accounts, branches, account_members (3)
  - Catalogs: product_categories, cost_categories, payment_methods, suppliers, clients (5)
  - Productos: products, price_lists, price_list_items (3)
  - Transacciones: sales, sale_payments, purchases, purchase_payments (4)
  - Stock: stock_movements (1)
  - Finanzas: bank_accounts, cash_flow_entries, projections (3)

Views planificados (para Postgres, cuando migremos):
  - v_current_stock
  - v_sales_summary
  - v_purchases_summary
  - v_bank_balances
```

**Decisiones arquitectónicas clave:**

1. Separar classifications en 3 tablas (product_categories, cost_categories, payment_methods)
2. Normalizar pagos parciales a tablas separadas (sale_payments, purchase_payments)
3. Tabla clients dedicada para CRM básico
4. price_lists flexible (N listas, no 2 fijas)
5. Tabla branches para multi-sucursal real
6. stock_movements para PEPS trazable
7. Cálculos de precios en backend (no en DB) por complejidad

Ver `/docs/DECISIONS.md` para detalles completos.

---

## Fase 1: TIER 1 Core — MODULOS (en orden de ejecución)

### mod-clasificaciones ⬜ PENDIENTE

- [ ] CRUD de product_categories
- [ ] CRUD de cost_categories
- [ ] CRUD de payment_methods
- [ ] API routes con tRPC
- [ ] UI con shadcn/ui
- [ ] Tests

**Dependencias:** Ninguna (es la base)
**Alimenta a:** mod-proveedores, mod-productos
**Sesión esperada:** Sesión 1 (Sonnet)

---

### mod-proveedores ⬜ PENDIENTE

- [ ] CRUD suppliers
- [ ] Historial de compras por proveedor
- [ ] API routes con tRPC
- [ ] UI con listado, formulario, detalles
- [ ] Tests

**Dependencias:** mod-clasificaciones
**Alimenta a:** mod-productos, mod-compras
**Sesión esperada:** Sesión 2 (Sonnet)

---

### mod-productos ⬜ PENDIENTE

**Nota:** Es el módulo más complejo del TIER 1. Incluye toda la lógica de costos.

- [ ] CRUD products con toda la lógica:
  - Adquisición + MP + MO + Packaging = Unit Cost
  - price_list_items con markups
  - Cálculo de PV Minorista, PV May, PV con IVA (si RI)
  - CM y Margin %
- [ ] Vista de stock actual con alertas
- [ ] Método PEPS para valuación
- [ ] API routes con tRPC
- [ ] UI compleja con tablas anidadas
- [ ] Tests

**Dependencias:** mod-clasificaciones, mod-proveedores
**Alimenta a:** mod-ventas, mod-compras, mod-mercaderia
**Sesión esperada:** Sesión 3 (Sonnet, SESIÓN LARGA)

---

### mod-ventas ⬜ PENDIENTE

- [ ] Formulario de venta:
  - Producto, Fecha, Origen (mayorista/minorista)
  - Precio (auto desde lista), Cantidad, Descuento
  - Hasta 3 medios de cobro parciales
  - Facturado S/N
- [ ] Auto-cálculo: CV Total, CM, Monto, IVA (si RI)
- [ ] Listado con filtros (fecha, producto, estado)
- [ ] Track de cobros pendientes
- [ ] Estado de pago (pending/partial/paid/overdue)
- [ ] API routes con tRPC
- [ ] UI con formulario multi-step
- [ ] Tests

**Dependencias:** mod-productos, mod-clientes (opcional)
**Alimenta a:** mod-resumen, mod-flujo-fondos, mod-pos, mod-tablero
**Sesión esperada:** Sesión 4 (Sonnet)

---

### mod-compras ⬜ PENDIENTE

- [ ] Formulario de compra:
  - Proveedor, Producto, Tipo costo (Var/Fijo/Imp)
  - Costo unitario, Cantidad, Descuento, IVA
  - Hasta 2 medios de pago parciales
  - Nro factura, Vencimiento
- [ ] Actualización automática de stock (PEPS)
- [ ] Estado de pago (pending/partial/paid/overdue)
- [ ] Listado con filtros
- [ ] API routes con tRPC
- [ ] UI similar a mod-ventas
- [ ] Tests

**Dependencias:** mod-proveedores, mod-productos, mod-clasificaciones
**Alimenta a:** mod-resumen, mod-flujo-fondos, mod-cuentas
**Sesión esperada:** Sesión 5 (Sonnet)

---

### mod-mercaderia ⬜ PENDIENTE

- [ ] Ingreso de mercadería (para fabricantes)
- [ ] Ajustes de stock manual (recount, pérdida, etc)
- [ ] Actualización de existencias
- [ ] Log de movimientos
- [ ] API routes con tRPC
- [ ] UI simple con tabla
- [ ] Tests

**Dependencias:** mod-productos
**Alimenta a:** mod-resumen
**Sesión esperada:** Sesión 6 (Sonnet)

---

## Fase 2: TIER 2 Análisis (TIER 1 debe estar 100% antes)

### mod-resumen ⬜ PENDIENTE

- [ ] Resumen de ingresos (facturado, CM, vendidos por clasificación)
- [ ] Resumen de egresos (total por clasificación)
- [ ] Mix de ventas
- [ ] Filtros por período
- [ ] API con JOINs complejos
- [ ] UI con tablas y gráficos simples
- [ ] Tests

**Dependencias:** mod-ventas, mod-compras, mod-mercaderia
**Alimenta a:** mod-tablero
**Sesión esperada:** Sesión 7 (Sonnet)

---

### mod-estados-resultados ⬜ PENDIENTE

**Nota:** Lógica financiera compleja. Usar Opus para diseño.

- [ ] Estado Financiero mensual (Saldo Anterior + Cobranzas - Pagos = Superávit/Déficit)
- [ ] Estado Económico mensual (Ventas - CV = CM - CF = Resultado Bruto)
- [ ] Métricas: Índice Variabilidad, Margen CM, Incidencia CF
- [ ] Vista anual (12 meses)
- [ ] API con vistas de Postgres
- [ ] UI con tabla y gráficos
- [ ] Tests

**Dependencias:** mod-ventas, mod-compras, mod-resumen
**Alimenta a:** mod-tablero, mod-cuadro-resumen
**Sesión esperada:** Sesión 8 (Opus para diseño, luego Sonnet para UI)

---

### mod-cuentas + mod-flujo-fondos ⬜ PENDIENTE

- [ ] Cuentas bancarias (Banco, MP, Efectivo, etc)
- [ ] Saldos diarios por banco
- [ ] Flujo de fondos: Ingreso/Egreso/Saldo diario
- [ ] Saldo inicial manual, resto automático desde sales/purchases
- [ ] API con cálculos de saldos
- [ ] UI con tabla cronológica
- [ ] Tests

**Dependencias:** mod-ventas, mod-compras, mod-resumen
**Alimenta a:** mod-cashflow, mod-tablero
**Sesión esperada:** Sesión 9 (Sonnet)

---

### mod-cashflow ⬜ PENDIENTE

**Nota:** Proyección compleja. Usar Opus para algoritmo.

- [ ] Proyección semanal por mes
- [ ] Ingresos por producto según fecha estimada cobro
- [ ] Egresos por concepto según vencimiento
- [ ] Saldos por banco
- [ ] "Qué-pasaría-si" con sliders (cambiar fechas, montos)
- [ ] API complejo
- [ ] UI avanzada con tabla interactiva
- [ ] Tests

**Dependencias:** mod-cuentas, mod-flujo-fondos, mod-ventas, mod-compras
**Alimenta a:** mod-tablero
**Sesión esperada:** Sesión 10 (Opus + Sonnet)

---

## Fase 3: Dashboard + POS

### mod-tablero ⬜ PENDIENTE

- [ ] KPIs principales (Ventas, CM, Utilidad, % Cobrado)
- [ ] Gráficos (ventas por día, CM %, estado de pago)
- [ ] Período seleccionable (mes, trimestre, año)
- [ ] API que agrega todos los datos
- [ ] UI con cards + gráficos (usar Recharts)
- [ ] Tests

**Dependencias:** mod-resumen, mod-estados-resultados, mod-flujo-fondos
**Sesión esperada:** Sesión 11 (Sonnet)

---

### mod-cuadro-resumen ⬜ PENDIENTE

- [ ] Cuadro KPIs mensuales:
  - Proyección de ventas (manual)
  - Grado de avance
  - Ventas reales, Rentabilidad, Utilidad
  - Rentabilidad dolarizada
  - Ticket promedio, CM promedio, % Cobrados, Monto pendiente
- [ ] API simple
- [ ] UI con tabla editable (proyecciones)
- [ ] Tests

**Dependencias:** mod-resumen, mod-proyecciones
**Sesión esperada:** Sesión 12 (Sonnet)

---

### mod-pos ⬜ PENDIENTE

- [ ] Interfaz de venta rápida (Punto de Venta)
- [ ] Búsqueda/escaneo de barcode
- [ ] Selección de lista de precios
- [ ] Método de pago
- [ ] Vendedor con % comisión
- [ ] Cliente opcional
- [ ] Generación de remito/ticket (print)
- [ ] API routes con tRPC
- [ ] UI táctil, responsive para celular/tablet
- [ ] Tests

**Dependencias:** mod-productos, mod-ventas, mod-clientes
**Sesión esperada:** Sesión 13 (Sonnet, UI-heavy)

---

## Fase 4: Beta Testing + Pulido

### Testing & Feedback ⬜ PENDIENTE

- [ ] Deploy a staging (Vercel)
- [ ] Setup de 10 cuentas beta testers
- [ ] Recolección de feedback
- [ ] Bugs reportados
- [ ] Heatmaps (si recursos)

**Sesión esperada:** Sesión 14-15

---

### Fixes & Polish ⬜ PENDIENTE

- [ ] Corregir bugs reportados
- [ ] Mejoras de UX
- [ ] Performance optimization
- [ ] Documentación de usuario

**Sesión esperada:** Sesión 16+

---

## Próximos pasos inmediatos

1. ✅ Fase 0 completada (schema, project setup)
2. **→ Próximo:** Sesión 1 — mod-clasificaciones (Sonnet)
   - CRUD de product_categories, cost_categories, payment_methods
   - API tRPC routes básicas
   - UI con shadcn/ui

---

## Notas

- **SQLite para dev, Postgres para prod:** El schema está diseñado para ser agnóstico. Al migrar a Supabase, solo agregamos:
  - DECIMAL types en lugar de Float
  - Generated columns para unit_cost
  - Views para reportes complejos
  - RLS policies

- **Contexto limpio por sesión:** Cada módulo abre en sesión NUEVA con su spec desde `/docs/specs/mod-xxx.md`

- **Seed data:** Aún no se implementó. Post-mod-clasificaciones, crearemos seed que auto-popula payment methods, price lists, cost categories.

---

*Documento vivo. Actualizar después de cada sesión de desarrollo.*
