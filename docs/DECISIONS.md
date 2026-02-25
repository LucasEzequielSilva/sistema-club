# Decisiones Arquitectónicas — Sistema Club MVP

## [2025-02-25] SCHEMA DATABASE - Normalización y Multi-Tenancy

**Contexto**: El playbook proponía un schema flat (inspirado en el Excel de 15 hojas) que no escala ni es type-safe. Necesitábamos decisiones clave sobre estructura, normalizaciones y representación de datos.

**Decisiones tomadas:**

### 1. Separar `classifications` en 3 tablas
- ✅ `product_categories` — Clasificaciones de productos (Ropa, Alimentos, etc)
- ✅ `cost_categories` — Clasificaciones de costos (Variable, Fijo, Impuestos)
- ✅ `payment_methods` — Medios de pago/cobro (Efectivo, Cheque, etc)

**Razón**: Son conceptos completamente distintos con campos y comportamientos diferentes. Mezclarlos genera nullable fields innecesarios y queries confusas.

### 2. Normalizar pagos parciales a tablas separadas
- ✅ `sale_payments` para cobros parciales de ventas
- ✅ `purchase_payments` para pagos parciales de compras

**Razón**: El Excel tiene hasta 3 cobros por venta. Columnas repetidas (payment_1, payment_2, payment_3) son patrón de hoja de cálculo, no de DB. Tablas separadas permiten N pagos sin migración futura.

### 3. Tabla `clients` dedicada
- ✅ Clientes como entidad de primera clase, no solo texto libre

**Razón**: Permite reportes por cliente, historial de compras, CRM básico. Escalable.

### 4. `price_lists` flexible (N listas, no 2 fijas)
- ✅ `price_lists` + `price_list_items` separadas
- ✅ Cada producto puede tener N precios según lista

**Razón**: MVP tiene Minorista + Mayorista. Futuro puede ser Online, Exportación, etc. Tablas separadas lo permiten sin schema changes.

### 5. Tabla `branches` para sucursales reales
- ✅ Multi-sucursal: Account > Branches > Members, Sales, Stock
- ✅ `branch_id` en sales, purchases, stock_movements

**Razón**: No es solo campo de texto en account_members. Es entidad real con transacciones propias.

### 6. `stock_movements` para PEPS trazable
- ✅ Log de cada movimiento de stock (compra, venta, ajuste, mercadería)
- ✅ Cada movimiento guarda su unit_cost (snapshot para PEPS)

**Razón**: Sin esto, no hay forma de implementar PEPS (Primero Entrado, Primero Salido) ni trazabilidad de costos históricos.

### 7. `unit_cost` como GENERATED COLUMN (cuando migremos a Postgres)
- ✅ En Prisma schema: `acquisition_cost + raw_material_cost + labor_cost + packaging_cost`
- ✅ Siempre consistente, sin código backend

**Razón**: Field calculado de forma determinística. Generated columns garantizan consistencia. Postgres lo soporta nativamente.

### 8. Precios calculados en backend (tRPC), no en DB
- ✅ `sale_price = unit_cost × (1 + markup_pct)`
- ✅ `sale_price_with_iva = sale_price × (1 + iva_rate)` [solo si RI]
- ✅ `contribution_margin = sale_price - unit_cost`

**Razón**: Dependen de cross-table joins (account.tax_status, product.unit_cost, price_list_item.markup_pct). Postgres no soporta generated columns con JOINs. Backend las calcula y las cachea en el cliente.

### 9. Views de Postgres para reportes complejos
- ✅ `v_current_stock` — Stock actual por producto
- ✅ `v_sales_summary` — Ventas con cálculos (subtotal, IVA, CM)
- ✅ `v_purchases_summary` — Compras con cálculos
- ✅ `v_bank_balances` — Saldos bancarios actuales

**Razón**: Encapsulan JOINs y agregaciones complejas. Cuando migremos a Postgres, estas views aceleran reportes.

### 10. RLS (Row Level Security) + Prisma filtering (doble capa)
- ✅ Supabase RLS policies en cada tabla con `account_id`
- ✅ Prisma queries filtran automáticamente por account

**Razón**: Safety net. Si olvidás un filtro en Prisma, RLS previene data leak. Si RLS falla, Prisma filtra. Belt and suspenders.

### 11. SQLite local para desarrollo, Postgres para prod
- ✅ Fase 0-1: SQLite (`dev.db`)
- ✅ Fase 2+: Migrar a Postgres (Supabase)

