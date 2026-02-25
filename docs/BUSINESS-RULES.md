# Reglas de Negocio — Sistema Club MVP

Estas son las reglas sagradas extraídas del Excel de Mati y del playbook. Si algo entra en conflicto con estas reglas, las reglas ganan.

---

## 1. Régimen Impositivo (IVA)

### Monotributista
- **No maneja IVA explícitamente.**
- Precios finales = Precio de venta directo.
- El sistema NO calcula ni separa IVA.
- `Account.taxStatus = "monotributista"` → IVA oculto en el costo.

### Responsable Inscripto (RI)
- **Maneja IVA como línea separada.**
- Precio de venta neto ≠ Precio de venta con IVA.
- Precio final = Precio neto × (1 + tasa IVA).
- Tasa IVA por defecto: **21%** (configurable por account).
- `Account.taxStatus = "responsable_inscripto"` → IVA explícito.

### Costo incluye o no IVA (Decisión RI)
- **Para RI:** Pregunta en onboarding: "¿Tu costo de compra incluye IVA?"
- Si incluye: `Account.includeIvaInCost = true` → Hay que extraer IVA del costo para cálculos de margen.
- Si no incluye: `Account.includeIvaInCost = false` → El costo es neto, se suma IVA aparte.

**Fórmula de Costo Unitario:**
```
unitCost = acquisitionCost + rawMaterialCost + laborCost + packagingCost

Si includeIvaInCost = true:
  unitCostNeto = unitCost / (1 + ivaRate/100)
  [Usamos unitCostNeto para márgenes]
```

---

## 2. Cálculo de Costo Unitario

**NO es solo el precio de compra.** Es la suma de todos los insumos:

```
unitCost = acquisitionCost + rawMaterialCost + laborCost + packagingCost

Donde:
  acquisitionCost   = Precio de compra al proveedor
  rawMaterialCost   = Materia prima adicional
  laborCost         = Mano de obra directa (por unidad)
  packagingCost     = Packaging, flete, manutención, etc.
```

**Ejemplo:**
- Adquisición: $100
- Materia prima extra: $5
- Mano de obra: $3
- Packaging: $2
- **unitCost = $110**

---

## 3. Listas de Precios

### Estructura
- **Mínimo 2 listas:** Minorista y Mayorista.
- Cada lista puede tener N productos.
- Cada producto en cada lista tiene su propio **markup %**.

### Cálculo de Precio de Venta
```
salePrice = unitCost × (1 + markupPct / 100)

Ejemplo:
  unitCost = $100
  markupPct = 50% (Minorista)
  salePrice = $100 × 1.5 = $150
```

### Con IVA (solo para RI)
```
salePriceWithIVA = salePrice × (1 + ivaRate / 100)

Ejemplo (RI con 21% IVA):
  salePrice = $150
  salePriceWithIVA = $150 × 1.21 = $181.50
```

**En reportes:**
- Para Monotributista: mostrar solo `salePrice`.
- Para RI: mostrar ambos (`salePrice` neto + `salePriceWithIVA` con IVA).

---

## 4. Contribución Marginal y Margen %

### Por unidad
```
contributionMarginUnit (CMu) = salePrice - unitCost
marginPct (%) = CMu / salePrice × 100

Ejemplo:
  salePrice = $150
  unitCost = $100
  CMu = $50
  marginPct = 50 / 150 × 100 = 33.33%
```

### Total por venta
```
contributionMarginTotal = CMu × quantity

Ejemplo:
  CMu = $50
  quantity = 5 unidades
  contributionMarginTotal = $250
```

### Separado por lista (Mayorista vs Minorista)
- CMuMin, MarginMin% — para lista Minorista
- CMuMay, MarginMay% — para lista Mayorista
- **Son cálculos distintos según markup de cada lista.**

---

## 5. Stock — Método PEPS

**PEPS = Primero Entrado, Primero Salido.**

### Saldo actual
```
currentStock = initialStock + ingresos - salidas + ajustes

Donde:
  initialStock        = Stock inicial del producto
  ingresos            = Compras + Ingresos de mercadería
  salidas             = Ventas
  ajustes             = Ajustes manuales (recount, pérdida, robo)
```

### Valuación de stock (PEPS)
```
Iterar movimientos por fecha (FIFO):
  Para cada venta, tomar el costo del movimiento de compra más antiguo no consumido.
  
Ejemplo:
  Compra 1: 10 unidades @ $100 = $1,000
  Compra 2: 5 unidades @ $110 = $550
  Venta 1: 12 unidades

  → Usa 10 unidades @ $100 de Compra 1 = $1,000
  → Usa 2 unidades @ $110 de Compra 2 = $220
  → Costo variable de Venta 1 = $1,220
```

