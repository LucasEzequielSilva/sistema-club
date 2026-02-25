# Sistema Club MVP — Documento de Proyecto

**Cliente:** Mati  
**Fecha:** Febrero 2025  
**Estado:** Fase 3 completa (15 modulos). Listo para beta testing.

---

## 1. Que es este proyecto

Sistema de gestion financiera y operativa para PyMEs argentinas. Reemplaza un Excel de 15 hojas que Mati usa para manejar su club de suscripcion (~400 usuarios, $1.630/usuario/mes).

**El sistema cubre:**
- Gestion de productos con costos de 4 componentes y N listas de precios
- Ventas y compras con cobros/pagos parciales y acreditacion automatica
- Stock con trazabilidad PEPS (Primero Entrado, Primero Salido)
- Reportes economicos y financieros (estado de resultados mensual y anual)
- Cashflow semanal proyectado con saldo acumulado
- Dashboard con KPIs y graficos
- Punto de Venta rapido (POS)
- Facturacion electronica via AFIP (Factura A/B/C con CAE)
- Soporte para Monotributista y Responsable Inscripto (IVA)
- Multi-tenant (preparado para multiples cuentas/negocios)

---

## 2. Stack tecnologico

| Componente | Tecnologia | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.x |
| Lenguaje | TypeScript | 5.x |
| API | tRPC | 11.x |
| ORM | Prisma | 7.4 |
| Base de datos (dev) | SQLite | via libsql adapter |
| Base de datos (prod) | PostgreSQL + Supabase | Pendiente migrar |
| UI Components | shadcn/ui | latest |
| Estilos | Tailwind CSS | v4 |
| Validacion | Zod | v4 |
| Graficos | Recharts | v2 |
| Notificaciones | Sonner | latest |
| Facturacion AFIP | @afipsdk/afip.js | 1.2.x |
| Auth | Hardcoded (Supabase Auth pendiente) | - |

---

## 3. Como levantar el proyecto

### Requisitos previos
- Node.js >= 18
- npm

### Pasos

```bash
# 1. Clonar el repo
git clone <repo-url>
cd randazzo

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env (ya existe, pero verificar)
# DATABASE_URL="file:./dev.db"

# 4. Correr migraciones
npx prisma migrate dev

# 5. Generar Prisma Client
npx prisma generate

# 6. Poblar datos de prueba
npx tsx scripts/seed.ts

# 7. Levantar el servidor de desarrollo
npm run dev

# 8. Abrir en el navegador
# http://localhost:3000
```

### Build de produccion

```bash
npx next build
npx next start
```

---

## 4. Estructura del proyecto

```
randazzo/
├── prisma/
│   ├── schema.prisma          # Schema de BD (21 tablas)
│   ├── dev.db                 # SQLite para desarrollo
│   └── migrations/            # Migraciones SQL
│
├── scripts/
│   └── seed.ts                # Seed de datos de prueba
│
├── src/
│   ├── app/
│   │   ├── page.tsx           # Redirect a /tablero
│   │   ├── layout.tsx         # Root layout (Toaster)
│   │   ├── api/trpc/[trpc]/   # tRPC HTTP handler
│   │   └── (dashboard)/       # Todas las paginas del sistema
│   │       ├── layout.tsx     # Dashboard layout (sidebar)
│   │       ├── tablero/       # Dashboard principal
│   │       ├── clasificaciones/
│   │       ├── proveedores/
│   │       ├── productos/
│   │       ├── ventas/
│   │       ├── compras/
│   │       ├── mercaderia/
│   │       ├── resumen/
│   │       ├── estados-resultados/
│   │       ├── cuentas/
│   │       ├── cashflow/
│   │       ├── cuadro-resumen/
│   │       ├── pos/
│   │       └── facturacion/
│   │
│   ├── server/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── services/
│   │   │   └── afip.ts        # AFIP service wrapper
│   │   └── trpc/
│   │       ├── init.ts        # tRPC init (superjson + zod)
│   │       ├── router.ts      # Root router (14 sub-routers)
│   │       └── routers/       # Un router por modulo
│   │
│   ├── lib/
│   │   ├── trpc-client.ts     # tRPC client (frontend)
│   │   ├── utils.ts           # cn() utility
│   │   └── validators/        # Zod schemas por modulo
│   │
│   ├── components/
│   │   ├── shared/
│   │   │   └── sidebar.tsx    # Navegacion lateral
│   │   └── ui/                # shadcn components
│   │
│   └── generated/
│       └── prisma/            # Prisma Client generado
│
└── docs/
    ├── PROGRESS.md            # Estado de cada modulo
    ├── DECISIONS.md           # Decisiones arquitectonicas
    ├── BUSINESS-RULES.md      # 18 reglas de negocio
    ├── ERRORS.md              # Log de errores
    └── HANDOFF-PROYECTO.md    # Este documento
```

