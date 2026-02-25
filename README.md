# Sistema Club MVP

**Gestión financiera y operativa para pymes argentinas** — Reemplaza un Excel de 15 hojas con un sistema modular, escalable y tipo-seguro.

---

## 🎯 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. View database (Prisma Studio)
npx prisma studio
```

App: http://localhost:3000
Database: http://localhost:5555 (Prisma Studio)

---

## 📋 Documentación

| Archivo | Contenido | Lee cuando |
|---|---|---|
| **SETUP.md** | Setup local + stack | Primera vez |
| **FASE0-RESUMEN.txt** | Estado actual + plan | Necesitas contexto rápido |
| **/docs/PROGRESS.md** | Estado de módulos (13 en total) | Quieres saber qué falta |
| **/docs/DECISIONS.md** | Decisiones arquitectónicas | Necesitas saber por qué así |
| **/docs/BUSINESS-RULES.md** | Reglas de negocio sagradas (18) | Implementas lógica de negocio |
| **/docs/ERRORS.md** | Bugs encontrados y soluciones | Hay un error similar |
| **/docs/specs/mod-*.md** | Spec completo de cada módulo | Vas a implementar un módulo |

---

## 🏗️ Arquitectura

### Stack tecnológico

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend:** tRPC (type-safe API) + Prisma (ORM)
- **Database:** SQLite (dev) → PostgreSQL + Supabase (prod)
- **Validation:** Zod
- **State:** React Query + Zustand (por venir)
- **Testing:** Jest + Playwright (por venir)

### Estructura de carpetas

```
src/
├── app/
│   ├── (auth)/          ← Auth pages (login)
│   ├── (dashboard)/     ← Módulos: clasificaciones, productos, ventas, etc.
│   └── api/trpc/        ← tRPC HTTP handler
├── server/
│   └── trpc/
│       ├── init.ts      ← tRPC setup
│       ├── router.ts    ← Root router
│       └── routers/     ← Routers por módulo
├── lib/
│   ├── validators/      ← Zod schemas por módulo
│   └── calculations.ts  ← Lógica de negocio (IVA, márgenes, etc)
└── components/
    ├── ui/              ← shadcn/ui components
    └── shared/          ← Sidebar, Header, etc.

docs/
├── DECISIONS.md         ← Decisiones arquitectónicas
├── BUSINESS-RULES.md    ← Reglas de negocio
├── PROGRESS.md          ← Estado de módulos
├── ERRORS.md            ← Bugs y soluciones
└── specs/
    └── mod-*.md         ← Specs de módulos