### Stock valuado
```
valuedStock = currentStock × unitCost

Nota: unitCost es el costo ACTUAL del producto.
Para reportes históricos, usar el costo snapshot del momento.
```

### Alerta de stock bajo
```
Si currentStock < minStock → Mostrar alerta.
```

---

## 6. Ventas (Carga de Ingresos)

### Campos obligatorios
- **Producto:** FK a products.
- **Clasificación:** FK a product_categories.
- **Fecha:** Fecha de la venta.
- **Origen:** "mayorista" o "minorista" (define la lista de precios).
- **Cantidad:** Unidades vendidas.
- **Precio unitario:** El precio realmente cobrado (puede diferir de la lista por descuento).
- **Costo unitario:** Snapshot del costo al momento de la venta (para reportes).
- **Cliente tipo:** Tipo de cliente (libre, ej: "Particular", "Empresa").
- **Facturado:** Booleano (S/N).

### Cálculos automáticos
```
subtotal = unitPrice × quantity × (1 - discountPct/100)

ivaAmount = subtotal × ivaRate/100    [solo si RI]

total = subtotal + ivaAmount

variableCostTotal = unitCost × quantity

contributionMargin = subtotal - variableCostTotal
marginPct = (contributionMargin / subtotal) × 100
```

### Medios de cobro (hasta 3)
```
[Hasta 3 cobros parciales]

Cada cobro:
  - Método de pago (FK a payment_methods)
  - Monto
  - Fecha de pago
  - Acreditación automática = paymentDate + method.accreditationDays
```

### Estado de cobro
```
status = "pending" | "partial" | "paid" | "overdue"

Si totalPaid = 0:              status = "pending"
Si 0 < totalPaid < total:      status = "partial"
Si totalPaid >= total:         status = "paid"
Si dueDate < TODAY y status != "paid": status = "overdue"
```

### Actualización de stock
```
Al crear una venta:
  1. Crear StockMovement: type="sale", quantity=-cantidad, unitCost=snapshot
  2. currentStock se actualiza automáticamente (via query)
  3. Si currentStock < minStock: alerta
```

---

## 7. Egresos / Compras

### Campos obligatorios
- **Proveedor:** FK a suppliers (opcional para costos genéricos).
- **Producto:** FK a products (opcional si es gasto sin producto).
- **Clasificación de costo:** FK a cost_categories.
- **Tipo costo:** "variable" | "fijo" | "impuestos".
- **Fecha de factura:** Fecha de la compra.
- **Costo unitario:** Costo por unidad.
- **Cantidad:** Unidades compradas.
- **Descuento %:** Descuento aplicado.
- **IVA:** Monto de IVA (calculado o manual).
- **Nro factura:** Para referencia.
- **Vencimiento:** Fecha de vencimiento de pago.

### Cálculos automáticos
```
subtotal = unitCost × quantity × (1 - discountPct/100)

total = subtotal + ivaAmount

totalPaid = SUM(purchase_payments.amount)
```

### Medios de pago (hasta 2)
```
Cada pago:
  - Método de pago (FK a payment_methods)
  - Monto
  - Fecha de pago
  - Acreditación automática = paymentDate + method.accreditationDays
```

### Estado de pago
```
status = "pending" | "partial" | "paid" | "overdue"
[Igual lógica que en ventas]
```

### Actualización de stock (si es compra de producto)
```
Al crear una compra con product_id:
  1. Crear StockMovement: type="purchase", quantity=cantidad, unitCost=unitCost
  2. currentStock se actualiza automáticamente
  3. Actualizar Product.lastCostUpdate = now()
  4. Si es nueva compra, actualizar unitCost del producto (promedio ponderado o último costo)
```

---

## 8. Clasificaciones de Costos

Los egresos se clasifican en 3 tipos para análisis económico:

### Costos Variables
- Dependen directamente de la cantidad vendida.
- Ejemplos: Costo de mercadería, Materia prima, Flete por venta.
- **Variable en reportes económicos.**

### Costos Fijos
- No dependen de la cantidad vendida.
- Ejemplos: Alquiler, Sueldos, Servicios (luz, agua, internet).
- **Fijo en reportes económicos.**

