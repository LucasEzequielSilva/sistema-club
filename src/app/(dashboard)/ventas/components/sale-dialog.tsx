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

interface SaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

type Product = { id: string; name: string; categoryId: string };
type PriceList = { id: string; name: string; isDefault: boolean };
type PaymentMethod = { id: string; name: string; accreditationDays: number };
type PaymentChannel = {
  id: string;
  name: string;
  paymentMethodId: string | null;
  paymentAccount?: { id: string; name: string };
  isActive: boolean;
};

type InlinePayment = {
  paymentMethodId: string;
  paymentChannelId: string;
  amount: string;
  amountManual: boolean;
  paymentDate: string;
};

type FormState = {
  productId: string;
  categoryId: string;
  priceListId: string;
  clientId: string;
  saleDate: string;
  origin: string;
  unitPrice: string;
  quantity: string;
  discountPct: string;
  invoiced: boolean;
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

const EMPTY: FormState = {
  productId: "",
  categoryId: "",
  priceListId: "",
  clientId: "",
  saleDate: formatLocalDateInput(new Date()),
  origin: "minorista",
  unitPrice: "0",
  quantity: "1",
  discountPct: "0",
  invoiced: false,
  invoiceNumber: "",
  dueDate: "",
  notes: "",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

export function SaleDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: SaleDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [payments, setPayments] = useState<InlinePayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Lookups
  const [products, setProducts] = useState<Product[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
  const [unitCostSnapshot, setUnitCostSnapshot] = useState(0);
  const [isRI, setIsRI] = useState(false);
  const [ivaRate, setIvaRate] = useState(21);

  // Load lookups
  useEffect(() => {
    if (!open) return;

    trpc.productos.list
      .query({ accountId, isActive: true })
      .then((prods: any[]) =>
        setProducts(
          prods.map((p) => ({
            id: p.id,
            name: p.name,
            categoryId: p.category?.id || p.categoryId,
          }))
        )
      )
      .catch(() => {});

    trpc.productos.getPriceLists
      .query({ accountId })
      .then((lists: any[]) => setPriceLists(lists))
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

    trpc.clasificaciones.listPaymentChannels
      .query({ accountId, isActive: true })
      .then((channels: any[]) => {
        setPaymentChannels(channels.filter((c: any) => c.isActive));
      })
      .catch(() => {});
  }, [open, accountId]);

  // Load editing data
  useEffect(() => {
    if (!open) return;

    if (editingId) {
      setFetching(true);
      trpc.ventas.getById
        .query({ id: editingId })
        .then((s: any) => {
          setForm({
            productId: s.productId,
            categoryId: s.categoryId,
            priceListId: s.priceListId ?? "",
            clientId: s.clientId ?? "",
            saleDate: formatLocalDateInput(new Date(s.saleDate)),
            origin: s.origin,
            unitPrice: String(s.unitPrice),
            quantity: String(s.quantity),
            discountPct: String(s.discountPct),
            invoiced: s.invoiced,
            invoiceNumber: s.invoiceNumber ?? "",
            dueDate: s.dueDate
              ? formatLocalDateInput(new Date(s.dueDate))
              : "",
            notes: s.notes ?? "",
          });
          setUnitCostSnapshot(s.unitCost);
          setIsRI(s.account?.taxStatus === "responsable_inscripto");
          setIvaRate(s.account?.ivaRate ?? 21);
        })
        .catch(() => toast.error("No se pudo cargar la venta"))
        .finally(() => setFetching(false));
    } else {
      setForm(EMPTY);
      setPayments([]);
      setUnitCostSnapshot(0);
    }
  }, [open, editingId]);

  // When product + priceList change, auto-fill price
  useEffect(() => {
    if (!form.productId || !form.priceListId || editingId) return;

    trpc.ventas.getProductPrice
      .query({
        productId: form.productId,
        priceListId: form.priceListId,
        accountId,
      })
      .then((pricing: any) => {
        setForm((prev) => ({
          ...prev,
          unitPrice: String(pricing.salePrice),
          categoryId: pricing.categoryId,
        }));
        setUnitCostSnapshot(pricing.unitCost);
      })
      .catch(() => {});
  }, [form.productId, form.priceListId, accountId, editingId]);

  // When product changes but no priceList, set default list
  useEffect(() => {
    if (!form.productId || form.priceListId || editingId) return;
    const defaultList = priceLists.find((l) => l.isDefault);
    if (defaultList) {
      setForm((prev) => ({ ...prev, priceListId: defaultList.id }));
    }
  }, [form.productId, priceLists, editingId]);

  // When product changes, set categoryId
  useEffect(() => {
    if (!form.productId || editingId) return;
    const product = products.find((p) => p.id === form.productId);
    if (product) {
      setForm((prev) => ({ ...prev, categoryId: product.categoryId }));
    }
  }, [form.productId, products, editingId]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Live calculations
  const unitPrice = parseFloat(form.unitPrice) || 0;
  const quantity = parseFloat(form.quantity) || 0;
  const discountPct = parseFloat(form.discountPct) || 0;
  const subtotal = unitPrice * quantity * (1 - discountPct / 100);
  const ivaAmount = isRI ? subtotal * (ivaRate / 100) : 0;
  const total = subtotal + ivaAmount;
  const variableCostTotal = unitCostSnapshot * quantity;
  const contributionMargin = subtotal - variableCostTotal;
  const marginPct = subtotal > 0 ? (contributionMargin / subtotal) * 100 : 0;
  const totalPayments = payments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0
  );

  // Payment helpers
  const addPaymentRow = () => {
    setPayments((prev) => [
      ...prev,
      {
        paymentMethodId: "",
        paymentChannelId: "",
        amount: String(Math.max(total - totalPayments, 0).toFixed(2)),
        amountManual: false,
        paymentDate: form.saleDate,
      },
    ]);
  };

  const removePaymentRow = (index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePayment = (
    index: number,
    field: keyof InlinePayment,
    value: string | boolean
  ) => {
    setPayments((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const next = { ...p, [field]: value } as InlinePayment;
        // If user edits the amount directly, flag it as manual
        if (field === "amount") next.amountManual = true;
        return next;
      })
    );
  };

  // Auto-sync non-manual payment amounts with total when total changes
  // (e.g. user edits discount, price, or quantity after adding a cobro)
  useEffect(() => {
    if (payments.length === 0) return;
    setPayments((prev) => {
      const manualSum = prev
        .filter((p) => p.amountManual)
        .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const nonManual = prev.filter((p) => !p.amountManual);
      if (nonManual.length === 0) return prev;

      const remaining = Math.max(total - manualSum, 0);
      // Split remaining evenly between non-manual rows; last row takes the rounding diff
      const perRow = Math.floor((remaining / nonManual.length) * 100) / 100;
      let assigned = 0;

      let nonManualIdx = 0;
      return prev.map((p) => {
        if (p.amountManual) return p;
        const isLast = nonManualIdx === nonManual.length - 1;
        const amount = isLast
          ? Math.max(remaining - assigned, 0)
          : perRow;
        assigned += amount;
        nonManualIdx += 1;
        const amountStr = amount.toFixed(2);
        if (p.amount === amountStr) return p;
        return { ...p, amount: amountStr };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!form.productId) {
      toast.error("Seleccioná un producto");
      return;
    }
    if (!form.categoryId) {
      toast.error("Categoría no encontrada");
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await trpc.ventas.update.mutate({
          id: editingId,
          priceListId: form.priceListId || null,
          clientId: form.clientId || null,
          saleDate: parseLocalDateInput(form.saleDate),
          origin: form.origin as any,
          unitPrice,
          quantity,
          discountPct,
          invoiced: form.invoiced,
          invoiceNumber: form.invoiceNumber || null,
          dueDate: form.dueDate ? parseLocalDateInput(form.dueDate) : null,
          notes: form.notes || null,
        });
        toast.success("Venta actualizada");
      } else {
        // Validate inline payments
        const validPayments = payments
          .filter((p) => p.paymentMethodId && parseFloat(p.amount) > 0)
          .map((p) => ({
            paymentMethodId: p.paymentMethodId,
            paymentChannelId: p.paymentChannelId || null,
            amount: parseFloat(p.amount),
            paymentDate: parseLocalDateInput(p.paymentDate),
          }));

        await trpc.ventas.create.mutate({
          accountId,
          productId: form.productId,
          categoryId: form.categoryId,
          priceListId: form.priceListId || null,
          clientId: form.clientId || null,
          saleDate: parseLocalDateInput(form.saleDate),
          origin: form.origin as any,
          unitPrice,
          quantity,
          discountPct,
          invoiced: form.invoiced,
          invoiceNumber: form.invoiceNumber || undefined,
          dueDate: form.dueDate ? parseLocalDateInput(form.dueDate) : null,
          notes: form.notes || undefined,
          payments: validPayments,
        });
        toast.success("Venta registrada");
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
            {editingId ? "Editar" : "Nueva"} Venta
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modificá los datos de la venta"
              : "Registrá una nueva venta"}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-gray-400">Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Product + Price List */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Producto <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.productId}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, productId: v }))
                  }
                  disabled={!!editingId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lista de Precios</Label>
                <Select
                  value={form.priceListId || "none"}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      priceListId: v === "none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin lista</SelectItem>
                    {priceLists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                        {l.isDefault ? " (Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date + Origin */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="saleDate">
                  Fecha <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="saleDate"
                  type="date"
                  value={form.saleDate}
                  onChange={set("saleDate")}
                  required
                />
              </div>
              <div>
                <Label>Origen</Label>
                <Select
                  value={form.origin}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, origin: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minorista">Minorista</SelectItem>
                    <SelectItem value="mayorista">Mayorista</SelectItem>
                  </SelectContent>
                </Select>
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

            {/* Quantity + Price + Discount */}
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
                <Label htmlFor="unitPrice">
                  Precio Unitario <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unitPrice}
                  onChange={set("unitPrice")}
                  required
                />
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

            {/* Live Preview */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-1 text-sm">
              <div className="font-semibold text-base mb-2">Preview</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-mono text-right">
                  {formatCurrency(subtotal)}
                </span>
                {isRI && (
                  <>
                    <span className="text-gray-500">
                      IVA ({ivaRate}%):
                    </span>
                    <span className="font-mono text-right">
                      {formatCurrency(ivaAmount)}
                    </span>
                  </>
                )}
                <span className="text-gray-500 font-medium">Total:</span>
                <span className="font-mono text-right font-bold">
                  {formatCurrency(total)}
                </span>
                <span className="text-gray-500 border-t pt-1">Costo Variable:</span>
                <span className="font-mono text-right border-t pt-1">
                  {formatCurrency(variableCostTotal)}
                </span>
                <span className="text-gray-500">Contribución Marginal:</span>
                <span
                  className={`font-mono text-right font-medium ${
                    marginPct < 20
                      ? "text-red-500"
                      : marginPct < 30
                        ? "text-amber-500"
                        : "text-green-600"
                  }`}
                >
                  {formatCurrency(contributionMargin)} ({marginPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Invoiced */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="invoiced"
                  checked={form.invoiced}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      invoiced: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="invoiced">Facturado</Label>
              </div>
              {form.invoiced && (
                <div className="flex-1">
                  <Input
                    placeholder="Nro. Factura"
                    value={form.invoiceNumber}
                    onChange={set("invoiceNumber")}
                  />
                </div>
              )}
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
                  <Label className="text-base font-semibold">Cobros</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPaymentRow}
                  >
                    + Agregar Cobro
                  </Button>
                </div>

                {payments.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Sin cobros registrados. La venta quedará como
                    &quot;Pendiente&quot;.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_120px_140px_auto] gap-2 items-end">
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
                          <Label className="text-xs">Canal</Label>
                          <Select
                            value={payment.paymentChannelId || "none"}
                            onValueChange={(v) =>
                              updatePayment(
                                idx,
                                "paymentChannelId",
                                v === "none" ? "" : v
                              )
                            }
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
                        Total cobros: {formatCurrency(totalPayments)}
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