```

---

## 📦 Base de datos (Prisma Schema)

### Tablas principales (19 total)

**Core (multi-tenancy):**
- `accounts` — Tenant principal
- `branches` — Sucursales dentro de una cuenta
- `account_members` — Usuarios del sistema

**Catalogs:**
- `product_categories` — Clasificaciones de productos
- `cost_categories` — Clasificaciones de costos (Variable, Fijo, Impuestos)
- `payment_methods` — Medios de pago/cobro (Efectivo, Cheque, etc.)
- `suppliers` — Proveedores
- `clients` — Clientes

**Products & Pricing:**
- `products` — Productos con cálculo automático de unitCost
- `price_lists` — Listas de precios (Minorista, Mayorista, etc.)
- `price_list_items` — Precios por producto por lista

**Transactions:**
- `sales` — Ventas (Carga de Ingresos)
- `sale_payments` — Cobros parciales de ventas
- `purchases` — Compras (Carga de Egresos)
- `purchase_payments` — Pagos parciales de compras

**Stock & Inventory:**
- `stock_movements` — Log de movimientos (PEPS)

**Banking & Finance:**
- `bank_accounts` — Cuentas bancarias (Banco, Efectivo, MP, etc.)
- `cash_flow_entries` — Flujo de fondos
- `projections` — Proyecciones manuales (ventas, tipo de cambio)

---

## 🚀 Roadmap (4 Fases)

### ✅ Fase 0: Setup (COMPLETADA)
- Proyecto Next.js + Prisma
- Schema de DB diseñado
- Documentación base
- Git inicializado

### 🔄 Fase 1: TIER 1 Core (6 módulos, ~2 semanas)
1. **mod-clasificaciones** ← PRÓXIMO
2. mod-proveedores
3. mod-productos (⚠️ compleja)
4. mod-ventas
5. mod-compras
6. mod-mercaderia

### ⏳ Fase 2: TIER 2 Análisis (5 módulos, ~2 semanas)
7. mod-resumen
8. mod-estados-resultados (⚠️ compleja)
9. mod-cuentas + mod-flujo-fondos
10. mod-cashflow (⚠️ compleja)
11. mod-tablero (Dashboard)

### ⏳ Fase 3: POS + Dashboard (2 módulos, ~1 semana)
12. mod-cuadro-resumen
13. mod-pos (Punto de Venta)

### ⏳ Fase 4: Beta Testing (1 semana)
- Testing con 10 usuarios
- Recolección de feedback
- Fixes y polish

---

## 🎯 Características clave

### MVP (Lanzamiento)
- ✅ Gestión multi-sucursal
- ✅ Cálculo automático de costos (Acquisition + MP + MO + Packaging)
- ✅ Listas de precios flexibles (Minorista, Mayorista, etc.)
- ✅ Cálculo de márgenes y contribución marginal
- ✅ Soporte para Monotributista + Responsable Inscripto (con IVA)
- ✅ Cobros y pagos parciales
- ✅ Stock con método PEPS
- ✅ Estados Financiero y Económico
- ✅ Proyección de cashflow semanal
- ✅ Punto de venta (POS) táctil

### Post-MVP (Fase 2+)
- ⏳ Integración ARCA (facturación automática)
- ⏳ Integración Tienda Nube
- ⏳ Agente IA auditor
- ⏳ Exportar PDF/Excel
- ⏳ Webhooks y API pública

---

## 🔐 Seguridad

- Row Level Security (RLS) en Supabase (post-MVP)
- Auth solo con login (sin registro público)
- Filtro de `account_id` en cada query (multi-tenancy)
- Validación con Zod en frontend + backend

---

## 💻 Desarrollo local

### Instalar dependencias
```bash
npm install
```

### Variables de entorno (.env.local)
```env
DATABASE_URL="file:./dev.db"
# Supabase (cuando integremos)
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Ejecutar dev server
```bash
npm run dev
```

### Ver base de datos
```bash
npx prisma studio
```

### Crear migración
```bash
npx prisma migrate dev --name "descripción del cambio"
```

### Resetear base de datos (CUIDADO)
```bash
npx prisma migrate reset
```

---

## 🧪 Testing

Por venir en Sesión 1:
- Unit tests (Zod validators)
- Integration tests (tRPC routes)
- E2E tests (Playwright)

---

## 📊 Datos del proyecto

**Cliente:** Mati (Club de suscripción para pymes argentinas)  
**Base de usuarios:** ~400 suscriptores activos + 40 nuevos/mes  
**Revenue:** $1.630 por usuario/mes (~$650k/año)  
**Beta testers:** 10 usuarios  
**Timeline:** 4 semanas hasta lanzamiento  

---

## 🤝 Contribuir

1. Lee **/docs/BUSINESS-RULES.md** (reglas sagradas)
2. Lee spec del módulo **/docs/specs/mod-xxx.md**
3. Abre sesión NUEVA para cada módulo (contexto limpio)
4. Completa módulo → Actualiza **/docs/PROGRESS.md** → Commit
5. Si hay bugs, documenta en **/docs/ERRORS.md**

---

## 📚 Referencias

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [tRPC Docs](https://trpc.io)
- [shadcn/ui](https://ui.shadcn.com)

---

**Status:** 🚀 Desarrollo activo  
**Última actualización:** 2025-02-25  
**Próximo hito:** Sesión 1 — mod-clasificaciones