---

## 5. Base de datos (21 tablas)

### Core (3)
- `accounts` — Tenants (negocio). Tax status, IVA rate
- `branches` — Sucursales por cuenta
- `account_members` — Usuarios/vendedores

### Catalogos (5)
- `product_categories` — Categorias de productos (Alimentos, Bebidas...)
- `cost_categories` — Categorias de costos (Variable, Fijo, Impuestos)
- `payment_methods` — Medios de pago con dias de acreditacion
- `suppliers` — Proveedores
- `clients` — Clientes

### Productos (3)
- `products` — Productos con 4 componentes de costo + stock
- `price_lists` — Listas de precios (Minorista, Mayorista, N...)
- `price_list_items` — Markup % por producto por lista

### Transacciones (4)
- `sales` — Ventas con snapshot de costo
- `sale_payments` — Cobros parciales con fecha de acreditacion
- `purchases` — Compras/egresos con categoria de costo
- `purchase_payments` — Pagos parciales

### Stock (1)
- `stock_movements` — Log de movimientos (PEPS trazable)

### Finanzas (3)
- `bank_accounts` — Cuentas bancarias con saldo inicial
- `cash_flow_entries` — Movimientos manuales
- `projections` — Proyecciones mensuales (ventas, tipo de cambio)

### Facturacion (2)
- `afip_configs` — Credenciales AFIP por cuenta
- `invoices` — Facturas emitidas con CAE

---

## 6. Modulos — Que hace cada uno

### TIER 1: Core (6 modulos)

#### 1. mod-clasificaciones (`/clasificaciones`)
CRUD de categorias de productos, categorias de costos y medios de pago. Base para todo el sistema.

#### 2. mod-proveedores (`/proveedores`)
CRUD de proveedores con busqueda debounced, soft/hard delete, vista detalle con historial de compras.

#### 3. mod-productos (`/productos`)
CRUD de productos. Costo unitario = 4 componentes (adquisicion + materia prima + mano de obra + packaging). N listas de precios con markup editable. Stock calculado desde movimientos. Alertas de stock bajo.

#### 4. mod-ventas (`/ventas`)
Registro de ventas con snapshot de costo, movimiento de stock automatico, hasta 3 cobros parciales con acreditacion automatica. Estado derivado (pendiente/parcial/cobrada/vencida). Export CSV.

#### 5. mod-compras (`/compras`)
Gemelo de ventas para egresos. Compras de mercaderia o gastos genericos. Categoria de costo obligatoria (variable/fijo/impuestos). Hasta 2 pagos parciales.

#### 6. mod-mercaderia (`/mercaderia`)
Log completo de movimientos de stock + vista de stock por producto. Ingreso de mercaderia y ajustes manuales (reconteo, perdida, daño).

### TIER 2: Analisis (5 modulos)

#### 7. mod-resumen (`/resumen`)
3 tabs: Ingresos (desglose por categoria/producto), Egresos (por categoria de costo), Estado Economico (cascada: Ventas - CV = CM - CF = EBITDA - Imp = Neto).

#### 8. mod-estados-resultados (`/estados-resultados`)
Estado financiero (cash-based, usa fecha de acreditacion) + grilla anual de 12 meses (economico + financiero). 4 queries cargan todo el año.

#### 9. mod-cuentas (`/cuentas`)
2 tabs: Cuentas bancarias (CRUD + saldos) y Flujo de fondos (vista unificada de cobranzas + pagos + movimientos manuales).

#### 10. mod-cashflow (`/cashflow`)
Proyeccion semanal del flujo de fondos. 5 fuentes de datos, saldo acumulado, drill-down por semana, proyecciones editables, KPIs con avance % y conversion USD.

#### 11. mod-tablero (`/tablero`)
Dashboard con 10 KPIs, 4 graficos (ventas diarias, estado de cobro, top productos, egresos por tipo), alertas de stock bajo, actividad reciente.

