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

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accountId: string;
}

type Product = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
};

type FormState = {
  productId: string;
  adjustmentType: string;
  mode: "delta" | "recount"; // delta = +/- quantity, recount = set absolute
  quantity: string;
  movementDate: string;
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
  adjustmentType: "recount",
  mode: "recount",
  quantity: "",
  movementDate: formatLocalDateInput(new Date()),
  notes: "",
};

const ADJUSTMENT_TYPES = [
  { value: "recount", label: "Reconteo (inventario físico)" },
  { value: "loss", label: "Pérdida" },
  { value: "damage", label: "Daño / rotura" },
  { value: "other", label: "Otro ajuste" },
];

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  onSuccess,
  accountId,
}: StockAdjustmentDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Load products with current stock
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);

    trpc.mercaderia.getStockSummary
      .query()
      .then((result: any) =>
        setProducts(
          result.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            currentStock: p.currentStock,
          }))
        )
      )
      .catch(() => {});
  }, [open, accountId]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const selectedProduct = products.find((p) => p.id === form.productId);
  const inputQty = parseFloat(form.quantity);
  const isRecount = form.adjustmentType === "recount";

  // For recount: delta = newQty - currentStock
  // For loss/damage/other: delta = -abs(quantity) (always negative)
  let delta = 0;
  if (!isNaN(inputQty) && selectedProduct) {
    if (isRecount) {
      delta = inputQty - selectedProduct.currentStock;
    } else {
      // loss/damage/other: user enters positive number, we subtract
      delta = -Math.abs(inputQty);
    }
  }

  const newStock = selectedProduct
    ? selectedProduct.currentStock + delta
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!form.productId) {
      toast.error("Seleccioná un producto");
      return;
    }
    if (isNaN(inputQty)) {
      toast.error("Ingresá una cantidad válida");
      return;
    }
    if (delta === 0) {
      toast.error("El ajuste no genera cambio en stock");
      return;
    }

    setLoading(true);
    try {
      await trpc.mercaderia.createAdjustment.mutate({
        productId: form.productId,
        adjustmentType: form.adjustmentType as any,
        quantity: delta,
        movementDate: parseLocalDateInput(form.movementDate),
        notes: form.notes || undefined,
      });

      const direction = delta > 0 ? "+" : "";
      toast.success(
        `Ajuste registrado: ${direction}${delta} ${selectedProduct?.unit || "unidades"} de ${selectedProduct?.name}`
      );
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar ajuste");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajuste de Stock</DialogTitle>
          <DialogDescription>
            Ajustá manualmente el stock de un producto. Útil para reconteos,
            pérdidas o daños.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product */}
          <div>
            <Label>
              Producto <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.productId || "none"}
              onValueChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  productId: v === "none" ? "" : v,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar producto..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccionar...</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (stock: {p.currentStock})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Adjustment Type */}
          <div>
            <Label>
              Tipo de Ajuste <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.adjustmentType}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, adjustmentType: v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quantity">
                {isRecount
                  ? "Stock real (conteo físico)"
                  : "Cantidad perdida/dañada"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min={isRecount ? undefined : "0.01"}
                value={form.quantity}
                onChange={set("quantity")}
                placeholder={
                  isRecount
                    ? `Stock actual: ${selectedProduct?.currentStock ?? "?"}`
                    : "Unidades afectadas"
                }
                required
              />
              {selectedProduct && (
                <p className="text-xs text-gray-400 mt-1">
                  Stock sistema: {selectedProduct.currentStock}{" "}
                  {selectedProduct.unit}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="movementDate">
                Fecha <span className="text-red-500">*</span>
              </Label>
              <Input
                id="movementDate"
                type="date"
                value={form.movementDate}
                onChange={set("movementDate")}
                required
              />
            </div>
          </div>

          {/* Preview */}
          {selectedProduct && !isNaN(inputQty) && delta !== 0 && (
            <div
              className={`rounded-lg p-3 text-sm ${
                delta > 0
                  ? "bg-green-50"
                  : "bg-red-50"
              }`}
            >
              <div className="flex justify-between">
                <span className="text-gray-600">Stock sistema:</span>
                <span className="font-mono">
                  {selectedProduct.currentStock} {selectedProduct.unit}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-600">Ajuste:</span>
                <span
                  className={`font-mono font-medium ${
                    delta > 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta} {selectedProduct.unit}
                </span>
              </div>
              <div className="flex justify-between mt-1 pt-1 border-t">
                <span className="text-gray-600 font-medium">
                  Stock final:
                </span>
                <span className="font-mono font-bold">
                  {newStock} {selectedProduct.unit}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={set("notes")}
              placeholder="Ej: Inventario mensual, Rotura en transporte..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Registrar Ajuste"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
