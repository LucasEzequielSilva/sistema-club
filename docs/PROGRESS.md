# Estado del MVP — Sistema Club

## Resumen ejecutivo

| Fase | Estado | Progreso |
|---|---|---|
| **Fase 0: Setup** | ✅ DONE | 100% |
| **Fase 1: TIER 1 Core** | ✅ DONE | 100% (6/6 módulos) |
| **Fase 2: TIER 2 Análisis** | ✅ DONE | 100% (5/5 módulos) |
| **Fase 3: Dashboard + POS** | ✅ DONE | 100% (4/4 módulos) |
| **Fase 4: Beta Testing** | 🔧 EN PROGRESO | 30% |

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

### mod-clasificaciones ✅ DONE

**Completado en Sesión 1 (2025-02-25)**

- [x] CRUD de product_categories (crear, listar, actualizar, soft delete)
- [x] CRUD de cost_categories (crear, listar, actualizar con type selector)
- [x] CRUD de payment_methods (crear, listar, actualizar, accreditation_days)
- [x] API routes con tRPC (init, router, HTTP handler)
- [x] UI con shadcn/ui (Tabs, Dialog, Table, Form, Select, Badge)
- [x] Validadores Zod para los 3 tipos
- [x] Seed function para defaults en nueva account
- [x] Sonner para toasts
- [x] Sidebar con navegación

**Stack usado:**
- tRPC para type-safe API
- Prisma para DB
- Zod para validación
- shadcn/ui para componentes
- Sonner para notifications

**Pendiente para production:**
- Tests unitarios (Zod validators)
- Tests de integración (tRPC mutations)
- E2E tests con Playwright
- Auth con Supabase

**Dependencias:** Ninguna (es la base)
**Alimenta a:** mod-proveedores, mod-productos
**Sesión esperada:** Sesión 1 (Sonnet) ✅

---

### mod-proveedores ✅ DONE

**Completado en Sesión 2 (2025-02-25)**

- [x] tRPC router: list (con búsqueda debounced), getById, create, update, softDelete, delete
- [x] Zod validators: createSupplier, updateSupplier
- [x] Página `/proveedores`: tabla con columnas Nombre/CUIT/Teléfono/Email/Ubicación/Compras
- [x] Búsqueda por nombre con debounce (300ms)
- [x] Soft delete (desactivar) separado de hard delete
- [x] Dialog crear/editar: grid 2 columnas para CUIT+Teléfono, textarea para notas
- [x] Vista detalle: datos de contacto + estadísticas + historial de compras
- [x] Historial de compras: real si existen, placeholder si no hay
- [x] Sidebar ya tenía el enlace a Proveedores ✓
- [x] Validación nombre duplicado, email format, longitud máxima
- [x] Fila inactiva con opacity-50

**Archivos creados:**
- `src/lib/validators/proveedores.ts`
- `src/server/trpc/routers/proveedores.ts`
- `src/app/(dashboard)/proveedores/page.tsx`
- `src/app/(dashboard)/proveedores/components/supplier-dialog.tsx`
- `src/app/(dashboard)/proveedores/components/supplier-detail.tsx`

**Dependencias:** mod-clasificaciones ✅
**Alimenta a:** mod-productos, mod-compras
**Sesión esperada:** Sesión 2 (Sonnet) ✅

---

### mod-productos ✅ DONE

**Completado en Sesión 3 (2025-02-25)**

- [x] Zod validators: createProduct, updateProduct, updatePriceListItem, bulkUpdatePriceListItems
- [x] tRPC router: list (con búsqueda + filtros por categoría/proveedor/stock bajo), getById (detalle completo), getPriceLists, create, update, updatePricing, softDelete, delete
- [x] Backend calculation logic:
  - unitCost = acquisitionCost + rawMaterialCost + laborCost + packagingCost
  - salePrice = unitCost × (1 + markupPct/100)
  - salePriceWithIva = salePrice × (1 + ivaRate/100) [solo RI]
  - contributionMargin = salePrice - costForMargin
  - marginPct = CM / salePrice × 100
  - IVA extraction from cost when includeIvaInCost = true
- [x] currentStock = initialStock + SUM(stockMovements.quantity)
- [x] Stock movement created on product creation (if initialStock > 0)
- [x] Auto-create PriceListItems for all active price lists on product creation
- [x] Página `/productos`: tabla con columnas Producto/Categoría/Proveedor/Costo/PV/Margen%/Stock/Activo
- [x] Filtros: búsqueda debounced, categoría, proveedor, stock bajo
- [x] Dialog crear/editar: categoría/proveedor selects, barcode/SKU, unidad/origen, 4 componentes de costo (con unitCost calculado live), stock inicial/mínimo
- [x] Vista detalle con tabs: Información | Costos y Precios | Stock
- [x] Tab Costos y Precios: tabla de N listas con markup editable + cálculos live (PV, PV+IVA, CM, Margen%)
- [x] Tab Stock: resumen (actual/inicial/mínimo/valuado) + tabla de movimientos con badges de tipo
- [x] Badges de stock bajo en tabla y detalle
- [x] Margin color coding (rojo <20%, amarillo <30%, verde >=30%)
- [x] Soft delete / hard delete pattern (hard solo si no hay ventas/compras)

