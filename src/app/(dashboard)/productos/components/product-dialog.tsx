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

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

type FormState = {
  name: string;
  categoryId: string;
  supplierId: string;
  barcode: string;
  sku: string;
  unit: string;
  origin: string;
  initialStock: string;
  minStock: string;
  acquisitionCost: string;
  rawMaterialCost: string;
  laborCost: string;
  packagingCost: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  categoryId: "",
  supplierId: "",
  barcode: "",
  sku: "",
  unit: "unidad",
  origin: "comprado",
  initialStock: "0",
  minStock: "0",
  acquisitionCost: "0",
  rawMaterialCost: "0",
  laborCost: "0",
  packagingCost: "0",
  isActive: true,
};

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

export function ProductDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: ProductDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Load categories + suppliers
  useEffect(() => {
    if (!open) return;

    trpc.clasificaciones.listProductCategories
      .query({ accountId })
      .then((cats: any[]) =>
        setCategories(cats.map((c) => ({ id: c.id, name: c.name })))
      )
      .catch(() => {});

    trpc.proveedores.list
      .query({ accountId, isActive: true })
      .then((sups) =>
        setSuppliers(sups.map((s) => ({ id: s.id, name: s.name })))
      )
      .catch(() => {});
  }, [open, accountId]);

  // Load data when editing
  useEffect(() => {
    if (!open) return;

    if (editingId) {
      setFetching(true);
      trpc.productos.getById
        .query({ id: editingId })
        .then((p) => {
          setForm({
            name: p.name,
            categoryId: p.categoryId,
            supplierId: p.supplierId ?? "",
            barcode: p.barcode ?? "",
            sku: p.sku ?? "",
            unit: p.unit,
            origin: p.origin,
            initialStock: String(p.initialStock),
            minStock: String(p.minStock),
            acquisitionCost: String(p.acquisitionCost),
            rawMaterialCost: String(p.rawMaterialCost),
            laborCost: String(p.laborCost),
            packagingCost: String(p.packagingCost),
            isActive: p.isActive,
          });
        })
        .catch(() => toast.error("No se pudo cargar el producto"))
        .finally(() => setFetching(false));
    } else {
      setForm(EMPTY);
    }
  }, [open, editingId]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const unitCost =
    parseFloat(form.acquisitionCost || "0") +
    parseFloat(form.rawMaterialCost || "0") +
    parseFloat(form.laborCost || "0") +
    parseFloat(form.packagingCost || "0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.categoryId) {
      toast.error("Seleccioná una categoría");
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        await trpc.productos.update.mutate({
          id: editingId,
          name: form.name,
          categoryId: form.categoryId,
          supplierId: form.supplierId || null,
          barcode: form.barcode || null,
          sku: form.sku || null,
          unit: form.unit as any,
          origin: form.origin as any,
          initialStock: parseFloat(form.initialStock) || 0,
          minStock: parseFloat(form.minStock) || 0,
          acquisitionCost: parseFloat(form.acquisitionCost) || 0,
          rawMaterialCost: parseFloat(form.rawMaterialCost) || 0,
          laborCost: parseFloat(form.laborCost) || 0,
          packagingCost: parseFloat(form.packagingCost) || 0,
          isActive: form.isActive,
        });
        toast.success(`"${form.name}" actualizado`);
      } else {
        await trpc.productos.create.mutate({
          accountId,
          name: form.name,
          categoryId: form.categoryId,
          supplierId: form.supplierId || null,
          barcode: form.barcode || undefined,
          sku: form.sku || undefined,
          unit: form.unit as any,
          origin: form.origin as any,
          initialStock: parseFloat(form.initialStock) || 0,
          minStock: parseFloat(form.minStock) || 0,
          acquisitionCost: parseFloat(form.acquisitionCost) || 0,
          rawMaterialCost: parseFloat(form.rawMaterialCost) || 0,
          laborCost: parseFloat(form.laborCost) || 0,
          packagingCost: parseFloat(form.packagingCost) || 0,
        });
        toast.success(`"${form.name}" creado`);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Editar" : "Nuevo"} Producto
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modificá los datos del producto"
              : "Completá los datos del nuevo producto"}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-gray-400">Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <Label htmlFor="name">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={set("name")}
                placeholder="Ej: Vino Malbec 750ml"
                required
                autoFocus
              />
            </div>

            {/* Category + Supplier */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Categoría <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, categoryId: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            {/* Barcode + SKU + Unit + Origin */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label htmlFor="barcode">Código barras</Label>
                <Input
                  id="barcode"
                  value={form.barcode}
                  onChange={set("barcode")}
                  placeholder="7790001..."
                />
              </div>
              <div>
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={form.sku}
                  onChange={set("sku")}
                  placeholder="ABC-001"
                />
              </div>
              <div>
                <Label>Unidad</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, unit: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidad">Unidad</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="metro">Metro</SelectItem>
                    <SelectItem value="par">Par</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="comprado">Comprado</SelectItem>
                    <SelectItem value="fabricado">Fabricado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cost Components */}
            <div>
              <Label className="text-base font-semibold">
                Componentes del Costo
              </Label>
              <p className="text-xs text-gray-400 mb-2">
                Costo unitario = Adquisición + Materia Prima + Mano de Obra +
                Packaging
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="acquisitionCost">Adquisición ($)</Label>
                  <Input
                    id="acquisitionCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.acquisitionCost}
                    onChange={set("acquisitionCost")}
                  />
                </div>
                <div>
                  <Label htmlFor="rawMaterialCost">Materia Prima ($)</Label>
                  <Input
                    id="rawMaterialCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.rawMaterialCost}
                    onChange={set("rawMaterialCost")}
                  />
                </div>
                <div>
                  <Label htmlFor="laborCost">Mano de Obra ($)</Label>
                  <Input
                    id="laborCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.laborCost}
                    onChange={set("laborCost")}
                  />
                </div>
                <div>
                  <Label htmlFor="packagingCost">Packaging ($)</Label>
                  <Input
                    id="packagingCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.packagingCost}
                    onChange={set("packagingCost")}
                  />
                </div>
              </div>
              <div className="mt-2 p-2 bg-slate-50 rounded text-sm font-medium">
                Costo Unitario Total:{" "}
                <span className="font-bold">
                  ${unitCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Stock */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="initialStock">Stock Inicial</Label>
                <Input
                  id="initialStock"
                  type="number"
                  step="1"
                  min="0"
                  value={form.initialStock}
                  onChange={set("initialStock")}
                />
              </div>
              <div>
                <Label htmlFor="minStock">Stock Mínimo (alerta)</Label>
                <Input
                  id="minStock"
                  type="number"
                  step="1"
                  min="0"
                  value={form.minStock}
                  onChange={set("minStock")}
                />
              </div>
            </div>

            {/* Active (edit only) */}
            {editingId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isActive">Activo</Label>
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
