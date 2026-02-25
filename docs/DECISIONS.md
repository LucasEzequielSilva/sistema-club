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

*Documento vivo. Actualizar cuando se descubran nuevos requerimientos.*
