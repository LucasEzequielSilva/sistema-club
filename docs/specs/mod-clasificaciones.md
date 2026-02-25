# Spec: mod-clasificaciones

**Sesión esperada:** Sesión 1 (Sonnet)
**Prioridad:** P0 (es la base de todo)
**Dependencias:** Ninguna
**Alimenta a:** mod-proveedores, mod-productos, mod-compras, mod-ventas

---

## Descripción

Gestión de las 3 clasificaciones fundamentales del sistema:

1. **Product Categories** — Clasificaciones de productos (Ropa, Alimentos, etc.)
2. **Cost Categories** — Clasificaciones de costos (Variable, Fijo, Impuestos)
3. **Payment Methods** — Medios de pago/cobro (Efectivo, Cheque, Transferencia, etc.)

Este módulo NO es de "datos maestros" genéricos. Cada una de las 3 tablas tiene comportamiento y reglas distintas, pero todas son "clasificaciones" que el usuario necesita mantener.

---

## Hoja Excel de referencia

El Excel de Mati tiene "Clasificaciones" como una hoja, pero nosotros las separamos en 3 entidades de negocio:

1. **Clasificaciones** — Lo que Mati llama "Clasificaciones" de productos.
2. **Tipo de Costo** — Lo que está implícito en los egresos (Variable, Fijo, Impuestos).
3. **Medios de Pago** — Lo que está implícito en ingresos y egresos.

---

## Campos del Excel que debe replicar

### Product Categories
| Campo Excel | Campo BD | Tipo | Obligatorio | Nota |
|---|---|---|---|---|
| Clasificación | name | TEXT | Sí | Ej: "Ropa", "Alimentos", "Servicios" |
| Descripción | description | TEXT | No | Opcional |
| Activo | isActive | BOOLEAN | No | Default true |
| Orden | sortOrder | INT | No | Para ordenamiento en dropdowns |

### Cost Categories
| Campo Excel | Campo BD | Tipo | Obligatorio | Nota |
|---|---|---|---|---|
| Clasificación de Costo | name | TEXT | Sí | Ej: "Costo de mercadería", "Alquiler" |
| Tipo | costType | ENUM | Sí | variable \| fijo \| impuestos |
| Descripción | description | TEXT | No | Opcional |
| Activo | isActive | BOOLEAN | No | Default true |
| Orden | sortOrder | INT | No | Para ordenamiento |

### Payment Methods
| Campo Excel | Campo BD | Tipo | Obligatorio | Nota |
|---|---|---|---|---|
| Método | name | TEXT | Sí | Ej: "Efectivo", "Cheque", "Transferencia" |
| Días de acreditación | accreditationDays | INT | Sí | Default 0 (acreditación inmediata) |
| Activo | isActive | BOOLEAN | No | Default true |

---

## User Stories

### Product Categories

#### US-001: Crear clasificación de producto
**Como** admin, **quiero** crear una nueva clasificación de producto **para** poder categorizar mis productos en el sistema.

**Criterios de aceptación:**
- [ ] Puedo acceder a un formulario "Nueva clasificación de producto"
- [ ] Campos: Nombre (obligatorio), Descripción (opcional), Orden (opcional, default 0)
- [ ] Al guardar:
  - [ ] Validar que el nombre NO sea vacío
  - [ ] Validar que el nombre sea ÚNICO dentro de la cuenta
  - [ ] Crear el registro en la DB
  - [ ] Mostrar success toast con el nombre creado
  - [ ] Limpiar formulario para siguiente entrada
  - [ ] Refrescar tabla
- [ ] Nombre debe tener máximo 100 caracteres
- [ ] Mobile responsive

#### US-002: Listar clasificaciones de productos
**Como** admin, **quiero** ver todas las clasificaciones de productos creadas **para** saber qué opciones tengo al cargar productos.

**Criterios de aceptación:**
- [ ] Mostrar tabla con columnas: Nombre, Descripción, Orden, Activo, Acciones
- [ ] Ordenable por nombre, orden
- [ ] Filtrable por "Activo/Inactivo"
- [ ] Mostrar total de clasificaciones
- [ ] Lazy load si hay muchas (100+)
- [ ] Mobile: tabla colapsable o scroll horizontal

#### US-003: Editar clasificación de producto
**Como** admin, **quiero** editar una clasificación existente **para** corregir nombre o descripción.

**Criterios de aceptación:**
- [ ] Puedo hacer click en el ícono "editar" de una fila
- [ ] Se abre modal con formulario pre-cargado
- [ ] Puedo cambiar nombre, descripción, orden
- [ ] Validaciones: nombre no vacío, nombre único (excluyendo el actual)
- [ ] Al guardar: actualizar DB, mostrar success, cerrar modal, refrescar tabla

#### US-004: Desactivar/Activar clasificación de producto
**Como** admin, **quiero** desactivar una clasificación sin borrarla **para** mantener historial de datos.

