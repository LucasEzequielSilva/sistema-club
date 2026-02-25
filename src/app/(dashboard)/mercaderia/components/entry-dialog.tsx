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

interface MerchandiseEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accountId: string;
}

type Product = {
  id: string;
  name: string;
  unit: string;
  unitCost: number;
};

type FormState = {
  productId: string;
  quantity: string;
  unitCost: string;
  movementDate: string;
  notes: string;
};

const EMPTY: FormState = {
  productId: "",
  quantity: "1",
  unitCost: "0",
  movementDate: new Date().toISOString().split("T")[0],
  notes: "",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

export function MerchandiseEntryDialog({
  open,
  onOpenChange,
  onSuccess,
  accountId,
}: MerchandiseEntryDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Load products
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);

    trpc.productos.list
      .query({ accountId, isActive: true })
      .then((prods: any[]) =>
        setProducts(
          prods.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit || "unidad",
            unitCost: p.unitCost ?? 0,
          }))
        )
      )
      .catch(() => {});
  }, [open, accountId]);

  // When product changes, auto-fill unitCost
  useEffect(() => {
    if (!form.productId) return;
    const product = products.find((p) => p.id === form.productId);
    if (product) {
      setForm((prev) => ({
        ...prev,
        unitCost: String(product.unitCost),
      }));
    }
  }, [form.productId, products]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const quantity = parseFloat(form.quantity) || 0;
  const unitCost = parseFloat(form.unitCost) || 0;
  const totalValue = quantity * unitCost;
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
      await trpc.mercaderia.createEntry.mutate({
        accountId,
        productId: form.productId,
        quantity,
        unitCost,
        movementDate: new Date(form.movementDate),
        notes: form.notes || undefined,
      });
      toast.success(
        `Ingreso registrado: +${quantity} ${selectedProduct?.unit || "unidades"} de ${selectedProduct?.name}`
      );
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar ingreso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ingreso de Mercadería</DialogTitle>
          <DialogDescription>
            Registrá el ingreso de mercadería producida o recibida (no compras).
            Esto suma stock.
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
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity + Cost + Date */}
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
              {selectedProduct && (
                <p className="text-xs text-gray-400 mt-1">
                  {selectedProduct.unit}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="unitCost">Costo Unitario</Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                min="0"
                value={form.unitCost}
                onChange={set("unitCost")}
              />
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
            <div className="bg-green-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Ingreso de stock:</span>
                <span className="font-mono text-green-600 font-medium">
                  +{quantity} {selectedProduct?.unit || "unidades"}
                </span>
              </div>
              {unitCost > 0 && (
                <div className="flex justify-between mt-1">
                  <span className="text-gray-600">Valor total:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={set("notes")}
              placeholder="Ej: Producción lote #23, Recibido de taller..."
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
              {loading ? "Registrando..." : "Registrar Ingreso"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