**Razón**: SQLite no soporta generated columns ni RLS, pero es ideal para desarrollo local rápido. Migramos a Postgres cuando pasemos a beta testing (necesitamos multi-user y RLS).

### 12. Seed data con defaults
- ✅ Cada cuenta nueva recibe 9 payment_methods pre-cargados (Efectivo, Cheque, Cheque Dif 30/45/60, etc)
- ✅ 2 price_lists por defecto (Minorista, Mayorista)
- ✅ 8 cost_categories (Costo de mercadería, Alquiler, Servicios, etc)

**Razón**: El usuario no tiene que crear todo desde cero. Acelera onboarding.

## Alternativas descartadas

| Alternativa | Por qué NO |
|---|---|
| JSONB para pagos | Pierde integridad referencial, queries complejas, no escalable |
| 1 tabla super-flat con discriminator types | Type-unsafe, campos nullable por doquier, pesadilla de mantener |
| Columnas repetidas (payment_1, payment_2, payment_3) | Denormalizado, límite artificial, migraciones futuras horror |
| clients solo como texto libre | No permite reportes, no es reutilizable |
| 2 markups fijos en products | No escala a más listas, futura migración necesaria |
| branch como texto simple | No permite stock por sucursal, reportes por sucursal |
| Todos los cálculos en Postgres | Algunos cálculos necesitan lógica de negocio compleja (IVA RI vs Mono) |

## Impacto en otros módulos

- **mod-productos**: Depende del schema. Una vez que schema esté locked, implementar es trivial.
- **mod-ventas**: Depende de products, price_lists, payment_methods. El schema define todo.
- **mod-compras**: Ídem, depende del schema.
- **mod-tablero**: Los JOINs que necesita están en las views de Postgres.
- **mod-pos**: Necesita lógica de cálculo de precios. Usará las funciones que definiremos en `lib/calculations.ts`.

---

## [2025-02-25] SESIÓN 1 - tRPC + shadcn/ui Implementation

**Contexto**: Implementación del primer módulo (mod-clasificaciones). Necesitábamos validar que el stack arquitectónico funcione en práctica.

**Decisiones tomadas:**

### 1. tRPC como API framework
- ✅ Elegimos **tRPC** sobre REST API
- **Razón**: Type safety end-to-end, auto-generación de tipos, mejor DX
- **Alternativas descartadas**: REST API (menos type-safe), GraphQL (over-engineered)

### 2. Validación con Zod en frontend + backend
- ✅ Zod validators en `src/lib/validators/`
- ✅ Re-validación en tRPC procedures
- **Razón**: Type safety + runtime safety, lightweight

### 3. Soft delete con `isActive` field
- ✅ `isActive` BOOLEAN en ProductCategory, CostCategory, PaymentMethod
- ✅ Hard delete solo si NO hay dependencias
- **Razón**: Mantiene historial, no pierde referencias

### 4. Toasts con Sonner (no React-Toastify)
- ✅ **Sonner** para notificaciones
- **Razón**: UX mejor, stacking automático, moderno

### 5. UI con shadcn/ui (no Material-UI)
- ✅ **shadcn/ui** para componentes
- **Razón**: Lightweight, customizable, copy-paste code, mejor para Tailwind v4

### 6. Dialogs reutilizables con props
- ✅ ProductCategoryDialog, CostCategoryDialog, PaymentMethodDialog
- **Razón**: Patrón limpio, reutilizable, fácil de mantener

### 7. Account ID hardcodeado (por ahora)
- ✅ `const ACCOUNT_ID = "test-account-id"`
- ✅ Será reemplazado por session/context en auth
- **Razón**: MVP sin auth aún, permite testear toda la lógica

### 8. Seed script en TypeScript (no SQL)
- ✅ `scripts/seed.ts` con Prisma
- ✅ Crea 9 PaymentMethods + 8 CostCategories por defecto
- **Razón**: Type-safe, reutilizable, documentado

---

## [2025-02-25] SESIÓN 3 - mod-productos Implementation

**Contexto**: Módulo más complejo del TIER 1. Implementa toda la lógica de costos, precios, márgenes y stock.

**Decisiones tomadas:**

### 1. All pricing calculations in `calcPricing()` helper
- ✅ Helper function in tRPC router calculates unitCost, salePrice, salePriceWithIva, CM, marginPct
- ✅ IVA extraction from cost when `includeIvaInCost = true` (for RI accounts)
- **Razón**: Centralized calculation logic, consistent across list and detail views

