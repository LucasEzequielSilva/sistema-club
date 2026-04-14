"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

type Product = { id: string; name: string; unitCost: number };
type Supplier = { id: string; name: string };
type CostCategory = { id: string; name: string; costType: string };
type PaymentMethod = { id: string; name: string; accreditationDays: number };
type PaymentChannel = {
  id: string;
  name: string;
  paymentMethodId: string | null;
  paymentAccount?: { id: string; name: string };
  isActive: boolean;
};

type IvaMode = "0" | "10.5" | "21" | "custom";

// Un ítem dentro de la compra
type PurchaseItem = {
  productId: string;
  description: string;
  costCategoryId: string;
  unitCost: string;
  quantity: string;
  discountPct: string;
  ivaMode: IvaMode;
  ivaCustom: string;
  updateProductCost: boolean;
};

type InlinePayment = {
  paymentMethodId: string;
  paymentChannelId: string;
  amount: string;
  paymentDate: string;
};

// Cabecera de la compra (compartida por todos los ítems)
type Header = {
  supplierId: string;
  invoiceDate: string;
  invoiceNumber: string;
  dueDate: string;
  notes: string;
};

function formatLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDateInput(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

const EMPTY_ITEM: PurchaseItem = {
  productId: "",
  description: "",
  costCategoryId: "",
  unitCost: "0",
  quantity: "1",
  discountPct: "0",
  ivaMode: "21",
  ivaCustom: "0",
  updateProductCost: true,
};

const EMPTY_HEADER: Header = {
  supplierId: "",
  invoiceDate: formatLocalDateInput(new Date()),
  invoiceNumber: "",
  dueDate: "",
  notes: "",
};

function calcItemIva(item: PurchaseItem): number {
  const cost = parseFloat(item.unitCost) || 0;
  const qty = parseFloat(item.quantity) || 0;
  const disc = parseFloat(item.discountPct) || 0;
  const sub = cost * qty * (1 - disc / 100);
  if (item.ivaMode === "0") return 0;
  if (item.ivaMode === "10.5") return Math.round(sub * 0.105 * 100) / 100;
  if (item.ivaMode === "21") return Math.round(sub * 0.21 * 100) / 100;
  return parseFloat(item.ivaCustom) || 0;
}

function calcItemSubtotal(item: PurchaseItem): number {
  const cost = parseFloat(item.unitCost) || 0;
  const qty = parseFloat(item.quantity) || 0;
  const disc = parseFloat(item.discountPct) || 0;
  return cost * qty * (1 - disc / 100);
}

function calcItemTotal(item: PurchaseItem): number {
  return calcItemSubtotal(item) + calcItemIva(item);
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-componente: fila de ítem
// ────────────────────────────────────────────────────────────────────────────
function ItemRow({
  item,
  index,
  products,
  costCategories,
  onChange,
  onRemove,
  canRemove,
}: {
  item: PurchaseItem;
  index: number;
  products: Product[];
  costCategories: CostCategory[];
  onChange: (idx: number, updated: PurchaseItem) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}) {
  const set = (field: keyof PurchaseItem, value: string | boolean) =>
    onChange(index, { ...item, [field]: value });

  const isProductPurchase = !!item.productId;

  // Cuando se selecciona un producto, pre-llenar el costo
  const handleProductChange = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    onChange(index, {
      ...item,
      productId,
      unitCost: p ? String(p.unitCost) : item.unitCost,
    });
  };

  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Ítem {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Producto + Descripción */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Producto</Label>
          <Select
            value={item.productId || "none"}
            onValueChange={(v) => handleProductChange(v === "none" ? "" : v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Sin producto (gasto)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin producto (gasto)</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">
            Descripción{!isProductPurchase && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          <Input
            value={item.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={isProductPurchase ? "Opcional..." : "Ej: Alquiler, Internet..."}
            className="h-9"
          />
        </div>
      </div>

      {/* Clasificación */}
      <div>
        <Label className="text-xs">
          Clasificación de costo <span className="text-red-500">*</span>
        </Label>
        <Select
          value={item.costCategoryId || "none"}
          onValueChange={(v) => set("costCategoryId", v === "none" ? "" : v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Seleccionar...</SelectItem>
            {costCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}{" "}
                <span className="text-muted-foreground text-xs">
                  ({c.costType === "variable" ? "Var." : c.costType === "fijo" ? "Fijo" : "Imp."})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cantidad + Costo + Descuento */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Cantidad</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={item.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Costo unit. (sin IVA)</Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={item.unitCost}
              onChange={(e) => set("unitCost", e.target.value)}
              className="h-9 pl-6"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Descuento %</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={item.discountPct}
            onChange={(e) => set("discountPct", e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* IVA */}
      <div className="space-y-1.5">
        <Label className="text-xs">IVA</Label>
        <div className="flex gap-1.5 flex-wrap">
          {(["0", "10.5", "21", "custom"] as IvaMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => set("ivaMode", mode)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                item.ivaMode === mode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {mode === "0" ? "Sin IVA" : mode === "custom" ? "Otro" : `${mode}%`}
            </button>
          ))}
        </div>
        {item.ivaMode === "custom" && (
          <div className="relative max-w-[160px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={item.ivaCustom}
              onChange={(e) => set("ivaCustom", e.target.value)}
              className="h-9 pl-6"
              placeholder="Monto IVA..."
            />
          </div>
        )}
      </div>

      {/* Actualizar costo del producto */}
      {isProductPurchase && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`updateCost-${index}`}
            checked={item.updateProductCost}
            onChange={(e) => set("updateProductCost", e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <label htmlFor={`updateCost-${index}`} className="text-xs text-muted-foreground">
            Actualizar costo del producto con esta compra
          </label>
        </div>
      )}

      {/* Mini resumen del ítem */}
      <div className="flex justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
        <span>Subtotal: <span className="font-mono">{formatCurrency(calcItemSubtotal(item))}</span></span>
        <span>IVA: <span className="font-mono">{formatCurrency(calcItemIva(item))}</span></span>
        <span className="font-semibold text-foreground">Total: <span className="font-mono">{formatCurrency(calcItemTotal(item))}</span></span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────────────────────
export function PurchaseDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: PurchaseDialogProps) {
  const [header, setHeader] = useState<Header>(EMPTY_HEADER);
  const [items, setItems] = useState<PurchaseItem[]>([{ ...EMPTY_ITEM }]);
  const [payments, setPayments] = useState<InlinePayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Lookups
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);

  // Load lookups
  useEffect(() => {
    if (!open) return;

    trpc.productos.list
      .query({ accountId, isActive: true })
      .then((prods: any[]) =>
        setProducts(prods.map((p) => ({ id: p.id, name: p.name, unitCost: p.unitCost ?? 0 })))
      )
      .catch(() => {});

    trpc.proveedores.list
      .query({ accountId, isActive: true })
      .then((supps: any[]) =>
        setSuppliers(supps.map((s) => ({ id: s.id, name: s.name })))
      )
      .catch(() => {});

    trpc.clasificaciones.listCostCategories
      .query({ accountId })
      .then((cats: any[]) =>
        setCostCategories(
          cats.filter((c: any) => c.isActive).map((c: any) => ({
            id: c.id,
            name: c.name,
            costType: c.costType,
          }))
        )
      )
      .catch(() => {});

    trpc.clasificaciones.listPaymentMethods
      .query({ accountId })
      .then((methods: any[]) =>
        setPaymentMethods(
          methods.filter((m: any) => m.isActive).map((m: any) => ({
            id: m.id,
            name: m.name,
            accreditationDays: m.accreditationDays,
          }))
        )
      )
      .catch(() => {});

    trpc.clasificaciones.listPaymentChannels
      .query({ accountId, isActive: true })
      .then((channels: any[]) => {
        setPaymentChannels(channels.filter((c: any) => c.isActive));
      })
      .catch(() => {});
  }, [open, accountId]);

  // Load editing data (modo ítem único)
  useEffect(() => {
    if (!open) return;

    if (editingId) {
      setFetching(true);
      trpc.compras.getById
        .query({ id: editingId })
        .then((p: any) => {
          setHeader({
            supplierId: p.supplierId ?? "",
            invoiceDate: formatLocalDateInput(new Date(p.invoiceDate)),
            invoiceNumber: p.invoiceNumber ?? "",
            dueDate: p.dueDate ? formatLocalDateInput(new Date(p.dueDate)) : "",
            notes: p.notes ?? "",
          });
          setItems([{
            productId: p.productId ?? "",
            description: p.description ?? "",
            costCategoryId: p.costCategoryId,
            unitCost: String(p.unitCost),
            quantity: String(p.quantity),
            discountPct: String(p.discountPct),
            ivaMode: "custom",
            ivaCustom: String(p.ivaAmount),
            updateProductCost: false,
          }]);
          setPayments([]);
        })
        .catch(() => toast.error("No se pudo cargar la compra"))
        .finally(() => setFetching(false));
    } else {
      setHeader(EMPTY_HEADER);
      setItems([{ ...EMPTY_ITEM }]);
      setPayments([]);
    }
  }, [open, editingId]);

  // Totales globales
  const grandTotal = items.reduce((sum, it) => sum + calcItemTotal(it), 0);
  const totalPayments = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  // Helpers ítems
  const updateItem = (idx: number, updated: PurchaseItem) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  // Helpers pagos
  const addPaymentRow = () => {
    if (payments.length >= 3) { toast.error("Máximo 3 medios de pago"); return; }
    setPayments((prev) => [
      ...prev,
      {
        paymentMethodId: "",
        paymentChannelId: "",
        amount: String(Math.max(grandTotal - totalPayments, 0).toFixed(2)),
        paymentDate: header.invoiceDate,
      },
    ]);
  };

  const removePaymentRow = (idx: number) =>
    setPayments((prev) => prev.filter((_, i) => i !== idx));

  const updatePayment = (idx: number, field: keyof InlinePayment, value: string) =>
    setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Validaciones
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.costCategoryId) {
        toast.error(`Ítem ${i + 1}: seleccioná una clasificación de costo`);
        return;
      }
      if (!it.productId && !it.description.trim()) {
        toast.error(`Ítem ${i + 1}: ingresá un producto o descripción`);
        return;
      }
    }

    setLoading(true);
    try {
      if (editingId) {
        // Edición — solo un ítem
        const it = items[0];
        const ivaAmount = calcItemIva(it);
        await trpc.compras.update.mutate({
          id: editingId,
          supplierId: header.supplierId || null,
          costCategoryId: it.costCategoryId,
          invoiceDate: parseLocalDateInput(header.invoiceDate),
          description: it.description || null,
          unitCost: parseFloat(it.unitCost) || 0,
          quantity: parseFloat(it.quantity) || 0,
          discountPct: parseFloat(it.discountPct) || 0,
          ivaAmount,
          invoiceNumber: header.invoiceNumber || null,
          dueDate: header.dueDate ? parseLocalDateInput(header.dueDate) : null,
          notes: header.notes || null,
        });
        toast.success("Compra actualizada");
      } else {
        // Creación — N ítems, pagos en el primero
        const validPayments = payments
          .filter((p) => p.paymentMethodId && parseFloat(p.amount) > 0)
          .map((p) => ({
            paymentMethodId: p.paymentMethodId,
            paymentChannelId: p.paymentChannelId || null,
            amount: parseFloat(p.amount),
            paymentDate: parseLocalDateInput(p.paymentDate),
          }));

        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const ivaAmount = calcItemIva(it);
          const unitCost = parseFloat(it.unitCost) || 0;

          await trpc.compras.create.mutate({
            accountId,
            supplierId: header.supplierId || null,
            productId: it.productId || null,
            costCategoryId: it.costCategoryId,
            invoiceDate: parseLocalDateInput(header.invoiceDate),
            description: it.description || undefined,
            unitCost,
            quantity: parseFloat(it.quantity) || 0,
            discountPct: parseFloat(it.discountPct) || 0,
            ivaAmount,
            invoiceNumber: header.invoiceNumber || undefined,
            dueDate: header.dueDate ? parseLocalDateInput(header.dueDate) : null,
            notes: header.notes || undefined,
            // Los pagos van solo en el primer ítem
            payments: i === 0 ? validPayments : [],
          });

          // Actualizar costo del producto si corresponde
          if (it.productId && it.updateProductCost) {
            try {
              await trpc.productos.update.mutate({
                id: it.productId,
                acquisitionCost: unitCost,
                rawMaterialCost: 0,
                laborCost: 0,
                packagingCost: 0,
                effectiveDate: parseLocalDateInput(header.invoiceDate),
              });
            } catch {
              // No crítico
            }
          }
        }

        const count = items.length;
        toast.success(count === 1 ? "Compra registrada" : `${count} ítems registrados`);
      }

      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar" : "Nueva"} Compra</DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modificá los datos de la compra"
              : "Registrá una compra con uno o más artículos"}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── CABECERA ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Proveedor</Label>
                <Select
                  value={header.supplierId || "none"}
                  onValueChange={(v) => setHeader((h) => ({ ...h, supplierId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoiceDate">Fecha Factura <span className="text-red-500">*</span></Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={header.invoiceDate}
                  onChange={(e) => setHeader((h) => ({ ...h, invoiceDate: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="invoiceNumber">Nro. Factura</Label>
                <Input
                  id="invoiceNumber"
                  value={header.invoiceNumber}
                  onChange={(e) => setHeader((h) => ({ ...h, invoiceNumber: e.target.value }))}
                  placeholder="A-0001-00001234"
                />
              </div>
              <div>
                <Label htmlFor="dueDate">Vencimiento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={header.dueDate}
                  onChange={(e) => setHeader((h) => ({ ...h, dueDate: e.target.value }))}
                />
              </div>
            </div>

            {/* ── ÍTEMS ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Artículos{" "}
                  <span className="text-muted-foreground font-normal text-sm">({items.length})</span>
                </Label>
                {!editingId && (
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Agregar artículo
                  </Button>
                )}
              </div>

              {items.map((item, idx) => (
                <ItemRow
                  key={idx}
                  item={item}
                  index={idx}
                  products={products}
                  costCategories={costCategories}
                  onChange={updateItem}
                  onRemove={removeItem}
                  canRemove={items.length > 1}
                />
              ))}
            </div>

            {/* ── TOTAL GLOBAL (si hay más de 1 ítem) ── */}
            {items.length > 1 && (
              <div className="flex justify-between items-center bg-muted/40 rounded-xl px-4 py-3 text-sm font-semibold">
                <span className="text-muted-foreground">Total de la compra ({items.length} ítems)</span>
                <span className="font-mono text-lg">{formatCurrency(grandTotal)}</span>
              </div>
            )}

            {/* ── NOTAS ── */}
            <div>
              <Label htmlFor="notes">Notas</Label>
              <textarea
                id="notes"
                value={header.notes}
                onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))}
                placeholder="Observaciones..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* ── PAGOS (solo en creación) ── */}
            {!editingId && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Pagos</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPaymentRow}
                    disabled={payments.length >= 3}
                  >
                    + Agregar Pago {payments.length >= 3 && "(máx. 3)"}
                  </Button>
                </div>

                {payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sin pagos registrados — la compra quedará como &quot;Pendiente&quot;.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_120px_140px_auto] gap-2 items-end">
                        <div>
                          <Label className="text-xs">Método</Label>
                          <Select
                            value={payment.paymentMethodId || "none"}
                            onValueChange={(v) => updatePayment(idx, "paymentMethodId", v === "none" ? "" : v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Seleccionar...</SelectItem>
                              {paymentMethods.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Canal</Label>
                          <Select
                            value={payment.paymentChannelId || "none"}
                            onValueChange={(v) => updatePayment(idx, "paymentChannelId", v === "none" ? "" : v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Automático" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Automático</SelectItem>
                              {paymentChannels
                                .filter(
                                  (ch) =>
                                    !payment.paymentMethodId ||
                                    !ch.paymentMethodId ||
                                    ch.paymentMethodId === payment.paymentMethodId
                                )
                                .map((ch) => (
                                  <SelectItem key={ch.id} value={ch.id}>
                                    {ch.name}
                                    {ch.paymentAccount?.name ? ` · ${ch.paymentAccount.name}` : ""}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Monto</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={payment.amount}
                            onChange={(e) => updatePayment(idx, "amount", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fecha pago</Label>
                          <Input
                            type="date"
                            value={payment.paymentDate}
                            onChange={(e) => updatePayment(idx, "paymentDate", e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-red-500 mb-0.5"
                          onClick={() => removePaymentRow(idx)}
                        >
                          X
                        </Button>
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>Total pagos: {formatCurrency(totalPayments)}</span>
                      <span>Pendiente: {formatCurrency(Math.max(grandTotal - totalPayments, 0))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : editingId ? "Guardar" : `Registrar${items.length > 1 ? ` (${items.length} ítems)` : ""}`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
