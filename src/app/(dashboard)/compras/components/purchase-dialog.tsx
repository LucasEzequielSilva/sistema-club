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

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

type Product = { id: string; name: string };
type Supplier = { id: string; name: string };
type CostCategory = { id: string; name: string; costType: string };
type PaymentMethod = { id: string; name: string; accreditationDays: number };

type InlinePayment = {
  paymentMethodId: string;
  amount: string;
  paymentDate: string;
};

type IvaMode = "0" | "10.5" | "21" | "custom";

type FormState = {
  supplierId: string;
  productId: string;
  costCategoryId: string;
  invoiceDate: string;
  description: string;
  unitCost: string;
  quantity: string;
  discountPct: string;
  ivaAmount: string;
  ivaMode: IvaMode;
  invoiceNumber: string;
  dueDate: string;
  notes: string;
  updateProductCost: boolean;
};

const EMPTY: FormState = {
  supplierId: "",
  productId: "",
  costCategoryId: "",
  invoiceDate: new Date().toISOString().split("T")[0],
  description: "",
  unitCost: "0",
  quantity: "1",
  discountPct: "0",
  ivaAmount: "0",
  ivaMode: "21",
  invoiceNumber: "",
  dueDate: "",
  notes: "",
  updateProductCost: true,
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

export function PurchaseDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: PurchaseDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [payments, setPayments] = useState<InlinePayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Lookups
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Load lookups
  useEffect(() => {
    if (!open) return;

    trpc.productos.list
      .query({ accountId, isActive: true })
      .then((prods: any[]) =>
        setProducts(prods.map((p) => ({ id: p.id, name: p.name })))
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
          cats
            .filter((c: any) => c.isActive)
            .map((c: any) => ({
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
          methods
            .filter((m: any) => m.isActive)
            .map((m: any) => ({
              id: m.id,
              name: m.name,
              accreditationDays: m.accreditationDays,
            }))
        )
      )
      .catch(() => {});
  }, [open, accountId]);

  // Load editing data
  useEffect(() => {
    if (!open) return;

    if (editingId) {
      setFetching(true);
      trpc.compras.getById
        .query({ id: editingId })
        .then((p: any) => {
          setForm({
            supplierId: p.supplierId ?? "",
            productId: p.productId ?? "",
            costCategoryId: p.costCategoryId,
            invoiceDate: new Date(p.invoiceDate).toISOString().split("T")[0],
            description: p.description ?? "",
            unitCost: String(p.unitCost),
            quantity: String(p.quantity),
            discountPct: String(p.discountPct),
            ivaAmount: String(p.ivaAmount),
            ivaMode: "custom",
            invoiceNumber: p.invoiceNumber ?? "",
            dueDate: p.dueDate
              ? new Date(p.dueDate).toISOString().split("T")[0]
              : "",
            notes: p.notes ?? "",
            updateProductCost: false,
          });
        })
        .catch(() => toast.error("No se pudo cargar la compra"))
        .finally(() => setFetching(false));
    } else {
      setForm(EMPTY);
      setPayments([]);
    }
  }, [open, editingId]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Live calculations
  const unitCost = parseFloat(form.unitCost) || 0;
  const quantity = parseFloat(form.quantity) || 0;
  const discountPct = parseFloat(form.discountPct) || 0;
  const subtotal = unitCost * quantity * (1 - discountPct / 100);

  // IVA calculado según el modo
  const computedIva: number = (() => {
    if (form.ivaMode === "0") return 0;
    if (form.ivaMode === "10.5") return Math.round(subtotal * 0.105 * 100) / 100;
    if (form.ivaMode === "21") return Math.round(subtotal * 0.21 * 100) / 100;
    return parseFloat(form.ivaAmount) || 0; // custom
  })();
  const ivaAmount = computedIva;
  const total = subtotal + ivaAmount;
  const totalPayments = payments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0
  );

  // Determine if this is a product purchase or a generic expense
  const isProductPurchase = !!form.productId;

  // Payment helpers
  const addPaymentRow = () => {
    if (payments.length >= 2) {
      toast.error("Máximo 2 medios de pago por compra");
      return;
    }
    setPayments((prev) => [
      ...prev,
      {
        paymentMethodId: "",
        amount: String(Math.max(total - totalPayments, 0).toFixed(2)),
        paymentDate: form.invoiceDate,
      },
    ]);
  };

  const removePaymentRow = (index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePayment = (
    index: number,
    field: keyof InlinePayment,
    value: string
  ) => {
    setPayments((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.costCategoryId) {
      toast.error("Seleccioná una clasificación de costo");
      return;
    }

    // Must have either product or description
    if (!form.productId && !form.description.trim()) {
      toast.error("Ingresá un producto o una descripción del gasto");
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await trpc.compras.update.mutate({
          id: editingId,
          supplierId: form.supplierId || null,
          costCategoryId: form.costCategoryId,
          invoiceDate: new Date(form.invoiceDate),
          description: form.description || null,
          unitCost,
          quantity,
          discountPct,
          ivaAmount,
          invoiceNumber: form.invoiceNumber || null,
          dueDate: form.dueDate ? new Date(form.dueDate) : null,
          notes: form.notes || null,
        });
        toast.success("Compra actualizada");
      } else {
        // Validate inline payments
        const validPayments = payments
          .filter((p) => p.paymentMethodId && parseFloat(p.amount) > 0)
          .map((p) => ({
            paymentMethodId: p.paymentMethodId,
            amount: parseFloat(p.amount),
            paymentDate: new Date(p.paymentDate),
          }));

        await trpc.compras.create.mutate({
          accountId,
          supplierId: form.supplierId || null,
          productId: form.productId || null,
          costCategoryId: form.costCategoryId,
          invoiceDate: new Date(form.invoiceDate),
          description: form.description || undefined,
          unitCost,
          quantity,
          discountPct,
          ivaAmount,
          invoiceNumber: form.invoiceNumber || undefined,
          dueDate: form.dueDate ? new Date(form.dueDate) : null,
          notes: form.notes || undefined,
          payments: validPayments,
        });

        // Si corresponde, actualizar el costo del producto
        if (isProductPurchase && form.updateProductCost && form.productId) {
          try {
            await trpc.productos.update.mutate({
              id: form.productId,
              acquisitionCost: unitCost,
              rawMaterialCost: 0,
              laborCost: 0,
              packagingCost: 0,
            });
          } catch {
            // No crítico — la compra ya se guardó
          }
        }

        toast.success("Compra registrada");
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
          <DialogTitle>
            {editingId ? "Editar" : "Nueva"} Compra
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modificá los datos de la compra"
              : "Registrá una nueva compra o gasto"}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-gray-400">Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Supplier + Cost Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Proveedor</Label>
                <Select
                  value={form.supplierId || "none"}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      supplierId: v === "none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  Clasificación de Costo <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.costCategoryId || "none"}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      costCategoryId: v === "none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleccionar...</SelectItem>
                    {costCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{" "}
                        <span className="text-gray-400">
                          ({c.costType === "variable"
                            ? "Var."
                            : c.costType === "fijo"
                              ? "Fijo"
                              : "Imp."})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product (optional) + Description */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Producto (si aplica)</Label>
                <Select
                  value={form.productId || "none"}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      productId: v === "none" ? "" : v,
                    }))
                  }
                  disabled={!!editingId}
                >
                  <SelectTrigger className="w-full">
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
                <Label>
                  Descripción{" "}
                  {!isProductPurchase && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  value={form.description}
                  onChange={set("description")}
                  placeholder={
                    isProductPurchase
                      ? "Opcional..."
                      : "Ej: Alquiler local, Servicio de internet..."
                  }
                />
              </div>
            </div>

            {/* Date + Invoice + Due Date */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="invoiceDate">
                  Fecha Factura <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={form.invoiceDate}
                  onChange={set("invoiceDate")}
                  required
                />
              </div>
              <div>
                <Label htmlFor="invoiceNumber">Nro. Factura</Label>
                <Input
                  id="invoiceNumber"
                  value={form.invoiceNumber}
                  onChange={set("invoiceNumber")}
                  placeholder="A-0001-00001234"
                />
              </div>
              <div>
                <Label htmlFor="dueDate">Vencimiento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={set("dueDate")}
                />
              </div>
            </div>

            {/* Quantity + Cost + Discount */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="quantity">
                  Cantidad <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.quantity}
                  onChange={set("quantity")}
                  required
                />
              </div>
              <div>
                <Label htmlFor="unitCost">
                  Costo Unitario (sin IVA) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="unitCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unitCost}
                    onChange={set("unitCost")}
                    required
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="discountPct">Descuento %</Label>
                <Input
                  id="discountPct"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.discountPct}
                  onChange={set("discountPct")}
                />
              </div>
            </div>

            {/* IVA */}
            <div className="space-y-2">
              <Label>IVA</Label>
              <div className="flex gap-2 flex-wrap">
                {(["0", "10.5", "21", "custom"] as IvaMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, ivaMode: mode }))}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                      form.ivaMode === mode
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {mode === "0" ? "Sin IVA" : mode === "custom" ? "Otro monto" : `${mode}%`}
                  </button>
                ))}
              </div>
              {form.ivaMode === "custom" ? (
                <div className="relative max-w-[180px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.ivaAmount}
                    onChange={set("ivaAmount")}
                    placeholder="Monto IVA..."
                    className="pl-7"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  IVA calculado: <span className="font-mono font-medium">${ivaAmount.toFixed(2)}</span>
                  {form.ivaMode !== "0" && (
                    <span className="ml-1 text-muted-foreground/60">({form.ivaMode}% sobre subtotal)</span>
                  )}
                </p>
              )}
            </div>

            {/* Actualizar costo del producto (solo si hay producto seleccionado) */}
            {isProductPurchase && !editingId && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <input
                  type="checkbox"
                  id="updateProductCost"
                  checked={form.updateProductCost}
                  onChange={(e) => setForm((prev) => ({ ...prev, updateProductCost: e.target.checked }))}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="updateProductCost" className="text-sm text-foreground">
                  Actualizar el costo del producto con el precio de esta compra
                </label>
              </div>
            )}

            {/* Live Preview */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-1 text-sm">
              <div className="font-semibold text-base mb-2">Preview</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-mono text-right">
                  {formatCurrency(subtotal)}
                </span>
                <span className="text-gray-500">IVA:</span>
                <span className="font-mono text-right">
                  {formatCurrency(ivaAmount)}
                </span>
                <span className="text-gray-500 font-medium">Total:</span>
                <span className="font-mono text-right font-bold">
                  {formatCurrency(total)}
                </span>
                {isProductPurchase && (
                  <>
                    <span className="text-gray-500 border-t pt-1">
                      Ingreso stock:
                    </span>
                    <span className="font-mono text-right border-t pt-1 text-green-600">
                      +{quantity} unidades
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notas</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={set("notes")}
                placeholder="Observaciones..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Payments (create mode only) */}
            {!editingId && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Pagos</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPaymentRow}
                    disabled={payments.length >= 2}
                  >
                    + Agregar Pago {payments.length >= 2 && "(máx. 2)"}
                  </Button>
                </div>

                {payments.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Sin pagos registrados. La compra quedará como
                    &quot;Pendiente&quot;.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[1fr_120px_140px_auto] gap-2 items-end"
                      >
                        <div>
                          <Label className="text-xs">Método</Label>
                          <Select
                            value={payment.paymentMethodId || "none"}
                            onValueChange={(v) =>
                              updatePayment(
                                idx,
                                "paymentMethodId",
                                v === "none" ? "" : v
                              )
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                Seleccionar...
                              </SelectItem>
                              {paymentMethods.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
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
                            onChange={(e) =>
                              updatePayment(idx, "amount", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fecha pago</Label>
                          <Input
                            type="date"
                            value={payment.paymentDate}
                            onChange={(e) =>
                              updatePayment(idx, "paymentDate", e.target.value)
                            }
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
                    <div className="text-xs text-gray-500 flex justify-between">
                      <span>
                        Total pagos: {formatCurrency(totalPayments)}
                      </span>
                      <span>
                        Pendiente:{" "}
                        {formatCurrency(Math.max(total - totalPayments, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