### 2. Auto-create PriceListItems on product creation
- ✅ When a product is created, PriceListItems are created for ALL active price lists (with 0% markup)
- **Razón**: Ensures every product appears in every list. User only needs to set markups.

### 3. Initial stock creates a StockMovement
- ✅ If `initialStock > 0`, a StockMovement with type="initial" is created
- **Razón**: All stock changes flow through stock_movements for PEPS traceability

### 4. currentStock computed from initialStock + SUM(movements)
- ✅ `currentStock = product.initialStock + SUM(stockMovements.quantity)`
- ✅ Computed via Prisma `groupBy` / `aggregate` at query time
- **Razón**: No stored field to get out of sync. Single source of truth.

### 5. Low stock filter is post-computation
- ✅ `lowStockOnly` filter applied AFTER computing currentStock (not in SQL)
- **Razón**: currentStock is computed from aggregation, can't filter in WHERE clause

### 6. Live pricing preview in markup editor
- ✅ Pricing tab recalculates PV/CM/margin% live as user types markup
- ✅ Save button appears only when changes detected (dirty state)
- **Razón**: Immediate feedback, user sees impact of markup changes before saving

### 7. Margin color coding convention
- ✅ Red < 20%, Amber 20-30%, Green >= 30%
- **Razón**: Quick visual indicator of profitability health

### 8. Bulk upsert for pricing updates
- ✅ `updatePricing` mutation upserts PriceListItems (creates if missing, updates if exists)
- **Razón**: Handles both existing and new price list items cleanly

---

## [2025-02-25] SESIÓN 4 - mod-ventas Implementation

**Contexto**: Módulo crítico que reemplaza "Carga Ingresos" del Excel. Primer módulo transaccional — establece el patrón para mod-compras.

**Decisiones tomadas:**

### 1. unitCost snapshot at sale creation
- ✅ When a sale is created, the product's current unitCost is computed and stored in `sale.unitCost`
- ✅ This snapshot is immutable — changing the product's cost later does NOT affect historical sales
- **Razón**: Business Rule #18 — historical integrity for margin calculations

### 2. Stock movement created atomically with sale
- ✅ `StockMovement` with `type="sale"`, `quantity=-N`, `referenceType="sale"`, `referenceId=sale.id`
- ✅ On sale deletion, the linked StockMovement is also deleted (stock reverts)
- **Razón**: Every stock change must be traceable (PEPS). Deletion reverses the effect.

### 3. Payments with accreditation date auto-calculation
- ✅ `accreditationDate = paymentDate + paymentMethod.accreditationDays`
- ✅ Calculated server-side when payment is created (not stored in advance)
- **Razón**: Different payment methods have different clearance times. This feeds into cashflow projections.

### 4. Sale status derived from payments
- ✅ Status is recalculated every time a payment is added/removed
- ✅ `paid` if totalPaid >= total, `overdue` if dueDate < today and not paid, `partial` if 0 < paid < total, `pending` if 0
- **Razón**: Status must always reflect reality. No manual status management needed.

### 5. Price auto-fill from price list
- ✅ When user selects product + price list, `unitPrice` auto-fills via `getProductPrice` query
- ✅ User can override the price manually (the auto-fill is a suggestion, not enforced)
- **Razón**: Speed up data entry while allowing flexibility for negotiated prices

### 6. Inline payments on sale creation
- ✅ Payments can be added at sale creation time (in the same dialog)
- ✅ Post-creation payments via separate "Agregar Cobro" dialog in detail view
- **Razón**: Most sales at Mati's club are paid immediately. Separate flow for deferred payments.

### 7. Zod v4 compatibility
- ✅ Discovered that Zod v4 uses `message` instead of `required_error` for `z.coerce.date()` and `z.enum()`
- **Razón**: Project uses latest Zod (v4). This was a breaking change from v3.

### 8. CSV export in page (not backend)
- ✅ Client-side CSV generation using Blob API
- ✅ 18 columns covering all sale fields and derived calculations
- **Razón**: Simple, fast, no backend endpoint needed. Sufficient for MVP export needs.

### 9. getSummary as separate procedure
- ✅ Dedicated `getSummary` tRPC procedure for footer totals (total sales, CM, paid, pending, avg ticket)
- ✅ Called in parallel with `list` to avoid blocking
- **Razón**: Summary needs to aggregate all filtered data, not just the visible page. Separate query allows independent optimization.

---

## [2025-02-25] SESIÓN 5 - mod-compras Implementation

**Contexto**: Módulo gemelo de mod-ventas. Registra egresos (compras de mercadería + gastos operativos). Alimenta stock, estados de resultados, y flujo de fondos.