### TIER 3: Dashboard + POS + Facturacion (4 modulos)

#### 12. mod-cuadro-resumen (`/cuadro-resumen`)
Cuadro KPI mensual: Proyectado vs Real vs Variacion para Ventas, Rentabilidad, Utilidad, Utilidad USD. Barra de avance. Proyeccion editable.

#### 13. mod-pos (`/pos`)
Punto de venta rapido. Busqueda de productos por nombre/codigo de barras, selector de lista de precios, cantidad con +/-, calculo en vivo de total y margen, selector de medio de pago, confirmacion en 1 click. Reutiliza `ventas.create` — cero codigo backend nuevo.

#### 14. mod-facturacion (`/facturacion`)
Facturacion electronica AFIP. Configuracion de credenciales (CUIT, certificado, clave). Emision de Factura A/B/C con obtencion de CAE. Tipo auto-determinado segun regimen fiscal + documento del comprador. Vinculacion con ventas.

---

## 7. Reglas de negocio clave

| # | Regla | Detalle |
|---|---|---|
| 1 | IVA por regimen | Monotributista: sin IVA explicito. RI: IVA 21% separado |
| 2 | Costo unitario | 4 componentes: adquisicion + materia prima + mano de obra + packaging |
| 3 | Listas de precios | PV = unitCost × (1 + markup%). N listas, cada producto tiene su markup |
| 4 | Margen | CM = PV - Costo. Margin% = CM / PV × 100. Rojo <20%, Amarillo <30%, Verde >=30% |
| 5 | Stock PEPS | Cada movimiento logueado. currentStock = initial + SUM(movements) |
| 6 | Cobros parciales | Hasta 3 por venta, 2 por compra. Acreditacion = fecha + dias del metodo |
| 7 | Estado derivado | pending/partial/paid/overdue — calculado automaticamente |
| 8 | Estado economico | Usa subtotal (neto, sin IVA). IVA es pass-through para RI |
| 9 | Estado financiero | Usa fecha de acreditacion, no fecha de transaccion |
| 10 | Factura AFIP | Monotributista → C, RI + CUIT → A, RI + consumidor → B |

Ver `docs/BUSINESS-RULES.md` para las 18 reglas completas.

---

## 8. Patron de desarrollo de cada modulo

Todos los modulos siguen el mismo patron:

```
1. Zod validators   → src/lib/validators/{modulo}.ts
2. tRPC router      → src/server/trpc/routers/{modulo}.ts
3. Registrar router → src/server/trpc/router.ts
4. Pagina           → src/app/(dashboard)/{modulo}/page.tsx
5. Componentes      → src/app/(dashboard)/{modulo}/components/
6. Actualizar docs  → docs/PROGRESS.md + docs/DECISIONS.md
```

**Convenciones:**
- Todo el texto de la UI esta en español
- `ACCOUNT_ID = "test-account-id"` hardcodeado (se reemplaza con Supabase Auth)
- Soft delete con campo `isActive`. Hard delete solo si no hay dependencias
- Calculos en backend (tRPC helpers), no en DB
- Toasts con Sonner para feedback
- Debounce de 300ms en busquedas

---

## 9. Decisiones arquitectonicas importantes

1. **tRPC sobre REST** — Type safety end-to-end, sin duplicar tipos
2. **SQLite para dev, Postgres para prod** — Rapido en local, escalable en produccion
3. **Prisma 7 con adapter libsql** — El engine "client" de Prisma 7 requiere adapter para SQLite
4. **Pagos normalizados** — Tablas separadas (sale_payments, purchase_payments) en vez de columnas repetidas
5. **N listas de precios** — Flexible, no limitado a 2 fijas
6. **Stock via movimientos** — No campo almacenado, siempre calculado. Trazabilidad PEPS
7. **Precios calculados en backend** — Dependen de cross-table joins, no son generated columns
8. **AfipSDK como proxy SOAP** — Evita implementar WSAA/WSFE directo (SOAP + XML signing)
9. **POS reutiliza ventas.create** — El POS es puramente UI, cero backend nuevo

Ver `docs/DECISIONS.md` para el detalle completo de cada sesion.

---

## 10. Lo que falta hacer