**Archivos creados:**
- `src/lib/validators/productos.ts`
- `src/server/trpc/routers/productos.ts`
- `src/app/(dashboard)/productos/page.tsx`
- `src/app/(dashboard)/productos/components/product-dialog.tsx`
- `src/app/(dashboard)/productos/components/product-detail.tsx`
- `src/app/(dashboard)/productos/components/product-pricing-tab.tsx`
- `src/app/(dashboard)/productos/components/product-stock-tab.tsx`

**Dependencias:** mod-clasificaciones ✅, mod-proveedores ✅
**Alimenta a:** mod-ventas, mod-compras, mod-mercaderia
**Sesión esperada:** Sesión 3 (Opus) ✅

---

### mod-ventas ✅ DONE

**Completado en Sesión 4 (2025-02-25)**

- [x] Zod validators: createSale, updateSale, addSalePayment (Zod v4 — uses `message` instead of `required_error`)
- [x] tRPC router: 9 procedures — list, getById, getSummary, getProductPrice, create, update, delete, addPayment, removePayment
- [x] Backend calculation logic (all in `calcSaleDerived()` helper):
  - subtotal = unitPrice × quantity × (1 - discountPct/100)
  - ivaAmount = subtotal × ivaRate/100 (solo si RI)
  - total = subtotal + ivaAmount
  - variableCostTotal = unitCost × quantity
  - contributionMargin = subtotal - variableCostTotal
  - marginPct = CM / subtotal × 100
- [x] Sale creation:
  - Snapshots product unitCost at moment of sale
  - Creates StockMovement type="sale" with negative quantity
  - Creates inline SalePayments with auto-calculated accreditationDate
  - Derives initial status from payments vs total
- [x] Sale deletion: reverses stock movement (deletes linked StockMovement)
- [x] Sale payments:
  - addPayment: creates SalePayment, calculates accreditationDate = paymentDate + method.accreditationDays
  - removePayment: deletes and recalculates sale status
  - Auto-updates sale.status: pending → partial → paid / overdue
- [x] Status derivation: paid if totalPaid >= total, overdue if dueDate < today and not paid, partial if > 0 but < total
- [x] Página `/ventas`: tabla con columnas Fecha/Producto/Cliente/Cant./Subtotal/Total/CM/Estado/Fact.
- [x] Filtros: rango de fechas (date pickers), estado (pending/partial/paid/overdue)
- [x] Summary cards: Total Facturado, CM, Cobrado, Pendiente, Ticket Promedio
- [x] Status badges con colores: pending=amarillo, partial=azul, paid=verde, overdue=rojo
- [x] CSV export con 18 columnas
- [x] Dialog crear/editar:
  - Product select → auto-fill unitPrice from price list
  - Auto-set default price list + categoryId when product selected
  - Live preview: subtotal, IVA (if RI), total, costo variable, CM, margen%
  - Inline payments section: N payments con método + monto + fecha
  - Invoiced checkbox + invoice number field
- [x] Vista detalle:
  - Summary cards (Total, Cobrado, CM, Costo Variable)
  - Full sale info table
  - Payments table with accreditation dates
  - "Agregar Cobro" button opens dialog for post-sale payments
  - Remove payment with status recalculation

**Archivos creados:**
- `src/lib/validators/ventas.ts`
- `src/server/trpc/routers/ventas.ts`
- `src/app/(dashboard)/ventas/page.tsx`
- `src/app/(dashboard)/ventas/components/sale-dialog.tsx`
- `src/app/(dashboard)/ventas/components/sale-detail.tsx`

**Dependencias:** mod-productos ✅, mod-clasificaciones ✅
**Alimenta a:** mod-resumen, mod-flujo-fondos, mod-pos, mod-tablero
**Sesión esperada:** Sesión 4 (Opus) ✅

---

### mod-compras ✅ DONE

**Completado en Sesión 5 (2025-02-25)**

- [x] Zod validators: createPurchase, updatePurchase, addPurchasePayment (max 2 payments)
- [x] tRPC router: 7 procedures — list, getById, getSummary, create, update, delete, addPayment, removePayment
- [x] Backend calculation logic (all in `calcPurchaseDerived()` helper):
  - subtotal = unitCost × quantity × (1 - discountPct/100)
  - total = subtotal + ivaAmount (IVA is explicit, not calculated from taxStatus)