**Decisiones tomadas:**

### 1. Purchase can be product OR generic expense
- ✅ `productId` is optional — if null, it's a non-product expense (rent, utilities, taxes)
- ✅ `description` field required when no product selected
- ✅ Stock movement only created when `productId` is present
- **Razón**: Purchases in Excel cover both merchandise and operating expenses. Single form handles both cases.

### 2. IVA as explicit amount (not derived from taxStatus)
- ✅ `ivaAmount` is a user-entered field (default 0), unlike sales where IVA is calculated from `account.taxStatus`
- **Razón**: Purchase invoices have explicit IVA amounts printed. User enters what the invoice says. No need for the system to guess.

### 3. Max 2 payment methods per purchase (business rule)
- ✅ Zod validator enforces `.max(2)` on payments array
- ✅ UI disables "add payment" button when 2 payments exist
- **Razón**: Business Rule #7 specifies max 2 payment methods for purchases (vs 3 for sales). Reflects real-world behavior.

### 4. Summary cards show cost type breakdown
- ✅ Summary shows totalVariable, totalFijo, totalImpuestos alongside total/paid/pending
- **Razón**: Essential for Estado de Resultados. User needs immediate visibility into cost structure.

### 5. Product.lastCostUpdate updated on purchase creation
- ✅ When a purchase with `productId` is created, `product.lastCostUpdate = now()`
- **Razón**: Tracks when cost information was last updated. Used in future for cost freshness indicators.

### 6. No CM calculation in purchases
- ✅ Unlike sales, purchases don't compute contribution margin
- **Razón**: CM is a sales concept (revenue - variable cost). Purchases ARE the cost side of the equation.

### 7. Search by description AND invoice number
- ✅ List filter uses OR across description and invoiceNumber fields
- **Razón**: Users search expenses by concept ("alquiler") or by invoice reference ("A-0001-00001234")

---

## [2025-02-25] SESIÓN 6 - mod-mercaderia Implementation

**Contexto**: Last TIER 1 module. Handles merchandise entry (production/manufacturing) and manual stock adjustments. All other modules generate stock movements automatically (initial, sale, purchase); this module handles the remaining two types.

**Decisiones tomadas:**

### 1. Two view modes: Movements log + Stock summary
- ✅ Tab-based switching between "Movimientos" (all movement types, full log) and "Stock por Producto" (aggregated stock per product)
- **Razón**: Two distinct user needs. Movements log answers "what happened?", stock summary answers "what do I have?"

### 2. Smart adjustment: Recount mode vs Delta mode
- ✅ For "Reconteo" (inventory recount): user enters absolute physical count, system computes delta = physicalCount - systemStock
- ✅ For "Pérdida"/"Daño"/"Otro": user enters units lost/damaged, system applies as negative delta
- **Razón**: Physical inventory counts are absolute ("I counted 47 units"), while loss/damage events are incremental ("3 units were damaged"). Different mental models, same underlying mechanism.

### 3. Adjustment notes auto-prefixed with type
- ✅ StockMovement notes auto-prefixed with `[Reconteo]`, `[Pérdida]`, `[Daño]`, or `[Otro]`
- **Razón**: When viewing movement log, the adjustment type is embedded in notes for quick identification without needing a separate column.

### 4. Delete protection by movement type
- ✅ Only `merchandise_entry` and `adjustment` can be deleted from this module
- ✅ `sale` and `purchase` movements show hint text ("Via Ventas" / "Via Compras") instead of delete button
- **Razón**: Prevents orphaned references. Sale/purchase movements are managed by their respective modules.

### 5. Movement log shows ALL types, not just this module's
- ✅ The movements view shows initial, purchase, sale, merchandise_entry, AND adjustment movements
- **Razón**: Central place to understand full stock history. Filters allow narrowing to specific types.

### 6. Stock summary uses same calcUnitCost as productos router
- ✅ Duplicated `calcUnitCost` helper in mercaderia router (acquisitionCost + rawMaterialCost + laborCost + packagingCost)
- **Razón**: Needed for valuedStock calculation. Minor duplication acceptable; will be extracted to shared helper when we refactor.

---

## [2025-02-25] SESIÓN 7 - mod-resumen Implementation

**Contexto**: First TIER 2 module. Aggregation/reporting layer that crunches sales + purchases data into summaries, breakdowns, and an economic statement.

**Decisiones tomadas:**

### 1. Read-only module, no validators
- ✅ All 3 procedures are queries, no mutations
- ✅ No Zod validator file created — input is just accountId + date range
- **Razón**: This module only reads and aggregates. No data modification.