**Criterios de aceptación:**
- [ ] Checkbox "Activo" en la tabla o en el modal de edición
- [ ] Toggle permite cambiar entre activo/inactivo
- [ ] Desactivar una clasificación NO borra productos asociados
- [ ] Al desactivar, las nuevas ventas no pueden usar esa clasificación (pero sí historiales)
- [ ] Mobile: checkbox debe ser fácil de tocar

#### US-005: Eliminar clasificación de producto
**Como** admin, **quiero** eliminar una clasificación **para** limpiar errores de carga.

**Criterios de aceptación:**
- [ ] Botón "Eliminar" con confirmación ("¿Estás seguro?")
- [ ] NO permitir eliminar si hay productos activos asociados
- [ ] Mensaje claro: "No se puede eliminar: hay 5 productos usando esta clasificación. Desactívala en su lugar."
- [ ] Si no hay asociaciones: permitir eliminación
- [ ] Refrescar tabla tras eliminación

---

### Cost Categories

#### US-006: Crear clasificación de costo
**Como** admin, **quiero** crear una clasificación de costo (Variable, Fijo, Impuestos) **para** analizar la estructura de costos.

**Criterios de aceptación:**
- [ ] Formulario con campos: Nombre (obligatorio), Tipo (obligatorio, dropdown: Variable/Fijo/Impuestos), Descripción (opcional), Orden (opcional)
- [ ] Validar nombre no vacío, nombre único, tipo seleccionado
- [ ] Al crear:
  - [ ] Crear registro con type = "variable" | "fijo" | "impuestos"
  - [ ] Success toast
  - [ ] Limpiar formulario
  - [ ] Refrescar tabla
- [ ] Ejemplos sugeridos en la UI:
  - Variable: "Costo de mercadería", "Materia prima", "Flete"
  - Fijo: "Alquiler", "Servicios", "Sueldos"
  - Impuestos: "IVA", "Ingresos Brutos", "Monotributo"

#### US-007: Listar clasificaciones de costo
**Como** admin, **quiero** ver todas las clasificaciones de costo **para** entender cómo están categorizado mis egresos.

**Criterios de aceptación:**
- [ ] Tabla con columnas: Nombre, Tipo (badge color-codificado: rojo=variable, azul=fijo, naranja=impuestos), Descripción, Activo, Acciones
- [ ] Filtrable por Tipo
- [ ] Ordenable por nombre
- [ ] Mostrar total por tipo

#### US-008: Editar / Desactivar / Eliminar clasificación de costo
**Como** admin, **quiero** mantener las clasificaciones de costo actualizadas.

**Criterios de aceptación:**
- [ ] Mismo flujo que US-003, US-004, US-005
- [ ] NO permitir cambiar Tipo si hay egresos asociados (mostrar mensaje)
- [ ] Ejemplo: "No se puede cambiar tipo: hay 12 egresos con esta clasificación."

---

### Payment Methods

#### US-009: Crear medio de pago/cobro
**Como** admin, **quiero** crear un medio de pago (Efectivo, Cheque, Transferencia, etc.) **para** registrar cómo se pagan/cobran las transacciones.

**Criterios de aceptación:**
- [ ] Formulario con campos: Nombre (obligatorio), Días de acreditación (obligatorio, default 0), Activo (checkbox)
- [ ] Validaciones:
  - [ ] Nombre no vacío, nombre único
  - [ ] Días de acreditación >= 0
- [ ] Al crear:
  - [ ] Crear registro
  - [ ] Success toast
  - [ ] Limpiar formulario
  - [ ] Refrescar tabla
- [ ] Ejemplos sugeridos:
  - "Efectivo" (0 días)
  - "Transferencia bancaria" (0 días)
  - "Cheque" (2 días)
  - "Cheque diferido 30 días" (32 días)
  - "Cheque diferido 45 días" (47 días)
  - "Cheque diferido 60 días" (62 días)
  - "Mercado Pago" (0 días)
  - "Tarjeta de crédito" (18 días)
  - "Tarjeta de débito" (3 días)

#### US-010: Listar medios de pago
**Como** admin, **quiero** ver todos los medios de pago configurados **para** seleccionar uno al hacer una venta/compra.

**Criterios de aceptación:**
- [ ] Tabla con columnas: Nombre, Días de acreditación, Activo, Acciones
- [ ] Ordenable por nombre, días
- [ ] Mostrar "acreditación inmediata" si días = 0
- [ ] Mostrar "acreditación en X días" si días > 0
- [ ] Filtrable por Activo

#### US-011: Editar / Desactivar / Eliminar medio de pago
**Como** admin, **quiero** mantener los medios de pago actualizados.

**Criterios de aceptación:**
- [ ] Mismo flujo que anterior
- [ ] NO permitir eliminar si hay cobros/pagos asociados (mostrar mensaje)
- [ ] Sí permitir desactivar

#### US-012: Seed data de medios de pago
**Como** system, **quiero** que cada nueva cuenta tenga los 9 medios de pago por defecto pre-cargados **para** acelerar onboarding.

