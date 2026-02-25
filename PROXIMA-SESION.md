# 🎯 Próxima Sesión — mod-clasificaciones

## Contexto a cargar

Antes de que Sonnet arranque, cargá este contexto:

---

## 1. RESUMEN DEL PROYECTO

**Cliente:** Mati — Club de suscripción para pymes argentinas  
**Producto:** Sistema de gestión financiera (reemplaza un Excel de 15 hojas)  
**Stack:** Next.js 14, Prisma, SQLite (dev), TypeScript  
**Metodología:** 1 módulo = 1 sesión limpia  
**Progreso:** Fase 0 completada (schema + docs)

---

## 2. ARCHIVOS CRÍTICOS A LEER

Abrir en Claude y cargar:

```
/docs/specs/mod-clasificaciones.md          ← SPEC COMPLETO (2,500+ líneas)
/docs/BUSINESS-RULES.md                     ← Reglas de negocio (18 reglas)
/docs/DECISIONS.md                          ← Decisiones arquitectónicas
prisma/schema.prisma                        ← Schema de DB (ProductCategory, etc.)
```

---

## 3. MÓDULO: mod-clasificaciones

### Qué es
CRUD de 3 tipos de clasificaciones:
1. **ProductCategories** — Ej: "Ropa", "Alimentos"
2. **CostCategories** — Ej: "Costo de mercadería" (tipo: Variable)
3. **PaymentMethods** — Ej: "Efectivo" (0 días), "Cheque" (2 días)

### Componentes esperados

#### Backend (tRPC)
```
src/server/trpc/routers/clasificaciones.ts
  - listProductCategories()
  - createProductCategory()
  - updateProductCategory()
  - deleteProductCategory()
  - listCostCategories()
  - createCostCategory()
  - updateCostCategory()
  - deleteCostCategory()
  - listPaymentMethods()
  - createPaymentMethod()
  - updatePaymentMethod()
  - deletePaymentMethod()
```

#### Frontend
```
src/app/(dashboard)/clasificaciones/
  ├── page.tsx                          ← Tabs (3 pestañas)
  ├── components/
  │   ├── ProductCategoryForm.tsx       ← Modal/Dialog para crear/editar
  │   ├── CostCategoryForm.tsx
  │   ├── PaymentMethodForm.tsx
  │   ├── ProductCategoriesTable.tsx
  │   ├── CostCategoriesTable.tsx
  │   ├── PaymentMethodsTable.tsx
  │   └── TabsView.tsx
  └── hooks/
      └── useClassifications.ts         ← React Query hooks
```

#### Validators (Zod)
```
src/lib/validators/clasificaciones.ts
  - createProductCategorySchema
  - createCostCategorySchema
  - createPaymentMethodSchema
```

### Tareas específicas

```
INSTALACIÓN & SETUP
  ☐ Instalar shadcn/ui (npx shadcn-ui@latest init)
  ☐ Instalar componentes: Button, Dialog, Form, Input, Table, Tabs, Badge, Select, Toast
  ☐ Configurar tRPC (init.ts, router.ts, route.ts)

BACKEND
  ☐ Crear src/lib/validators/clasificaciones.ts (Zod schemas)
  ☐ Crear src/server/trpc/routers/clasificaciones.ts (API routes)
  ☐ Seed data: función que crea 9 payment_methods en nueva Account

FRONTEND
  ☐ Crear componentes de formulario (ProductCategoryForm, etc)
  ☐ Crear componentes de tabla (ProductCategoriesTable, etc)
  ☐ Crear Tabs view que alterna entre las 3 pestañas
  ☐ Integrar React Query para caching

TESTING
  ☐ Unit tests: Zod validators
  ☐ Integration tests: tRPC routes (crear, listar, editar, eliminar)
  ☐ E2E: crear categoría, verificar en tabla

POLISH
  ☐ Error handling y validaciones
  ☐ Mobile responsive
  ☐ Toast notifications
  ☐ Loading states
```

---

## 4. CRITERIOS DE ACEPTACIÓN

### ProductCategory
- [x] CRUD completo (CREATE, READ, UPDATE, DELETE)
- [x] Validaciones: nombre no vacío, nombre único
- [x] UI responsiva
- [x] Tests unitarios

### CostCategory
- [x] CRUD completo
- [x] Validaciones: nombre, tipo (enum: variable/fijo/impuestos)
- [x] Badge color-coded en tabla (rojo/azul/naranja)
- [x] Tests

### PaymentMethod
- [x] CRUD completo
- [x] Validaciones: nombre, accreditationDays >= 0
- [x] Mostrar "X días de acreditación" en tabla
- [x] Seed data: 9 métodos por defecto al crear Account

### General
- [x] Todos los campos usables en celular (responsive)
- [x] Error handling + messages
- [x] Success toast cuando operación exitosa
- [x] Confirmación antes de eliminar
- [x] No permitir eliminar si hay asociaciones

---

## 5. CONSIDERACIONES TÉCNICAS

### Multi-tenancy
- Todas las queries deben filtrar por `accountId`
- El usuario loggeado determinará su `accountId`
- Implementar en próxima sesión: auth con Supabase (por ahora, hardcodear un `accountId` de test)