### 2. Economic statement uses subtotal (net), not total (with IVA)
- ✅ "Ventas Netas" in the economic statement = sum of subtotals (without IVA)
- **Razón**: Business Rule #11 — the economic statement uses net revenue. IVA is a pass-through for RI, not real income.

### 3. Variable costs in economic statement = COGS + variable purchases
- ✅ totalCostosVariables = variableCostTotal from sales (unitCost * qty) + purchases classified as "variable"
- **Razón**: Full variable cost picture. COGS from sales is the primary driver, but other variable expenses (freight, packaging) also count.

### 4. Period presets for quick navigation
- ✅ This Month, Last Month, Quarter, Year buttons for quick period selection
- **Razón**: Most users want current month or last month. Manual date pickers are fallback.

### 5. Percentage bars in breakdown tables
- ✅ Visual % bars alongside numeric percentages in category/product breakdowns
- **Razón**: Quick visual scan of distribution. User can see dominant categories at a glance.

### 6. All 3 data sources loaded in parallel
- ✅ `Promise.all([incomeSummary, expenseSummary, economicStatement])` on every period change
- **Razón**: All tabs need the same date range. Loading all at once prevents per-tab loading delays.

---

## [2025-02-25] SESIÓN 8 - mod-estados-resultados Implementation

**Contexto**: Financial statement (cash-based) and annual comparison grid. Complements mod-resumen which handles single-period economic analysis.

**Decisiones tomadas:**

### 1. Financial statement uses accreditationDate, economic uses transaction date
- ✅ Financial: `accreditationDate` on SalePayment/PurchasePayment determines when money actually hit the account
- ✅ Economic: `saleDate`/`invoiceDate` determines when the transaction occurred
- **Razón**: Business Rule #11 — financial vs economic are fundamentally different views of the same data.

### 2. Annual grid loads all data in a single query then slices by month
- ✅ One DB query per table (sales, purchases, salePayments, purchasePayments) for the whole year, then JS loops over 12 months
- **Razón**: 4 queries vs 48 (4 per month × 12). Much more efficient. Data for a year fits easily in memory.

### 3. No Saldo Anterior in financial statement (deferred to mod-cuentas)
- ✅ Financial statement currently shows Cobranzas - Pagos = Superávit. No "Saldo Anterior" line.
- **Razón**: Opening balance requires bank account setup (mod-cuentas). Will be added when bank accounts exist.

### 4. Sticky first column in annual grid
- ✅ Concept labels (Ventas, CV, CM, etc.) use `sticky left-0` CSS
- **Razón**: 12-month + total = 13 data columns. Horizontal scrolling is inevitable; labels must stay visible.

---

## [2025-02-25] SESIÓN 9 - mod-cuentas + mod-flujo-fondos Implementation

**Contexto**: Bank accounts and cash flow management. Combines CRUD for bank accounts with a unified cash flow view that merges auto-derived sale/purchase payments with manual entries.

**Decisiones tomadas:**

### 1. Bank account balance = initialBalance + manual entries only
- Balance computation uses `initialBalance + SUM(CashFlowEntry)` where movementType is "ingreso"/"apertura" (adds) or "egreso" (subtracts)
- Auto-derived sale/purchase payments are NOT yet linked to specific bank accounts
- **Razón**: Linking payments to bank accounts requires modifying the SalePayment/PurchasePayment models (adding `bankAccountId`). Deferred to a future iteration. Current balance represents manual tracking.

### 2. Cash flow view unifies 3 sources
- Sale payments (cobranzas by accreditationDate)
- Purchase payments (pagos by accreditationDate)
- Manual CashFlowEntry records
- All sorted by date desc in a single table
- **Razón**: User needs one place to see all money movement. The origin (venta/compra/manual) is shown as a badge for context.

### 3. Only manual entries can be deleted from Cuentas module
- Auto-derived entries from sales/purchases are read-only in the cash flow view
- Deleting a sale/purchase payment must be done from the respective module
- Manual CashFlowEntry records can be deleted directly
- **Razón**: Same delete protection pattern as mod-mercaderia. Prevents orphaned references.

### 4. Hard delete for bank accounts only if zero entries
- If a BankAccount has any CashFlowEntries, deletion is blocked
- User must deactivate (soft delete via isActive=false) instead
- **Razón**: Prevents data loss. Consistent with the soft-delete-first pattern used across all modules.