### Impuestos
- Impuestos a cargo del negocio.
- Ejemplos: IVA (si RI), Ingresos Brutos, Monotributo.
- **Separado en reportes económicos.**

---

## 9. Medios de Pago/Cobro

### Acreditación automática
```
accreditationDate = paymentDate + paymentMethod.accreditationDays

Ejemplo:
  paymentDate = 2025-02-25
  method = "Cheque" (2 días)
  accreditationDate = 2025-02-27
```

### Medios por defecto (seed data)
- **Efectivo:** 0 días
- **Transferencia bancaria:** 0 días
- **Cheque:** 2 días
- **Cheque diferido 30 días:** 32 días (30 + 2 bancos)
- **Cheque diferido 45 días:** 47 días (45 + 2 bancos)
- **Cheque diferido 60 días:** 62 días (60 + 2 bancos)
- **Mercado Pago:** 0 días
- **Tarjeta de crédito:** 18 días (fecha de corte + 15 días pago)
- **Tarjeta de débito:** 3 días

Configurable por account (cada negocio puede cambiar plazos).

---

## 10. Flujo de Fondos (Cuentas Bancarias)

### Saldos por banco
```
Cada BankAccount tiene:
  - initialBalance (manual)
  - balanceDate (fecha del saldo inicial)

currentBalance = initialBalance + SUM(
  CASE
    WHEN movementType = "ingreso" THEN amount
    WHEN movementType = "egreso" THEN -amount
    ELSE 0
  END
)
```

### Origen de movimientos
- **Ingresos:** Cobros de ventas (con acreditación real, no con fecha de cobro).
- **Egresos:** Pagos de compras.
- **Transferencias:** Movimientos entre bancos.
- **Apertura:** Saldo inicial.

---

## 11. Estados de Resultados (Económico y Financiero)

### Estado Financiero (Mensual)
```
Saldo Inicial
  + Cobranzas (dinero que ENTRA realmente acreditado)
  - Pagos (dinero que SALE realmente acreditado)
  = Superávit/Déficit

Nota: Usa accreditationDate, no paymentDate.
```

### Estado Económico (Mensual)
```
Ventas totales (por saleDate)
  - Costos Variables totales
  = Contribución Marginal (CM)
  - Costos Fijos totales
  = Resultado Bruto (EBITDA)
  [- Impuestos no incluidos en costos]
  = Resultado Neto

Nota: Usa fecha de transacción, no fecha de cobro/pago.
```

### Métricas por mes
```
Índice de Variabilidad = Costo Variable / Ventas × 100

Margen de Contribución % = CM / Ventas × 100

Incidencia de Costos Fijos = CF / Ventas × 100

Utilidad antes de impuestos = Resultado Bruto
```

---

## 12. Cashflow Proyectado (Semanal)

### Estructura
```
Proyección semanal (bloques de ~7 días por mes, no calendario):

Semana 1: 1-7
Semana 2: 8-14
Semana 3: 15-21
Semana 4: 22-28
Semana 5: 29-31 (si hay)

Por semana:
  Saldo Inicial (banco por banco)
  + Ingresos estimados (por acreditación)
  - Egresos estimados (por vencimiento)
  = Saldo Final (banco por banco)
```

### Cálculo de ingresos proyectados
```
Para cada venta SIN COBRAR:
  Ingresos = monto del cobro
  Semana = semana de accreditationDate (payment_date + accreditation_days)
```

### Cálculo de egresos proyectados
```
Para cada compra SIN PAGAR:
  Egresos = monto del pago
  Semana = semana de dueDate (del pago)
```

### Qué-pasaría-si
```
El usuario puede:
  - Cambiar fecha de vencimiento de una compra (slider)
  - Cambiar fecha de cobro esperado de una venta (slider)
  - Ver impacto en saldos finales en tiempo real
```

---

## 13. Cuadro Resumen (KPIs Mensuales)

### Estructura
```
Mes: [Selector]

| Concepto | Proyectado | Real | Variación |
|---|---|---|---|
| Ventas | $ | $ | ±% |
| Rentabilidad | % | % | ±pp |
| Utilidad | $ | $ | ±$ |
| Utilidad USD | $ | $ | ±$ |

Ticket promedio: $ | $ | ±$
CM promedio: % | % | ±pp
Cantidad ventas: # | # | ±#
% Cobrados: % | % | ±pp
Monto pendiente: $ | $ | ±$
```

### Campos editables
- Proyectado de Ventas (manual, editable)
- Tipo de cambio (manual, editable)