**Criterios de aceptación:**
- [ ] Al crear Account, automáticamente crear:
  - Efectivo (0)
  - Transferencia bancaria (0)
  - Cheque (2)
  - Cheque Dif 30 (32)
  - Cheque Dif 45 (47)
  - Cheque Dif 60 (62)
  - Mercado Pago (0)
  - Tarjeta de crédito (18)
  - Tarjeta de débito (3)
- [ ] Estos no aparecen en el formulario de creación (aparecen automáticamente en el listado)
- [ ] Admin puede desactivarlos o cambiar sus días de acreditación

---

## API Routes (tRPC)

### ProductCategory
```typescript
// GET: Listar
router.query.listProductCategories(input: { accountId, isActive?: boolean }) 
  → { categories: ProductCategory[] }

// POST: Crear
router.mutation.createProductCategory(input: { accountId, name, description?, sortOrder? })
  → { category: ProductCategory }

// PATCH: Actualizar
router.mutation.updateProductCategory(input: { id, name?, description?, sortOrder?, isActive? })
  → { category: ProductCategory }

// DELETE: Eliminar
router.mutation.deleteProductCategory(input: { id })
  → { success: boolean }
```

### CostCategory
```typescript
router.query.listCostCategories(input: { accountId, type?: "variable"|"fijo"|"impuestos" })
  → { categories: CostCategory[] }

router.mutation.createCostCategory(input: { accountId, name, costType, description?, sortOrder? })
  → { category: CostCategory }

router.mutation.updateCostCategory(input: { id, name?, description?, sortOrder?, isActive? })
  → { category: CostCategory }

router.mutation.deleteCostCategory(input: { id })
  → { success: boolean }
```

### PaymentMethod
```typescript
router.query.listPaymentMethods(input: { accountId, isActive?: boolean })
  → { methods: PaymentMethod[] }

router.mutation.createPaymentMethod(input: { accountId, name, accreditationDays })
  → { method: PaymentMethod }

router.mutation.updatePaymentMethod(input: { id, name?, accreditationDays?, isActive? })
  → { method: PaymentMethod }

router.mutation.deletePaymentMethod(input: { id })
  → { success: boolean }
```

---

## Validaciones (Zod)

```typescript
// ProductCategory
const createProductCategorySchema = z.object({
  accountId: z.string().cuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().default(0),
})

// CostCategory
const createCostCategorySchema = z.object({
  accountId: z.string().cuid(),
  name: z.string().min(1).max(100),
  costType: z.enum(["variable", "fijo", "impuestos"]),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().default(0),
})

// PaymentMethod
const createPaymentMethodSchema = z.object({
  accountId: z.string().cuid(),
  name: z.string().min(1).max(100),
  accreditationDays: z.number().int().min(0).default(0),
})
```

---

## UI Layout (Componentes shadcn/ui esperados)

- **Tabs:** Alternar entre ProductCategories, CostCategories, PaymentMethods
- **Dialog/Modal:** Para crear/editar
- **Table:** Para listar
- **Form:** Para entrada de datos
- **Button:** Crear, Editar, Eliminar
- **Badge:** Para tipo de costo
- **Select:** Para dropdown (costType)
- **Toast:** Para feedback

---

## Dependencias

### Módulos
- Ninguno (es el primero)

### Paquetes
- Prisma Client (ya instalado)
- zod (ya instalado)
- @tanstack/react-query (para caching)
- shadcn/ui (a instalar en Sonnet)

---

## Testing

### Unit tests (Zod validators)
- [ ] Validar nombre vacío
- [ ] Validar nombre duplicado
- [ ] Validar costType enum
- [ ] Validar accreditationDays >= 0

### Integration tests (tRPC routes)
- [ ] Crear category, listar, verificar aparece
- [ ] Crear con nombre duplicado, debe fallar
- [ ] Actualizar, verificar cambios
- [ ] Eliminar con dependencias, debe fallar
- [ ] Seed data de payment methods

### E2E tests (UI)
- [ ] Crear nueva categoría de producto
- [ ] Editar clasificación de costo
- [ ] Ver tabla de medios de pago
- [ ] Desactivar medio de pago

---

## Notas de implementación

1. **No confundir nombres:** "Clasificación" es el término que usa el negocio. En DB es ProductCategory. Mantener consistencia en UI.

2. **Orden de desarrollo:** Probablemente más fácil empezar por ProductCategory (simplest), luego PaymentMethod, luego CostCategory (con enum).

3. **Seed data:** Al crear Account, automáticamente crear payment_methods. Esto se hace en un hook de `createAccount` en tRPC.

4. **Soft delete:** Aunque tenemos `isActive`, la lógica de "eliminar con dependencias" es soft delete (marcar como inactivo). Hard delete solo si no hay asociaciones.

5. **Color-coding en Cost Categories:**
   - Variable: Rojo (#ef4444)
   - Fijo: Azul (#3b82f6)
   - Impuestos: Naranja (#f97316)

---

*Spec vivo. Actualizar cuando haya cambios decididos en sesión.*