### 5. Entry dialog defaults to single account
- If only one bank account exists, it's auto-selected in the entry dialog
- **Razón**: Most small businesses start with 1-2 accounts. Reduces friction.

### 6. Combined module (cuentas + flujo) in single page with tabs
- Tab 1 "Cuentas": Bank accounts list with CRUD + balance summary
- Tab 2 "Flujo de Fondos": Unified cash flow table with period/account filters
- **Razón**: These are tightly related concepts. Separate pages would create unnecessary navigation.

---

## [2025-02-25] SESIÓN 10 - mod-cashflow Implementation

**Contexto**: Weekly cash flow projection. The most algorithmically complex module — aggregates pending/confirmed payments into weekly buckets with running balances, KPIs, and manual projection targets.

**Decisiones tomadas:**

### 1. Weekly buckets follow Business Rule #12 exactly
- Week 1: days 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-28, Week 5: 29-end (only if month has >28 days)
- **Razón**: Rule #12 defines these fixed weekly boundaries, not ISO calendar weeks. Consistent with client's Excel convention.

### 2. Five data sources merged into unified flow
- Sale payments (confirmed inflows by accreditationDate)
- Purchase payments (confirmed outflows by accreditationDate)
- Unpaid sales (projected inflows by dueDate, amount = total - paid)
- Unpaid purchases (projected outflows by dueDate, amount = total - paid)
- Manual CashFlowEntry records
- **Razón**: Complete picture requires both confirmed and expected movements. The distinction (confirmed vs pending) is shown visually (solid vs italic).

### 3. Opening balance includes ALL prior period activity
- `openingBalance = SUM(bank initial balances) + SUM(manual entries before month) + SUM(prior sale payments) - SUM(prior purchase payments)`
- **Razón**: The running balance must reflect actual accumulated position, not just this month's activity.

### 4. What-if implemented as projection targets, not interactive sliders (MVP)
- Business Rule #12 called for interactive what-if sliders to move individual payment dates
- MVP implementation: manual projection fields (projectedSales, exchangeRate) with KPI comparison
- Full interactive what-if deferred to post-MVP
- **Razón**: Interactive date-dragging on individual payments requires complex state management and UI. The projection comparison (real vs projected + progress bar) covers 80% of the use case for much less complexity.

### 5. Sale total computed on-the-fly (Sale model has no `total` field)
- `saleTotal = unitPrice * quantity * (1 - discountPct / 100)`
- Helper function `calcSaleTotal()` used in both getWeeklyProjection and getWeekDetail
- **Razón**: Sale model stores components (unitPrice, quantity, discountPct) not derived totals. Consistent with existing pattern in other routers.

### 6. Week detail as drill-down dialog, not separate page
- Clicking any cell in the weekly grid opens a dialog with itemized movements for that week
- **Razón**: Quick inspection without losing context of the monthly view. Pattern consistent with product-detail and sale-detail drill-downs.

### 7. USD conversion only when exchangeRate provided
- KPIs panel shows neto/saldo in USD only if user set exchangeRate in projection
- **Razón**: Not all users need USD conversion. Graceful degradation.

---

## [2025-02-25] SESIÓN 11 - mod-tablero Implementation

**Contexto**: Main dashboard / landing page. Aggregates KPIs from sales, purchases, and stock into a visual overview with charts.

**Decisiones tomadas:**

### 1. Single getDashboard procedure with parallel fetches
- One tRPC query that does 5 parallel DB fetches (sales, purchases, stock, recent sales, recent purchases)
- All chart data computed in JS from the fetched records
- **Razón**: Single API call for the dashboard reduces round-trips. Parallel fetches within the procedure maximize throughput.

### 2. Recharts for charting library
- Installed `recharts` (v2) for all chart components (AreaChart, BarChart, PieChart)
- **Razón**: Most popular React charting library, SSR-compatible, good TypeScript support, composable API.

### 3. Recharts Tooltip formatter uses `any` types
- `formatter={(value: any, name: any) => ...}` instead of strict types
- **Razón**: Recharts v2 has overly strict union types for formatter that don't match actual runtime behavior. Using `any` avoids false type errors. Well-known community workaround.

### 4. Daily sales chart fills date gaps with zeros
- All days in the period are represented, even if no sales occurred
- **Razón**: Missing days create misleading gaps in area charts. Zero-fill shows the true rhythm of activity.

### 5. Tablero is first item in sidebar
- Moved to top of navItems array, above Clasificaciones
- **Razón**: Dashboard is the natural landing page. Users expect to see overview first.