### Prioridad Alta
- [ ] **Supabase Auth** — Reemplazar `ACCOUNT_ID` hardcodeado con auth real
- [ ] **Migrar a PostgreSQL** — Cambiar de SQLite a Supabase Postgres
- [ ] **RLS (Row Level Security)** — Seguridad a nivel de fila por account_id
- [ ] **Deploy a Vercel** — Staging environment para beta testing

### Prioridad Media
- [ ] **Tests** — Unitarios (Zod validators), integracion (tRPC), E2E (Playwright)
- [ ] **Responsive/Mobile** — El POS y otras paginas necesitan optimizacion movil
- [ ] **Impresion de tickets** — Integracion con impresora termica o browser print
- [ ] **PDF de facturas** — Generacion de PDF con datos AFIP y codigo de barras CAE
- [ ] **Clientes como modulo independiente** — CRUD de clientes (la tabla existe, falta la UI)
- [ ] **Vendedores con comision** — AccountMember con commissionPct para el POS

### Prioridad Baja
- [ ] **Notas de Credito/Debito** — El schema soporta los tipos, falta la UI
- [ ] **Multi-sucursal activo** — branch_id existe en las tablas, falta filtrar por sucursal
- [ ] **Onboarding wizard** — Flujo guiado para nuevas cuentas
- [ ] **Exportar reportes a PDF/Excel**
- [ ] **Notificaciones por email** — Cobros vencidos, stock bajo

---

## 11. Metodologia de trabajo

El proyecto se desarrollo en **15 sesiones** siguiendo una metodologia de modulos incrementales:

| Sesion | Modulo | Tier |
|---|---|---|
| 0 | Setup (schema, proyecto) | Fundacion |
| 1 | mod-clasificaciones | TIER 1 Core |
| 2 | mod-proveedores | TIER 1 Core |
| 3 | mod-productos | TIER 1 Core |
| 4 | mod-ventas | TIER 1 Core |
| 5 | mod-compras | TIER 1 Core |
| 6 | mod-mercaderia | TIER 1 Core |
| 7 | mod-resumen | TIER 2 Analisis |
| 8 | mod-estados-resultados | TIER 2 Analisis |
| 9 | mod-cuentas + mod-flujo | TIER 2 Analisis |
| 10 | mod-cashflow | TIER 2 Analisis |
| 11 | mod-tablero | TIER 3 Dashboard |
| 12 | mod-cuadro-resumen | TIER 3 KPIs |
| 13 | mod-pos | TIER 3 POS |
| 14 | mod-facturacion | TIER 3 Facturacion |

**Principios seguidos:**
- Cada modulo se construye sobre los anteriores (dependencias claras)
- TIER 1 debe estar 100% antes de empezar TIER 2
- Documentacion actualizada despues de cada sesion
- Business rules del Excel de Mati como fuente de verdad
- Si algo conflictua con las reglas de negocio, las reglas ganan

---

## 12. Para el desarrollador que toma el proyecto

### Donde empezar
1. Lee `docs/BUSINESS-RULES.md` — Entende las 18 reglas de negocio
2. Lee `docs/DECISIONS.md` — Entende por que se hicieron las cosas asi
3. Mira cualquier router en `src/server/trpc/routers/` — Todos siguen el mismo patron
4. El modulo mas simple es `clasificaciones`, el mas complejo es `cashflow`

### Cosas a tener en cuenta
- Prisma 7 usa engine "client" que necesita adapter. No se puede volver al engine binario sin cambiar el generator
- Zod v4 usa `message` en vez de `required_error` para `z.coerce.date()` y `z.enum()`
- La tabla `Sale` NO tiene campo `total` — siempre se calcula: `unitPrice × quantity × (1 - discountPct/100)`
- Los calculos de precio (`calcUnitCost`, `calcSaleDerived`, etc.) estan duplicados en varios routers — esta bien para el MVP, extraer a shared helpers en refactor
- El seed script (`scripts/seed.ts`) crea un account completo con productos de prueba

### Para migrar a Supabase/Postgres
1. Cambiar `provider = "sqlite"` a `provider = "postgresql"` en schema
2. Reemplazar `Float` por `Decimal` donde corresponda
3. Configurar `datasource.url` en `.env` con la connection string de Supabase
4. Crear views de Postgres (v_current_stock, v_sales_summary, etc.)
5. Implementar RLS policies por `account_id`
6. Reemplazar `@prisma/adapter-libsql` por `@prisma/adapter-pg` o el adapter de Supabase

---

*Documento generado el 25 de febrero de 2025.*