### Cálculos automáticos
- Real de Ventas (suma de sales del mes)
- Rentabilidad (CM / Ventas × 100)
- Utilidad (CM - CF del mes)
- Utilidad USD (Utilidad / tipo de cambio)
- Ticket promedio (Ventas / cantidad de transacciones)
- CM promedio (CM / cantidad de transacciones)
- % Cobrados (totalCobrado / totalVentas × 100)
- Monto pendiente (totalVentas - totalCobrado)

---

## 14. Puntos de Venta (POS)

### Flujo de venta rápida
```
1. Seleccionar lista de precios (Minorista / Mayorista)
2. Buscar producto (por código de barras o nombre)
3. Ingresar cantidad (spinner o teclado numérico)
4. Sistema mostraderiva:
   - Costo unitario
   - PV de la lista
   - CM unitario
   - Subtotal
5. Seleccionar cliente (opcional)
6. Seleccionar vendedor (con comisión %)
7. Seleccionar medio de pago (Efectivo, TC, TD, etc.)
8. Confirmar y generar remito/ticket
9. Imprimir o enviar email
```

### Cálculos en tiempo real
```
- Precio de venta (desde lista)
- Costo variable
- Margen por venta
- Comisión del vendedor
```

---

## 15. Multi-sucursal

### Estructura
```
Account
  └── Branch 1 (sucursal A)
      └── sales, purchases, stock (de sucursal A)
  └── Branch 2 (sucursal B)
      └── sales, purchases, stock (de sucursal B)
  └── Consolidado (reportes a nivel account)
```

### Cada transacción tiene branch_id
- Ventas: branch_id (de qué sucursal es la venta)
- Compras: branch_id (para qué sucursal se compra)
- Stock: branch_id (stock por sucursal)

### Reportes
- Por sucursal (filtrar por branch_id)
- Consolidado (sin filtro)

---

## 16. Onboarding de nuevas cuentas

### Paso 1: Crear Account
```
- Nombre del negocio
- Régimen impositivo (Monotributista / RI)
- Si RI: ¿Costo incluye IVA?
- Tasa IVA (default 21%, editable)
```

### Paso 2: Seed data
```
Auto-crear:
  - 9 payment_methods (Efectivo, Cheque, Cheque Dif 30/45/60, etc.)
  - 2 price_lists (Minorista, Mayorista)
  - 8 cost_categories (Mercadería, Alquiler, Servicios, Sueldos, IVA, Ingresos Brutos, Monotributo, Otros)
  - 1 branch por defecto (nombre = "Principal")
  - 1 bank_account por defecto (nombre = "Efectivo", initialBalance = 0)
```

### Paso 3: Crear usuario admin
```
- Email
- Invitar a Supabase Auth
```

---

## 17. Transacciones y referencia de datos

### Relaciones clave
```
Product
  ← Vendido en: Sale (productId)
  ← Comprado en: Purchase (productId)
  ← Tiene movimiento de stock: StockMovement (productId)
  ← Tiene precio en: PriceListItem (productId)

Sale
  → Genera StockMovement (type="sale")
  → Genera SalePayment (referencia a payment)

Purchase
  → Actualiza Product.lastCostUpdate
  → Genera StockMovement (type="purchase")
  → Genera PurchasePayment (referencia a payment)
```

### Cascadas de eliminación
- Account delete → Borra todo (cascada)
- Product delete → No permitir si hay ventas/compras históricas
- PriceList delete → Cascada (PriceListItem)
- CostCategory delete → No permitir si hay egresos
- PaymentMethod delete → No permitir si hay cobros/pagos

---

## 18. Casos especiales

### ¿Qué pasa si cambio unitCost de un producto?
```
- No afecta costos históricos de ventas/compras (tienen unitCost snapshot).
- Afecta futuras transacciones.
- Afecta valuación actual de stock (unitCost × currentStock).
```

### ¿Qué pasa si cambio el markup de una lista de precios?
```
- No afecta precios históricos de ventas.
- Afecta futuras ventas con esa lista.
```

### ¿Qué pasa si vendo más unidades de las que tengo en stock?
```
- Se permite (overselling).
- currentStock puede ser negativo (backorder).
- Generar alerta visual.
```

### ¿Qué pasa si elimino una clasificación con productos/costos?
```
- No permitir eliminación (constraint).
- Opción: marcar como inactivo (soft delete).
```

---

*Documento vivo. Actualizar cuando se descubran nuevos requerimientos.*