### 6. Period presets instead of date pickers
- Este Mes, Mes Anterior, Trimestre, Año buttons
- **Razón**: Consistent with mod-resumen pattern. Quick selection covers 95% of use cases.

### 7. Stock alerts computed from ALL products (not period-filtered)
- Low stock check runs against all active products regardless of selected period
- **Razón**: Stock levels are point-in-time, not period-dependent. A product with low stock is low regardless of whether you're looking at this month or last quarter.

---

## [2025-02-25] SESIÓN 12 - mod-cuadro-resumen Implementation

**Contexto**: Monthly KPI scorecard comparing projected targets against real performance. Implements Business Rule #13 exactly.

**Decisiones tomadas:**

### 1. Shared Projection model with mod-cashflow
- Cuadro-resumen reads from the same `Projection` table that mod-cashflow writes to
- Save button calls `cashflow.upsertProjection` — no duplicate mutation
- **Razón**: Single source of truth for projections. DRY principle.

### 2. Projected utility derived from real margin rate
- `projectedUtilidad = projectedSales × (realRentabilidad / 100) - costosFijos`
- Assumes projected margin matches real margin rate
- **Razón**: Without a separate projected margin input, using actual margin rate is the best approximation. User controls the sales target; margin follows reality.

### 3. Variation column uses different formats per row
- Ventas: percentage variation (±%)
- Rentabilidad: percentage points (±pp)
- Utilidad: absolute currency difference (±$)
- USD: absolute USD difference (±USD)
- **Razón**: Each metric has a natural comparison unit. Mixing would be confusing.

### 4. No validators file for this module
- Read-only query with simple input (accountId, year, month)
- Projection saving reuses cashflow's validator
- **Razón**: No new mutation, no new input shapes. Avoids empty validator files.

---

## [2025-02-25] SESIÓN 13 - mod-pos Implementation

**Contexto**: Point-of-Sale module for fast sale entry. Optimized for speed and simplicity — cashier-oriented workflow vs the full-featured sale dialog.

**Decisiones tomadas:**

### 1. Full-page layout, not a dialog
- POS is a dedicated page (`/pos`) with a split layout: left panel for product search + selection, right panel for totals + payment + confirm
- **Razón**: A dialog constrains space. POS needs large touch targets, visible calculations, and no distractions. Full-page enables keyboard-first workflow.

### 2. No new backend code — reuses ventas.create entirely
- The POS page calls `ventas.create` with a single inline payment and `invoiced: false`
- Also reuses `ventas.getProductPrice`, `productos.list`, `productos.getPriceLists`, `clasificaciones.listPaymentMethods`
- **Razón**: The sale creation logic (stock movement, accreditation date, status derivation) is identical. No reason to duplicate backend code. The POS is purely a UI concern.

### 3. Client-side product search (not a new tRPC procedure)
- Products are loaded once on mount via `productos.list`, then filtered in-memory by name/barcode/SKU
- 150ms debounce on search input, max 10 results shown
- **Razón**: For MVP with ~100-500 products, in-memory search is instant. Avoids extra API calls on every keystroke. Can migrate to server-side search when product count exceeds ~2000.

### 4. Origin auto-derived from price list name
- If price list name contains "mayor" → origin = "mayorista", else "minorista"
- **Razón**: Convention-based derivation. Avoids separate origin selector since price list already implies the sale channel.

### 5. Payment defaults to "Efectivo"
- On mount, finds payment method named "Efectivo" and auto-selects it
- **Razón**: Most POS transactions are cash. Reduces clicks for the 80% case.

### 6. Success screen with "Nueva Venta" flow
- After confirming a sale, a success screen shows receipt-like summary + two buttons: "Imprimir Ticket" (placeholder) and "Nueva Venta" (resets form and focuses search)
- **Razón**: Clear confirmation that the sale went through. Quick reset for next customer in line. Print functionality deferred to when receipt printer integration is built.

### 7. Session counters (not persisted)
- Sales count and total amount accumulate in React state during the session
- Reset when page is refreshed/navigated away
- **Razón**: Quick at-a-glance visibility for the cashier. Persistent shift-based tracking would require a "Shift" model (deferred).

### 8. Deferred features
- **Seller selection**: Requires AccountMember setup with commissionPct field. Not built in MVP.
- **Client selection**: Client CRUD exists in schema but no standalone module yet. POS sends `clientId: null`.
- **Receipt printing**: Requires browser print API or thermal printer integration. Placeholder button.
- **Touch/mobile optimization**: Current layout is desktop-first with large buttons but not fully responsive.
- **Barcode scanner**: Standard USB scanners emit keystrokes, so the search input already handles it by default.