- [x] Purchase creation:
  - Optional product (can be a generic expense with description)
  - Optional supplier
  - Required costCategory (with costType: variable/fijo/impuestos)
  - Creates StockMovement type="purchase" with positive quantity (only if productId)
  - Updates Product.lastCostUpdate when purchase has product
  - Creates inline PurchasePayments with auto-calculated accreditationDate
  - Derives initial status from payments vs total
  - Max 2 inline payments (business rule)
- [x] Purchase deletion: reverses stock movement (deletes linked StockMovement)
- [x] Purchase payments:
  - addPayment: creates PurchasePayment, calculates accreditationDate
  - removePayment: deletes and recalculates purchase status
  - Auto-updates purchase.status: pending → partial → paid / overdue
- [x] Status derivation: same logic as ventas
- [x] Página `/compras`: tabla con columnas Fecha/Concepto/Proveedor/Categoría/Cant./Subtotal/Total/Estado
- [x] Filtros: búsqueda (descripción/factura), rango de fechas, estado
- [x] Summary cards: Total Egresos, Pagado, Pendiente, C. Variables/Fijos, Impuestos
- [x] CSV export con 16 columnas
- [x] Dialog crear/editar:
  - Supplier select (optional)
  - Cost category select (required, shows costType)
  - Product select (optional — "Sin producto" = generic expense)
  - Description field (required if no product)
  - Invoice number, date, due date
  - 4-column: quantity, unit cost, discount %, IVA ($)
  - Live preview: subtotal, IVA, total, stock impact indicator
  - Inline payments section: max 2 payments
- [x] Vista detalle:
  - Summary cards (Total, Pagado, Concepto, Proveedor)
  - Full purchase info table
  - Payments table with accreditation dates
  - "Agregar Pago" button opens dialog for post-purchase payments
  - Remove payment with status recalculation

**Archivos creados:**
- `src/lib/validators/compras.ts`
- `src/server/trpc/routers/compras.ts`
- `src/app/(dashboard)/compras/page.tsx`
- `src/app/(dashboard)/compras/components/purchase-dialog.tsx`
- `src/app/(dashboard)/compras/components/purchase-detail.tsx`

**Dependencias:** mod-proveedores ✅, mod-productos ✅, mod-clasificaciones ✅
**Alimenta a:** mod-resumen, mod-flujo-fondos, mod-cuentas
**Sesión esperada:** Sesión 5 (Opus) ✅

---

### mod-mercaderia ✅ DONE

**Completado en Sesión 6 (2025-02-25)**

- [x] Zod validators: createMerchandiseEntry, createStockAdjustment (with adjustmentType enum: recount/loss/damage/other)
- [x] tRPC router: 5 procedures — listMovements, getStockSummary, createEntry, createAdjustment, deleteMovement
- [x] Two view modes:
  - **Movimientos**: Full log of ALL stock movements (initial, purchase, sale, merchandise_entry, adjustment) with filters by product, type, date range
  - **Stock por Producto**: Summary table with currentStock, minStock, unitCost, valuedStock, low-stock indicators
- [x] Merchandise entry (ingreso de mercadería):
  - Product select with auto-fill unitCost
  - Quantity + cost + date
  - Creates StockMovement type="merchandise_entry" with positive quantity
  - Live preview showing stock increase and value
- [x] Stock adjustment (ajuste manual):
  - Product select showing current stock
  - 4 adjustment types: Reconteo, Pérdida, Daño, Otro
  - Smart quantity input: Recount mode (enter absolute stock, system calculates delta) vs Loss/Damage mode (enter units lost)
  - Creates StockMovement type="adjustment" with calculated delta
  - Live preview showing current stock, adjustment delta, and final stock
  - Notes auto-prefixed with adjustment type label
- [x] Delete protection: only merchandise_entry and adjustment can be deleted from this module; sale/purchase movements show "Via Ventas"/"Via Compras" hint
- [x] Summary cards: Products count, Total stock valued, Low stock alerts
- [x] CSV export for both views (movements and stock summary)
- [x] Color-coded movement type badges (blue=initial, green=purchase, red=sale, purple=entry, amber=adjustment)
- [x] Low stock rows highlighted in red

**Archivos creados:**
- `src/lib/validators/mercaderia.ts`
- `src/server/trpc/routers/mercaderia.ts`
- `src/app/(dashboard)/mercaderia/page.tsx`
- `src/app/(dashboard)/mercaderia/components/entry-dialog.tsx`
- `src/app/(dashboard)/mercaderia/components/adjustment-dialog.tsx`

