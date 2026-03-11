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
import { Factory } from "lucide-react";

interface ProductionDialogProps {
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
  quantity: string;
  movementDate: string;
  notes: string;
};

const EMPTY: FormState = {
  productId: "",
  quantity: "1",
  movementDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export function ProductionDialog({
  open,
  onOpenChange,
  onSuccess,
  accountId,
}: ProductionDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Cargar solo productos fabricados
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);

    trpc.productos.list
      .query({ accountId, isActive: true })
      .then((prods: any[]) => {
        const fabricados = prods
          .filter((p) => p.origin === "fabricado")
          .map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit || "unidad",
            currentStock: p.currentStock ?? 0,
          }));
        setProducts(fabricados);
      })
      .catch(() => {});
  }, [open, accountId]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const quantity = parseFloat(form.quantity) || 0;
  const selectedProduct = products.find((p) => p.id === form.productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.productId) {
      toast.error("Seleccioná un producto");
      return;
    }
    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/mercaderia/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: form.productId,
          quantity,
          movementDate: form.movementDate,
          notes: form.notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al registrar producción");
      }

      toast.success(
        `Producción registrada: +${quantity} ${selectedProduct?.unit || "unidades"} de ${selectedProduct?.name}`
      );
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar producción");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5" />
            Registrar Producción
          </DialogTitle>
          <DialogDescription>
            Registrá las unidades fabricadas. Esto suma stock al producto terminado.
          </DialogDescription>
        </DialogHeader>

        {products.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Factory className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No hay productos con origen <strong>Fabricado</strong>.</p>
            <p className="mt-1 text-xs">
              Creá un producto y seleccioná "Fabricado" como origen.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Producto fabricado */}
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
                  <SelectValue placeholder="Seleccionar producto fabricado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar...</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      <span className="text-muted-foreground ml-2 text-xs">
                        (stock: {p.currentStock} {p.unit})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad + Fecha */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="quantity">
                  Unidades producidas <span className="text-red-500">*</span>
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
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground mt-1">
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
            {form.productId && quantity > 0 && (
              <div
                className="rounded-lg p-3 text-sm border"
                style={{
                  backgroundColor: "var(--color-orange-50, #fff7ed)",
                  borderColor: "var(--color-orange-200, #fed7aa)",
                  color: "var(--color-orange-800, #9a3412)",
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">Stock resultante:</span>
                  <span className="font-mono font-bold">
                    {selectedProduct
                      ? `${selectedProduct.currentStock} → ${selectedProduct.currentStock + quantity} ${selectedProduct.unit}`
                      : `+${quantity}`}
                  </span>
                </div>
              </div>
            )}

            {/* Notas */}
            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={set("notes")}
                placeholder="Ej: Lote #24, turno mañana..."
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
                {loading ? "Registrando..." : "Registrar Producción"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