### Validaciones
```zod
// ProductCategory
name: z.string().min(1).max(100)     // Obligatorio, max 100
description: z.string().max(500).optional()
sortOrder: z.number().int().default(0)

// CostCategory
name: z.string().min(1).max(100)
costType: z.enum(["variable", "fijo", "impuestos"])  // ENUM!
...

// PaymentMethod
name: z.string().min(1).max(100)
accreditationDays: z.number().int().min(0).default(0)
```

### UI Components
- Usar **Tabs** para alternar entre 3 secciones
- Usar **Dialog/Modal** para crear/editar
- Usar **Table** con columnas: Nombre, Tipo (si aplica), Acciones
- Usar **Select** para dropdown de costType
- Usar **Badge** para tipo de costo (color-coded)

### Seed Data
```typescript
// Al crear Account, automáticamente crear estos PaymentMethods:
- "Efectivo" (0 días)
- "Transferencia bancaria" (0 días)
- "Cheque" (2 días)
- "Cheque Dif 30" (32 días)
- "Cheque Dif 45" (47 días)
- "Cheque Dif 60" (62 días)
- "Mercado Pago" (0 días)
- "Tarjeta de crédito" (18 días)
- "Tarjeta de débito" (3 días)

Implementar en un hook/trigger de createAccount en tRPC.
```

---

## 6. ESTRUCTURA DE ARCHIVOS POST-SESIÓN

```
src/
├── app/
│   ├── api/
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts              ← HTTP handler para tRPC
│   └── (dashboard)/
│       ├── layout.tsx
│       └── clasificaciones/
│           ├── page.tsx                  ← Main page con Tabs
│           └── components/
│               ├── ProductCategoryForm.tsx
│               ├── ProductCategoriesTable.tsx
│               ├── CostCategoryForm.tsx
│               ├── CostCategoriesTable.tsx
│               ├── PaymentMethodForm.tsx
│               ├── PaymentMethodsTable.tsx
│               └── TabsView.tsx
├── server/
│   └── trpc/
│       ├── init.ts                       ← initTRPC setup
│       ├── router.ts                     ← Root router que incluye clasificaciones
│       └── routers/
│           └── clasificaciones.ts        ← Todas las queries/mutations
├── lib/
│   ├── validators/
│   │   └── clasificaciones.ts            ← Zod schemas
│   ├── utils.ts
│   ├── db.ts                             ← Prisma singleton
│   └── trpc.ts                           ← tRPC client hook
└── components/
    ├── ui/                               ← shadcn/ui (auto-generados)
    └── shared/
        └── Sidebar.tsx                   ← Navigation (a futuro)
```

---

## 7. NOTAS IMPORTANTES

### No confundir:
- **Clasificación** (término del negocio) ↔ **ProductCategory** (término técnico)
- En UI: mostrar "Clasificación", en código: `ProductCategory`

### Orden de desarrollo sugerido:
1. Instalar shadcn/ui + tRPC setup
2. Validadores Zod (más simple)
3. ProductCategory (más simple, sin enums)
4. PaymentMethod (add accreditationDays)
5. CostCategory (add enum + color-coding)
6. Seed data
7. Tests

### Soft delete vs Hard delete:
- `isActive` field es para soft delete (marcar como inactivo)
- Hard delete solo si NO hay asociaciones
- Ejemplo: "No se puede eliminar: 5 productos usan esta clasificación"

### UI/UX
- Mostrar "Activo/Inactivo" como toggle en tabla
- Botón "Eliminar" con confirmación
- Toast en cada operación (crear, editar, eliminar)
- Loading skeleton mientras trae datos
- Mobile: tabla colapsable o scroll horizontal

---

## 8. COMANDOS ÚTILES

```bash
# Ver base de datos
npx prisma studio

# Generar Prisma Client
npx prisma generate

# Ejecutar tests
npm test

# Ejecutar dev server
npm run dev

# Check types
npx tsc --noEmit
```

---

## 9. REFERENCIAS

- [Spec completo](./docs/specs/mod-clasificaciones.md)
- [Business rules](./docs/BUSINESS-RULES.md)
- [Schema Prisma](./prisma/schema.prisma)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma Docs](https://www.prisma.io/docs)
- [tRPC Docs](https://trpc.io/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Zod](https://zod.dev)

---

## 10. ENTREGA ESPERADA

**Tiempo estimado:** 2-3 horas  
**Commits esperados:** 3-4 (setup, backend, frontend, tests)  
**Código:** ~800-1200 líneas (validators + routes + UI)  
**Tests:** ~15-20 tests

**Checklist final:**
- [ ] Toda la funcionalidad funciona localmente
- [ ] Tests pasan
- [ ] TypeScript no hay errores (`npx tsc --noEmit`)
- [ ] Código formateado con Prettier
- [ ] Actualizar `/docs/PROGRESS.md` (marcar mod-clasificaciones como DONE)
- [ ] Commit con mensaje descriptivo

---

**¡Listo para empezar! 🚀**