**Archivos modificados:**
- `src/server/trpc/router.ts` — Registered mercaderiaRouter
- `src/components/shared/sidebar.tsx` — Added Mercadería nav link

**Dependencias:** mod-productos ✅
**Alimenta a:** mod-resumen
**Sesión esperada:** Sesión 6 (Opus) ✅

---

## Fase 2: TIER 2 Análisis (TIER 1 debe estar 100% antes)

### mod-resumen ✅ DONE

**Completado en Sesión 7 (2025-02-25)**

- [x] tRPC router: 3 read-only procedures — incomeSummary, expenseSummary, economicStatement
- [x] Income summary:
  - Totals: sales, CM, paid, pending, avg ticket, margin %
  - Breakdown by product category (with % bar)
  - Breakdown by origin (Mayorista vs Minorista)
  - Sales mix by product (total, quantity, CM, margin%, % share)
- [x] Expense summary:
  - Totals: purchases, variable/fijo/impuestos, paid, pending
  - Breakdown by cost category (with cost type badge and % bar)
  - Breakdown by supplier
- [x] Economic statement (Estado de Resultados Económico):
  - Full waterfall: Ventas - CV = CM - CF = EBITDA - Impuestos = Resultado Neto
  - Color-coded (green/red for positive/negative)
  - 3 metrics: Índice de Variabilidad, Margen CM, Incidencia CF
- [x] Period selector with presets (Este Mes, Mes Anterior, Trimestre, Año)
- [x] 3-tab layout: Ingresos | Egresos | Estado Económico
- [x] All 3 data sources loaded in parallel (Promise.all)
- [x] No validators needed (read-only module)

**Archivos creados:**
- `src/server/trpc/routers/resumen.ts`
- `src/app/(dashboard)/resumen/page.tsx`

**Archivos modificados:**
- `src/server/trpc/router.ts` — Registered resumenRouter
- `src/components/shared/sidebar.tsx` — Added Resumen nav link

**Dependencias:** mod-ventas ✅, mod-compras ✅
**Alimenta a:** mod-tablero, mod-cuadro-resumen
**Sesión esperada:** Sesión 7 (Opus) ✅

---

### mod-estados-resultados ✅ DONE

**Completado en Sesión 8 (2025-02-25)**

- [x] tRPC router: 2 read-only procedures — financialStatement, annualGrid
- [x] Financial Statement (Estado Financiero):
  - Cash-based: uses accreditationDate (not transaction date)
  - Waterfall: Cobranzas acreditadas - Pagos acreditados = Superávit/Déficit
  - Breakdown by payment method for both collections and payments
  - Month + year selector
- [x] Annual Grid (Vista Anual):
  - 12-month horizontal table for Economic statement (Ventas, CV, CM, CF, EBITDA, Impuestos, Neto, Margen%)
  - 12-month horizontal table for Financial statement (Cobranzas, Pagos, Resultado)
  - Yearly totals column
  - Sticky first column for concept labels
  - Color-coded: green for positive, red for negative, margin color coding
  - Year selector
- [x] 4 annual summary cards: Ventas Anuales, Resultado Neto, Superávit Financiero, Margen CM
- [x] 2-tab layout: Estado Financiero | Vista Anual

**Archivos creados:**
- `src/server/trpc/routers/estados-resultados.ts`
- `src/app/(dashboard)/estados-resultados/page.tsx`

**Archivos modificados:**
- `src/server/trpc/router.ts` — Registered estadosResultadosRouter
- `src/components/shared/sidebar.tsx` — Added Estados nav link

**Dependencias:** mod-ventas ✅, mod-compras ✅, mod-resumen ✅
**Alimenta a:** mod-tablero, mod-cuadro-resumen
**Sesión esperada:** Sesión 8 (Opus) ✅

---

### mod-cuentas + mod-flujo-fondos ✅ DONE

**Completado en Sesión 9 (2025-02-25)**

- [x] Zod validators: createBankAccount, updateBankAccount, createCashFlowEntry
- [x] tRPC router: 7 procedures — listAccounts, createAccount, updateAccount, deleteAccount, getCashFlow, createEntry, deleteEntry, getBalancesSummary
- [x] Bank Account CRUD:
  - Name, initial balance, balance date
  - Current balance computed from initialBalance + manual entries (movementType: ingreso/egreso/apertura)
  - Soft deactivation (isActive toggle) + hard delete only if no entries
  - Entry count displayed per account
- [x] Cash Flow (Flujo de Fondos):
  - Unified view combining 3 sources: sale payments (cobranzas), purchase payments (pagos), manual entries
  - All movements use accreditationDate for placement
  - Period filters: month + year selectors
  - Bank account filter (specific account or "all")
  - Summary cards: Ingresos, Egresos, Neto, Movimientos count
  - Color-coded type badges (Ingreso=green, Egreso=red)
  - Origin badges: Venta (green), Compra (red), Manual (gray)
  - Delete only allowed for manual entries (auto-derived from sales/purchases protected)
