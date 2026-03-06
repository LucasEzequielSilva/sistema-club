# Ralph Agent — Sistema Club

Sos un agente autónomo de Claude Code trabajando en **Sistema Club**, una app de gestión financiera para pymes argentinas.

## Tu tarea en esta iteración

1. Leé `scripts/ralph/prd.json` → encontrá la historia con **`passes: false` y el `priority` más bajo** (número más bajo = más urgente)
2. Leé `scripts/ralph/progress.txt` → contexto acumulado de iteraciones anteriores
3. **Implementá esa historia completamente** siguiendo las reglas abajo
4. Corré `npm run build` (workdir: `D:\Dev\randazzo`) para verificar que no hay errores TypeScript
5. Si el build pasa: actualizá `passes: true` en `scripts/ralph/prd.json` para esa historia
6. Agregá un aprendizaje a `scripts/ralph/progress.txt` (una línea describiendo qué hiciste y algo que descubriste)
7. Si **todas** las historias tienen `passes: true`, emitir **exactamente**: `<promise>COMPLETE</promise>`

---

## Contexto del proyecto

**Stack:** Next.js 16.1 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · tRPC v11 · Prisma · SQLite · Groq AI  
**Puerto dev:** 3001  
**Directorio:** `D:\Dev\randazzo`  
**accountId hardcodeado:** `"test-account-id"` (no hay auth real)

### Estructura clave
```
src/
├── app/
│   ├── globals.css                    ← tokens CSS, NO tailwind.config.js
│   ├── api/chat/route.ts              ← Clubi API (POST streaming + GET memorias + DELETE)
│   ├── api/chat/action/route.ts       ← Ejecuta acciones de Clubi (crear_producto, etc.)
│   └── (dashboard)/
│       ├── layout.tsx                 ← Sidebar + AIAssistant wrapper  
│       ├── tablero/page.tsx           ← Dashboard principal con recharts
│       ├── ventas/page.tsx
│       ├── compras/page.tsx
│       ├── pos/page.tsx               ← Punto de Venta (dos paneles, grid)
│       ├── productos/page.tsx
│       ├── proveedores/page.tsx
│       ├── mercaderia/page.tsx
│       ├── cuentas/page.tsx
│       └── clasificaciones/
│           ├── page.tsx
│           └── components/            ← payment-methods-tab, cost-categories-tab, product-categories-tab
├── components/
│   ├── shared/
│   │   ├── sidebar.tsx                ← w-56, primaryNav + finanzasNav colapsable + settingsNav dropdown
│   │   ├── page-header.tsx            ← Componente estándar de header de página
│   │   ├── stat-card.tsx              ← Tarjeta de KPI reutilizable
│   │   ├── empty-state.tsx            ← Estado vacío genérico
│   │   ├── ai-assistant.tsx           ← Clubi chat flotante (ActionCard, streaming, memorias)
│   │   └── setup-checklist.tsx        ← Checklist de onboarding (5 pasos)
│   └── ui/                            ← shadcn components + alert-dialog.tsx (creado manualmente)
├── hooks/
│   └── use-confirm.tsx                ← Hook async para reemplazar window.confirm()
└── server/trpc/routers/               ← NUNCA tocar estos archivos
```

---

## ❌ REGLAS CRÍTICAS — NUNCA hacer esto

1. **NUNCA** modificar archivos en `src/server/trpc/routers/`
2. **NUNCA** modificar lógica de tRPC, data fetching, mutations, o business logic
3. **NUNCA** cambiar el schema de Prisma (`prisma/schema.prisma`)
4. **NUNCA** agregar paquetes npm (todo lo necesario ya está instalado)
5. **NUNCA** habilitar dark mode (el design system es light-only)
6. **NUNCA** usar `window.confirm()` — usar el hook `useConfirm` de `@/hooks/use-confirm`
7. **NUNCA** hacer cambios que rompan el build de TypeScript

---

## ✅ Design System

### Filosofía
OpenCode-inspired. Escala de grises pura + **naranja** (`#f97316`) como **único** acento cromático. No usar azules, verdes, morados en elementos de UI chrome (solo en data/badges semánticos).

### Tokens CSS (globals.css)
```css
--primary: oklch(0.70 0.19 42)      /* #f97316 — orange, único acento */
--background: oklch(0.985 0 0)      /* #fafafa */
--card: oklch(1 0 0)                /* #ffffff */
--muted: oklch(0.96 0 0)            /* #f4f4f5 */
--muted-foreground: oklch(0.50 0 0) /* #71717a */
--border: oklch(0.89 0 0)           /* #e4e4e7 */
--foreground: oklch(0.13 0 0)       /* #18181b */

/* Semánticos */
--success: #16a34a
--warning: #d97706
--danger: #dc2626
--info: #2563eb
```

### Tailwind v4 — Patrón correcto
- No hay `tailwind.config.js`, todo se configura en `globals.css` con `@theme inline`
- Usar `tw-animate-css` para animaciones (ya importado en globals.css)
- Animaciones disponibles: `animate-in`, `fade-in`, `slide-in-from-bottom-4`, `duration-300`, etc.
- Para colores semánticos usar `style={{ color: "var(--success)" }}` cuando Tailwind no tiene la clase exacta

### Radix UI — Patrón de import
```tsx
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"  // ✅ correcto
import * from "@radix-ui/react-alert-dialog"                    // ❌ incorrecto
```

### recharts — Ya instalado (v3.7.0)
```tsx
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
```

---

## ✅ Patrones comunes

### PageHeader (usar en TODAS las páginas)
```tsx
import { PageHeader } from "@/components/shared/page-header"
<PageHeader title="..." description="..." icon={IconComponent} actions={<Button>...</Button>} />
```

### useConfirm (reemplazar window.confirm)
```tsx
import { useConfirm } from "@/hooks/use-confirm"

const [confirmDelete, ConfirmDialog] = useConfirm({
  title: "Eliminar X",
  description: "Esta acción no se puede deshacer.",
  confirmLabel: "Eliminar",
  destructive: true,
})

// En el handler:
const handle = async (id: string) => {
  if (!(await confirmDelete())) return
  // ... lógica
}

// En el JSX (al final del return):
return <div>...{ConfirmDialog}</div>
```

### Skeleton loader pattern (Tailwind v4)
```tsx
// Skeleton para tabla
const TableSkeleton = () => (
  <div className="animate-pulse space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex gap-4">
        <div className="h-4 bg-muted rounded flex-1" />
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-4 bg-muted rounded w-20" />
      </div>
    ))}
  </div>
)

// Skeleton para stat card
<div className="animate-pulse">
  <div className="h-3 bg-muted rounded w-20 mb-2" />
  <div className="h-8 bg-muted rounded w-32" />
</div>
```

### Toast (sonner)
```tsx
import { toast } from "sonner"
toast.success("Texto", { description: "Detalle" })
toast.error("Error")
```

### Loader2 (cuando skeleton no aplica)
```tsx
<div className="flex items-center justify-center py-16">
  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
</div>
```

---

## Verificación

```bash
# Correr desde D:\Dev\randazzo
npm run build    # verifica TypeScript + Next.js build
```

Si el build falla, **NO** marques la historia como `passes: true`. Arreglá el error primero.

---

## Formato de actualización de prd.json

Cuando completes una historia, cambiá `"passes": false` a `"passes": true`:
```json
{ "id": "story-X", "passes": true, ... }
```

## Formato de progress.txt

Agregá al final:
```
[Iteración N] story-X: Implementé skeleton loaders en tablero. Descubrí que animate-pulse funciona bien con bg-muted en Tailwind v4.
```
