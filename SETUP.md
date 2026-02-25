# Sistema Club MVP — Setup & Quick Start

## Estado Actual

✅ **Fase 0: Completada (2025-02-25)**

- Next.js 14 project initialized
- Prisma schema designed (19 tables, SQLite for dev)
- Documentation structure in place
- Git repo initialized

## Para arrancar el desarrollo local

```bash
# 1. Install dependencies (already done, pero para referencia)
npm install

# 2. Start dev server
npm run dev

# 3. Access Prisma Studio (view/edit DB)
npx prisma studio
```

App will run at http://localhost:3000

## Archivo de configuración de ambiente

Crear `.env.local` con:

```env
# Database (SQLite local)
DATABASE_URL="file:./dev.db"

# Supabase (cuando integremos auth)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Documentación principal

**Léer en este orden:**

1. `/docs/PROGRESS.md` — Estado actual y plan de ejecución (Fases 0-4)
2. `/docs/DECISIONS.md` — Decisiones arquitectónicas tomadas
3. `/docs/BUSINESS-RULES.md` — Reglas de negocio sagradas (IVA, stock, márgenes, etc.)
4. `/docs/specs/mod-clasificaciones.md` — Spec del primer módulo a implementar

## Siguiente paso: Sesión 1 (mod-clasificaciones)

**Quién:** Sonnet (implementación UI + API)
**Qué:** CRUD de ProductCategories, CostCategories, PaymentMethods
**Cuándo:** Próxima sesión

**Antes de arrancar:**
1. Crear archivo `/docs/specs/mod-clasificaciones.md` ✅ (ya existe)
2. Cargar contexto de este proyecto
3. Ejecutar spec con Sonnet

**Estructura esperada post-mod-clasificaciones:**

```
src/
├── server/
│   └── trpc/
│       ├── init.ts           (tRPC setup)
│       ├── router.ts         (root router)
│       └── routers/
│           └── clasificaciones.ts  (ProductCategory, CostCategory, PaymentMethod routes)
├── lib/
│   └── validators/
│       └── clasificaciones.ts (Zod schemas)
├── app/
│   ├── api/
│   │   └── trpc/
│   │       └── [trpc]/route.ts (tRPC HTTP handler)
│   ├── (dashboard)/
│   │   └── clasificaciones/
│   │       ├── page.tsx       (main UI)
│   │       ├── components/
│   │       │   ├── ProductCategoryForm.tsx
│   │       │   ├── CostCategoryForm.tsx
│   │       │   ├── PaymentMethodForm.tsx
│   │       │   └── TabsView.tsx
│   │       └── hooks/
│   │           └── useClassifications.ts (React Query hooks)
```

---

## Stack técnico actual

| Componente | Tecnología | Estado |
|---|---|---|
| Frontend | Next.js 14 (App Router) | ✅ |
| ORM | Prisma 7 | ✅ |
| Database (dev) | SQLite | ✅ |
| Styling | Tailwind CSS | ✅ |
| UI Components | shadcn/ui | ⏳ (será instalado en Sonnet) |
| API | tRPC | ⏳ (será configurado en Sonnet) |
| Data Fetching | React Query | ✅ (instalado, no usado aún) |
| Validation | Zod | ✅ (instalado, no usado aún) |
| Utilities | date-fns, decimal.js | ✅ (instalado) |
| Database (prod) | PostgreSQL + Supabase | ⏳ (post-MVP) |

---

## Reglas clave

### 1. Contexto limpio por sesión
Cada módulo nuevo = sesión nueva. Llevar el spec desde `/docs/specs/mod-xxx.md` y las reglas de `/docs/BUSINESS-RULES.md`.

### 2. No olvidar persistencia
Después de cada sesión, actualizar:
- `/docs/DECISIONS.md` — Nuevas decisiones tomadas
- `/docs/ERRORS.md` — Bugs encontrados y soluciones
- `/docs/PROGRESS.md` — Estado de módulos

### 3. 1 módulo = 1 commmit
Commitear al terminar cada módulo.

### 4. Tests desde día 1
No pushear código sin tests. Mínimo: unit (Zod validators) + integration (tRPC).

---

## Troubleshooting

### ¿Prisma Client no se genera?
```bash
npx prisma generate
```

### ¿SQLite corrupted?
```bash
rm dev.db
npx prisma migrate dev --name init
```

### ¿Quiero ver la DB?
```bash
npx prisma studio
```

Abrirá http://localhost:5555 con interfaz visual para editar datos.

---

## Contact

**Cliente:** Mati (Club de suscripción para pymes argentinas)
**Revenue:** ~$650k/año (400 usuarios × $1.630)
**Beta test:** 10 usuarios
**Timeline esperado:** 4 semanas a lanzamiento

---

*Last updated: 2025-02-25*