- [x] Manual Cash Flow Entry:
  - Select bank account, date, type (ingreso/egreso), concept, amount, notes
  - Auto-defaults to single account if only one exists
  - Affects bank account balance immediately
- [x] Balances Summary:
  - Sum of all active accounts' current balances
  - Note: balance based on initialBalance + manual entries (auto-derived from payments not yet linked to specific bank accounts)
- [x] Página `/cuentas`: 2-tab layout (Cuentas | Flujo de Fondos)
- [x] 3 summary cards on Cuentas tab (active accounts, total balance, note)
- [x] 4 summary cards on Flujo tab (ingresos, egresos, neto, count)

**Archivos creados:**
- `src/lib/validators/cuentas.ts`
- `src/server/trpc/routers/cuentas.ts`
- `src/app/(dashboard)/cuentas/page.tsx`
- `src/app/(dashboard)/cuentas/components/account-dialog.tsx`
- `src/app/(dashboard)/cuentas/components/entry-dialog.tsx`

**Archivos modificados:**
- `src/server/trpc/router.ts` — Registered cuentasRouter
- `src/components/shared/sidebar.tsx` — Added Cuentas nav link

**Dependencias:** mod-ventas ✅, mod-compras ✅
**Alimenta a:** mod-cashflow, mod-tablero
**Sesión esperada:** Sesión 9 (Opus) ✅

---

### mod-cashflow ✅ DONE

**Completado en Sesión 10 (2025-02-25)**