---

## [2025-02-25] SESIÓN 14 - mod-facturacion Implementation

**Contexto**: Full AFIP electronic invoicing (Factura A/B/C) via the `@afipsdk/afip.js` SDK. This module connects to AFIP's WSFE (Web Service de Facturación Electrónica) to create authorized invoices with CAE.

**Decisiones tomadas:**

### 1. AfipSDK cloud proxy over direct SOAP client
- Used `@afipsdk/afip.js` which proxies all AFIP SOAP calls through `app.afipsdk.com`
- Requires an AfipSDK access token (free tier for testing)
- **Razón**: Building a direct WSAA/WSFE SOAP client requires XML signing, certificate management, token caching — easily 500+ lines of complex code. The SDK abstracts all of this. Trade-off is third-party dependency, but it's the standard in the Argentine JS ecosystem.

### 2. Two new models: AfipConfig (per account) + Invoice
- `AfipConfig`: CUIT, punto de venta, access token, cert/key PEM, production flag
- `Invoice`: full AFIP invoice data (type, number, CAE, amounts, customer, result)
- DB total now 21 tables (was 19)
- **Razón**: Config is per-account (multi-tenant ready). Invoice stores the AFIP response (CAE, expiration, result) separately from the Sale model for clean separation.

### 3. Invoice type auto-determined from account + buyer document
- Monotributista account → always Factura C (11)
- RI account + buyer has CUIT → Factura A (1)
- RI account + buyer is consumer → Factura B (6)
- **Razón**: AFIP rules are deterministic. The system should auto-select the correct type rather than letting the user choose (and potentially get it wrong).

### 4. Certificate storage as PEM text in database
- Cert and private key stored as text fields in AfipConfig
- For testing: optional (AfipSDK handles test credentials)
- For production: required
- **Razón**: Portable, per-account, no filesystem dependency. For production with Supabase, would move to encrypted storage or vault.

### 5. Two creation modes: from sale or manual
- "From sale" auto-fills amounts from the sale's subtotal and calculated IVA
- "Manual" lets the user enter amounts directly (for invoices not linked to sales)
- **Razón**: Most invoices correspond to sales, but some may be standalone (advance payments, corrections, etc.)

### 6. Sale marked as invoiced after successful AFIP response
- Only if CAE is received (AFIP approved)
- Updates `sale.invoiced = true` and `sale.invoiceNumber = "B-0001-00000123"`
- **Razón**: The sale's simple `invoiced` flag is kept for backward compatibility with existing filters. The Invoice model has the full AFIP data.

### 7. Deferred features
- **Nota de Crédito / Débito**: Schema supports types 2/3/7/8/12/13, but UI only creates Facturas for MVP
- **Multi-punto de venta**: Config stores one punto de venta per account. Multi-PV would require UI to select
- **PDF generation**: AfipSDK has `createPDF()` but requires their premium tier. Deferred.
- **AFIP parameter caching**: Invoice types, document types, aliquots are hardcoded constants. Could query AFIP for dynamic lists.
- **Batch invoicing**: One at a time for now. Bulk invoice creation from multiple sales would be a future feature.

---

## [2025-02-25] SESIÓN 15 - Infrastructure Fix (dev.db path)

**Contexto**: Seed script failed with "no such table: main.accounts". Investigation revealed a path mismatch between Prisma CLI and the libsql runtime adapter.

**Decisiones tomadas:**

### 1. dev.db lives at project root, not prisma/
- `prisma migrate dev` with `DATABASE_URL="file:./dev.db"` creates the DB at the **project root** (`D:\Dev\randazzo\dev.db`), not inside `prisma/`
- The libsql adapter in `db.ts` was configured with `file:prisma/dev.db`, pointing to a 0-byte empty file
- Fixed to `file:dev.db` — both Prisma CLI and runtime adapter now point to the same file
- Deleted the stale `prisma/dev.db` placeholder
- **Razón**: Path resolution for `file:./dev.db` in `.env` is relative to CWD (project root), not relative to the prisma directory. The libsql adapter also resolves relative to CWD.

### 2. Seed script uses @/ path alias via tsx
- `npx tsx scripts/seed.ts` resolves `@/server/db` through tsconfig paths
- No special configuration needed — tsx handles tsconfig path aliases natively
- **Razón**: Keeps seed script consistent with the rest of the codebase. No need for separate tsconfig or raw relative imports.

---

*Documento vivo. Actualizar cuando se descubran nuevos requerimientos.*