- [x] Zod validators: upsertProjection, whatIfOverride (client-side type)
- [x] tRPC router: 3 procedures — getWeeklyProjection, getWeekDetail, upsertProjection
- [x] Weekly projection algorithm (Business Rule #12):
  - 4-5 weekly buckets per month (1-7, 8-14, 15-21, 22-28, 29+)
  - 5 data sources: sale payments (by accreditationDate), purchase payments (by accreditationDate), unpaid sales (by dueDate), unpaid purchases (by dueDate), manual CashFlowEntry
  - Items classified as "confirmed" (payment registered) vs "pending" (projected from due dates)
  - Running balance per week: opening + ingresos - egresos = closing
  - Opening balance: bank accounts' initial balance + manual entries before period + all prior sale/purchase payments
- [x] Week detail drill-down: click any week to see itemized list of all movements
- [x] Manual projection (Projection model): projectedSales, exchangeRate, notes — upserted per month
- [x] KPIs panel:
  - Real ingresos vs projected sales with % progress bar + color coding (red <70%, amber 70-100%, green 100%+)
  - USD conversion (neto en USD, saldo final en USD) when exchangeRate provided
  - Movement count and week count
- [x] Página `/cashflow`: weekly horizontal grid (sticky first column), summary cards (5: saldo inicial, ingresos, egresos, neto, saldo final), projection form, KPIs panel
- [x] Color legend: confirmed (solid) vs pending (italic/faded), saldo acumulado (blue)
- [x] Month navigation (anterior/hoy/siguiente buttons)

**Archivos creados:**
- `src/lib/validators/cashflow.ts`
- `src/server/trpc/routers/cashflow.ts`
- `src/app/(dashboard)/cashflow/page.tsx`

**Archivos modificados:**
- `src/server/trpc/router.ts` — Registered cashflowRouter
- `src/components/shared/sidebar.tsx` — Added Cashflow nav link

**Dependencias:** mod-cuentas ✅, mod-ventas ✅, mod-compras ✅
**Alimenta a:** mod-tablero
**Sesión esperada:** Sesión 10 (Opus) ✅

---

## Fase 3: Dashboard + POS

### mod-tablero ✅ DONE

**Completado en Sesión 11 (2025-02-25)**

- [x] tRPC router: 1 procedure — getDashboard (single aggregation query)
- [x] KPIs Row 1 (Sales): Ventas Totales, CM + Margen%, Cobrado + % del total, Pendiente de Cobro, Ticket Promedio
- [x] KPIs Row 2 (Expenses + Result): Egresos Totales, Costos Variables, Costos Fijos, Impuestos, Utilidad (CM - CF)
- [x] Charts:
  - Area chart: Ventas + CM por día (con gap-fill para días sin ventas)
  - Donut chart: Estado de cobro (Pendiente/Parcial/Cobrada/Vencida)
  - Horizontal bar chart: Top 5 productos por facturación (revenue + CM)
  - Donut chart: Egresos por tipo (Variables/Fijos/Impuestos)
- [x] Low Stock Alerts: tabla de productos bajo mínimo (producto, actual, mínimo, faltante)
- [x] Recent Activity: últimas 8 transacciones (ventas + compras) con tipo, concepto, monto, estado
- [x] Period presets: Este Mes, Mes Anterior, Trimestre, Año
- [x] Recharts library installed for chart rendering
- [x] Dashboard is first item in sidebar navigation

**Archivos creados:**
- `src/server/trpc/routers/tablero.ts`
- `src/app/(dashboard)/tablero/page.tsx`

**Archivos modificados:**
- `src/server/trpc/router.ts` — Registered tableroRouter
- `src/components/shared/sidebar.tsx` — Added Tablero as first nav item

**Dependencias:** mod-ventas ✅, mod-compras ✅, mod-productos ✅
**Alimenta a:** standalone (landing page)
**Sesión esperada:** Sesión 11 (Opus) ✅

---

### mod-cuadro-resumen ✅ DONE

**Completado en Sesión 12 (2025-02-25)**

- [x] tRPC router: 1 procedure — getScorecard (monthly projected vs real)
- [x] Main scorecard table (BR #13): 4 rows — Ventas, Rentabilidad (CM%), Utilidad (CM-CF), Utilidad USD
  - Each row: Proyectado | Real | Variación (with sign + color coding)
  - Projected values derived from Projection model (shared with mod-cashflow)
  - Projected utilidad = projectedSales × realMargin% - CF
  - USD conversion only when exchangeRate provided
- [x] Advancement bar: visual progress of real vs projected sales (green >= 100%, amber >= 70%, red < 70%)
- [x] 5 KPI cards: Ticket Promedio, CM Promedio, Cantidad Ventas, % Cobrado, Monto Pendiente
- [x] 4 context totals: Ventas Netas (s/IVA), CM Total, Total Cobrado, Costos Fijos del Mes
- [x] Editable projection form: inline projectedSales + exchangeRate + notes with save button
  - Reuses `cashflow.upsertProjection` mutation (shared Projection model)
- [x] Month/year selector with previous/today/next navigation
- [x] Margin color coding (red < 20%, amber < 30%, green >= 30%)
- [x] Collection status color coding (red < 70%, amber < 90%, green >= 90%)

**Archivos creados:**
- `src/server/trpc/routers/cuadro-resumen.ts`
- `src/app/(dashboard)/cuadro-resumen/page.tsx`

**Archivos modificados:**
- `src/server/trpc/router.ts` — Registered cuadroResumenRouter
- `src/components/shared/sidebar.tsx` — Added "Cuadro KPIs" nav link

**Dependencias:** mod-ventas ✅, mod-compras ✅, mod-cashflow ✅ (Projection model)
**Alimenta a:** standalone
**Sesión esperada:** Sesión 12 (Opus) ✅

---

### mod-pos ✅ DONE

**Completado en Sesión 13 (2025-02-25)**

- [x] Full-page streamlined POS layout (no dialog — dedicated page)
- [x] Product search by name, barcode, or SKU with 150ms debounce
- [x] Keyboard navigation in search dropdown (Arrow Up/Down, Enter, Escape)
- [x] Click-outside-to-close dropdown behavior
- [x] Price list selector at the top — auto-detects origin (minorista/mayorista) from list name
- [x] Live pricing fetch via `ventas.getProductPrice` when product + price list change
- [x] Selected product card showing: stock, unit cost, sale price, markup %
- [x] Quantity spinner (- / input / + buttons) + discount % input
- [x] Right panel with live calculations:
  - Subtotal (price x qty - discount)
  - Discount amount (if any)
  - Total (bold, green)
  - Variable cost, CM, margin % (color-coded)
- [x] Stock warnings:
  - Red alert if stock goes negative after sale
  - Amber alert if stock gets low after sale
- [x] Payment method selector (defaults to "Efectivo")
- [x] Confirm button with total amount shown
- [x] Reuses `ventas.create` mutation — no new backend code needed
- [x] Success screen with sale summary + "Imprimir Ticket" (placeholder) + "Nueva Venta" button
- [x] Session counters: sales count today + total amount today
- [x] Local stock update after sale (optimistic — no refetch needed)
- [x] Auto-focus on search input on page load and after "Nueva Venta"
- [x] Date badge in header showing current date

**Archivos creados:**
- `src/app/(dashboard)/pos/page.tsx`

**Archivos modificados:**
- `src/components/shared/sidebar.tsx` — Added "Punto de Venta" nav link

**No new backend code:** The POS reuses existing infrastructure:
- `ventas.create` for sale creation (with stock movement + inline payment)
- `ventas.getProductPrice` for price lookup
- `productos.list` for product search
- `productos.getPriceLists` for price lists
- `clasificaciones.listPaymentMethods` for payment methods

**Deferred to future:**
- Seller selection with commission % (requires AccountMember with commissionPct field)
- Client selection (optional — Client CRUD not built yet as standalone module)
- Receipt printing / PDF generation
- Touch-optimized responsive layout for tablet/mobile
- Barcode scanner hardware integration

**Dependencias:** mod-productos ✅, mod-ventas ✅, mod-clasificaciones ✅
**Alimenta a:** standalone
**Sesión esperada:** Sesión 13 (Opus) ✅

---

### mod-facturacion ✅ DONE

**Completado en Sesión 14 (2025-02-25)**

- [x] Prisma schema: AfipConfig model (CUIT, punto de venta, access token, cert, key, production flag)
- [x] Prisma schema: Invoice model (AFIP invoice type, number, CAE, amounts, customer, AFIP result)
- [x] Migration: `20260225220951_add_afip_invoicing` (2 new tables: afip_configs, invoices)
- [x] DB schema total: **21 tables** (was 19)
- [x] AFIP service wrapper (`src/server/services/afip.ts`):
  - Constants: invoice types (A/B/C), document types (CUIT/CUIL/DNI/Sin identificar), IVA aliquots
  - `createAfipClient()` — factory wrapping @afipsdk/afip.js SDK
  - `testAfipConnection()` — test AFIP server status
  - `getLastVoucherNumber()` — get last authorized invoice number
  - `createNextVoucher()` — create invoice with auto-increment, returns CAE
  - `getVoucherInfo()` — query existing invoice from AFIP
  - `determineInvoiceType()` — auto-determine A/B/C from account tax status + buyer document
  - `formatInvoiceNumber()` — format as XXXX-XXXXXXXX
  - `formatDateForAfip()` — format as YYYYMMDD
- [x] Zod validators: saveAfipConfig, createInvoice
- [x] tRPC router: 8 procedures — getConfig, saveConfig, testConnection, getLastNumber, getUninvoicedSales, create, list, getById, getSummary, getInvoiceTypeForAccount
- [x] Invoice creation flow:
  - Mode 1: From existing sale (auto-fills amounts from sale subtotal + IVA)
  - Mode 2: Manual (enter amounts directly)
  - Auto-determines invoice type (Monotributista → C, RI + CUIT → A, RI + other → B)
  - Calls AFIP via AfipSDK to create voucher and get CAE
  - Stores invoice with CAE in database
  - If linked to sale: updates sale.invoiced = true and sale.invoiceNumber
- [x] Página `/facturacion`: 2-tab layout (Facturas | Configuración AFIP)
- [x] Facturas tab:
  - Summary cards: Total Facturado, Neto Gravado, IVA, Comprobantes (with A/B/C breakdown)
  - Invoice type filter buttons (Todas / Fact. A / Fact. B / Fact. C)
  - Search by customer name, document number, or CAE
  - Table: Tipo (color badge), Número, Fecha, Cliente, Neto, IVA, Total, CAE, Venta asociada
  - Click row → invoice detail dialog
  - "Nueva Factura" button → creation dialog
- [x] Invoice creation dialog:
  - Invoice type badge (auto-determined, color-coded)
  - Mode selector: "Desde una Venta" / "Manual"
  - Sale selector with uninvoiced sales list (product name, amount, date, client)
  - Customer document type/number fields (CUIT/CUIL/DNI/Sin identificar)
  - Auto-fill customer info from sale's client
  - Amount fields: Neto, IVA, Total (auto-calculated from sale or manual entry)
  - Preview section with formatted summary
  - Submit → calls AFIP → shows result with CAE
- [x] Invoice detail dialog:
  - Invoice type badge + formatted number + date
  - Emisor section (account name + tax status)
  - Cliente section (name + document)
  - Amounts section (neto, exento, IVA, tributos, total)
  - AFIP data section: CAE, CAE expiration, result status (Aprobado/Rechazado badge), observations
  - Linked sale info (if applicable)
- [x] Config AFIP tab:
  - Status badges: Configurado/Sin configurar, Testing/Producción
  - Setup instructions box (how to get AfipSDK access token)
  - CUIT + Punto de Venta inputs
  - Access Token input (password field)
  - Certificate + Private Key textareas (PEM format, for production)
  - Production mode checkbox
  - Save + Test Connection buttons
  - Test result display (server status or error)

**Archivos creados:**
- `src/server/services/afip.ts` (AFIP service wrapper)
- `src/lib/validators/facturacion.ts`
- `src/server/trpc/routers/facturacion.ts`
- `src/app/(dashboard)/facturacion/page.tsx`
- `src/app/(dashboard)/facturacion/components/invoice-dialog.tsx`
- `src/app/(dashboard)/facturacion/components/afip-config-form.tsx`
- `src/app/(dashboard)/facturacion/components/invoice-detail.tsx`
- `prisma/migrations/20260225220951_add_afip_invoicing/migration.sql`

**Archivos modificados:**
- `prisma/schema.prisma` — Added AfipConfig + Invoice models + relations
- `src/server/trpc/router.ts` — Registered facturacionRouter
- `src/components/shared/sidebar.tsx` — Added "Facturacion" nav link

**Dependencies installed:**
- `@afipsdk/afip.js` — AFIP SDK for electronic billing (uses cloud proxy for SOAP/WSFE)

**Dependencias:** mod-ventas ✅, mod-clasificaciones ✅
**Alimenta a:** standalone
**Sesión esperada:** Sesión 14 (Opus) ✅

---

## Fase 4: Beta Testing + Pulido

### Infrastructure Fixes ✅ DONE

**Completado en Sesión 15 (2025-02-25)**

- [x] Fixed dev.db path mismatch — `prisma migrate dev` creates `dev.db` at project root, but `db.ts` was pointing to `prisma/dev.db` (0 bytes). Updated libsql adapter URL from `file:prisma/dev.db` to `file:dev.db`
- [x] Deleted stale empty `prisma/dev.db` placeholder
- [x] Seed script runs successfully — creates full test data (account, branch, 9 payment methods, 8 cost categories, 2 price lists, 4 product categories, 2 suppliers, 5 products with pricing + stock movements, 1 bank account)
- [x] Production build passes (`npx next build` — all 18 routes)
- [x] Root page redirects to `/tablero`
- [x] Created handoff document (`docs/HANDOFF-PROYECTO.md`)

### Testing & Feedback ⬜ PENDIENTE

- [ ] Deploy a staging (Vercel)
- [ ] Setup de 10 cuentas beta testers
- [ ] Recolección de feedback
- [ ] Bugs reportados
- [ ] Heatmaps (si recursos)

**Sesión esperada:** Sesión 16+

---

### Fixes & Polish ⬜ PENDIENTE

- [ ] Supabase Auth integration
- [ ] Migrate to PostgreSQL
- [ ] Tests (unit, integration, E2E)
- [ ] Responsive/mobile optimization
- [ ] Performance optimization
- [ ] Documentación de usuario

**Sesión esperada:** Sesión 17+

---

## Próximos pasos inmediatos

1. ✅ Fase 0 completada (schema, project setup)
2. ✅ Sesión 1 — mod-clasificaciones
3. ✅ Sesión 2 — mod-proveedores
4. ✅ Sesión 3 — mod-productos
5. ✅ Sesión 4 — mod-ventas
6. ✅ Sesión 5 — mod-compras (gemelo de ventas)
7. ✅ Sesión 6 — mod-mercaderia (último TIER 1)
8. ✅ Sesión 7 — mod-resumen (TIER 2 — reportes de ingresos/egresos/estado económico)
9. ✅ Sesión 8 — mod-estados-resultados (estado financiero + vista anual 12 meses)
10. ✅ Sesión 9 — mod-cuentas + mod-flujo-fondos (cuentas bancarias + flujo de fondos)
11. ✅ Sesión 10 — mod-cashflow (proyección semanal con KPIs y drill-down)
12. ✅ Sesión 11 — mod-tablero (dashboard con KPIs, 4 gráficos, alertas stock, actividad reciente)
13. ✅ Sesión 12 — mod-cuadro-resumen (cuadro KPIs mensuales: proyectado vs real)
14. ✅ Sesión 13 — mod-pos (punto de venta rápido — reuses ventas.create, no new backend)
15. ✅ Sesión 14 — mod-facturacion (facturación electrónica AFIP completa — AfipSDK + CAE)
16. **→ Próximo:** Fase 4 — Beta Testing + Pulido

---

## Notas

- **SQLite para dev, Postgres para prod:** El schema está diseñado para ser agnóstico. Al migrar a Supabase, solo agregamos:
  - DECIMAL types en lugar de Float
  - Generated columns para unit_cost
  - Views para reportes complejos
  - RLS policies

- **Contexto limpio por sesión:** Cada módulo abre en sesión NUEVA con su spec desde `/docs/specs/mod-xxx.md`

- **Seed data:** ✅ Implementado en `scripts/seed.ts`. Crea account, branch, 9 payment methods, 8 cost categories, 2 price lists, 4 product categories, 2 suppliers, 5 products con pricing y stock, 1 bank account. Ejecutar con `npx tsx scripts/seed.ts`.

---

*Documento vivo. Actualizar después de cada sesión de desarrollo.*
