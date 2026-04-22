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
  subcategoryId: string;
  supplierId: string;
  barcode: string;
  sku: string;
  unit: string;
  origin: string;
  initialStock: string;
  minStock: string;
  unitCost: string;
  markup: string;
  salePrice: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  categoryId: "",
  subcategoryId: "",
  supplierId: "",
  barcode: "",
  sku: "",
  unit: "unidad",
  origin: "comprado",
  initialStock: "0",
  minStock: "0",
  unitCost: "0",
  markup: "",
  salePrice: "",
  isActive: true,
};

type Category = { id: string; name: string };
type Subcategory = { id: string; name: string; categoryId: string };
type Supplier = { id: string; name: string };
type AccountConfig = {
  taxStatus: "monotributista" | "responsable_inscripto";
  ivaRate: number;
};

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
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [priceListName, setPriceListName] = useState<string | null>(null);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [accountConfig, setAccountConfig] = useState<AccountConfig | null>(null);
  const [saleIvaRate, setSaleIvaRate] = useState(21);

  // Load categories + suppliers
  useEffect(() => {
    if (!open) return;

    trpc.clasificaciones.listProductCategories
      .query({ accountId })
      .then((cats: any[]) =>
        setCategories(cats.map((c) => ({ id: c.id, name: c.name })))
      )
      .catch(() => {});

    trpc.clasificaciones.listProductSubcategories
      .query({ accountId, isActive: true })
      .then((subs: any[]) =>
        setSubcategories(
          subs.map((s) => ({ id: s.id, name: s.name, categoryId: s.categoryId }))
        )
      )
      .catch(() => {});

    trpc.proveedores.list
      .query({ accountId, isActive: true })
      .then((sups) =>
        setSuppliers(sups.map((s) => ({ id: s.id, name: s.name })))
      )
      .catch(() => {});

    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((acc) => {
        if (acc?.taxStatus) {
          const cfg: AccountConfig = {
            taxStatus: acc.taxStatus,
            ivaRate: Number(acc.ivaRate ?? 21),
          };
          setAccountConfig(cfg);
          setSaleIvaRate(cfg.ivaRate || 21);
        }
      })
      .catch(() => {});
  }, [open, accountId]);

  // Load data when editing
  useEffect(() => {
    if (!open) return;

    if (editingId) {
      setFetching(true);

      Promise.all([
        trpc.productos.getById.query({ id: editingId }),
        fetch(`/api/price-lists/items?productId=${editingId}`).then((r) =>
          r.ok ? r.json() : { markupPct: null, priceListName: null }
        ),
      ])
        .then(([p, priceData]) => {
          const total =
            (p.acquisitionCost || 0) +
            (p.rawMaterialCost || 0) +
            (p.laborCost || 0) +
            (p.packagingCost || 0);

          const markupPct = priceData.markupPct;
          setPriceListName(priceData.priceListName ?? null);

          const markupStr =
            markupPct !== null && markupPct !== undefined
              ? String(markupPct)
              : "";
          const salePriceStr =
            markupPct !== null && markupPct !== undefined && total > 0
              ? String(
                  parseFloat(
                    (total * (1 + markupPct / 100)).toFixed(2)
                  )
                )
              : "";

          setCurrentStock(p.currentStock ?? total);
          setForm({
            name: p.name,
            categoryId: p.categoryId,
            subcategoryId: p.subcategoryId ?? "",
            supplierId: p.supplierId ?? "",
            barcode: p.barcode ?? "",
            sku: p.sku ?? "",
            unit: p.unit,
            origin: p.origin,
            initialStock: String(p.initialStock),
            minStock: String(p.minStock),
            unitCost: String(total),
            markup: markupStr,
            salePrice: salePriceStr,
            isActive: p.isActive,
          });
        })
        .catch(() => toast.error("No se pudo cargar el producto"))
        .finally(() => setFetching(false));
    } else {
      setForm(EMPTY);
      setPriceListName(null);
      setCurrentStock(null);
    }
  }, [open, editingId]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Cuando cambia el costo, recalcula PV manteniendo el markup
  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cost = parseFloat(e.target.value) || 0;
    setForm((prev) => {
      const markup = parseFloat(prev.markup);
      const newSalePrice =
        !isNaN(markup) && prev.markup !== ""
          ? String(parseFloat((cost * (1 + markup / 100)).toFixed(2)))
          : prev.salePrice;
      return { ...prev, unitCost: e.target.value, salePrice: newSalePrice };
    });
  };

  // Cuando cambia el markup, recalcula PV
  const handleMarkupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const markupVal = e.target.value;
    setForm((prev) => {
      const cost = parseFloat(prev.unitCost) || 0;
      const markup = parseFloat(markupVal);
      const newSalePrice =
        !isNaN(markup) && markupVal !== "" && cost > 0
          ? String(parseFloat((cost * (1 + markup / 100)).toFixed(2)))
          : "";
      return { ...prev, markup: markupVal, salePrice: newSalePrice };
    });
  };

  // Cuando cambia el PV, recalcula markup
  const handleSalePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const salePriceVal = e.target.value;
    setForm((prev) => {
      const cost = parseFloat(prev.unitCost) || 0;
      const salePrice = parseFloat(salePriceVal);
      const newMarkup =
        !isNaN(salePrice) && salePriceVal !== "" && cost > 0
          ? String(parseFloat((((salePrice - cost) / cost) * 100).toFixed(2)))
          : "";
      return { ...prev, salePrice: salePriceVal, markup: newMarkup };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.categoryId) {
      toast.error("Seleccioná una categoría");
      return;
    }

    setLoading(true);

    try {
      const cost = parseFloat(form.unitCost) || 0;
      let savedProductId = editingId;

      if (editingId) {
        await trpc.productos.update.mutate({
          id: editingId,
          name: form.name,
          categoryId: form.categoryId,
          subcategoryId: form.subcategoryId || null,
          supplierId: form.supplierId || null,
          barcode: form.barcode || null,
          sku: form.sku || null,
          unit: form.unit as any,
          origin: form.origin as any,
          // initialStock NO se envía al editar — el stock se gestiona via compras/ventas
          minStock: parseFloat(form.minStock) || 0,
          acquisitionCost: cost,
          rawMaterialCost: 0,
          laborCost: 0,
          packagingCost: 0,
          isActive: form.isActive,
        });
        toast.success(`"${form.name}" actualizado`);
      } else {
        const created = await trpc.productos.create.mutate({
          accountId,
          name: form.name,
          categoryId: form.categoryId,
          subcategoryId: form.subcategoryId || null,
          supplierId: form.supplierId || null,
          barcode: form.barcode || undefined,
          sku: form.sku || undefined,
          unit: form.unit as any,
          origin: form.origin as any,
          initialStock: parseFloat(form.initialStock) || 0,
          minStock: parseFloat(form.minStock) || 0,
          acquisitionCost: cost,
          rawMaterialCost: 0,
          laborCost: 0,
          packagingCost: 0,
        });
        savedProductId = created.id;
        toast.success(`"${form.name}" creado`);
      }

      // Guardar markup en la lista de precios default (si se completó)
      const markupVal = parseFloat(form.markup);
      if (savedProductId && form.markup !== "" && !isNaN(markupVal)) {
        await fetch("/api/price-lists/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: savedProductId, markupPct: markupVal }),
        });
      }

      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const cost = parseFloat(form.unitCost) || 0;
  const markupPct = parseFloat(form.markup) || 0;
  const salePrice = parseFloat(form.salePrice) || 0;
  const contributionMargin = salePrice - cost;
  const marginPct = salePrice > 0 ? (contributionMargin / salePrice) * 100 : 0;
  const salePriceWithIva =
    accountConfig?.taxStatus === "responsable_inscripto"
      ? salePrice * (1 + saleIvaRate / 100)
      : null;

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
                    setForm((prev) => ({
                      ...prev,
                      categoryId: v,
                      // Clear subcategory if it doesn't belong to the new category
                      subcategoryId:
                        subcategories.find((s) => s.id === prev.subcategoryId)
                          ?.categoryId === v
                          ? prev.subcategoryId
                          : "",
                    }))
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

            {/* Subcategory — only shown if the selected category has subcats */}
            {form.categoryId &&
              subcategories.some((s) => s.categoryId === form.categoryId) && (
                <div>
                  <Label>
                    Subcategoría{" "}
                    <span className="text-muted-foreground font-normal text-xs">
                      (opcional)
                    </span>
                  </Label>
                  <Select
                    value={form.subcategoryId || "none"}
                    onValueChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        subcategoryId: v === "none" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sin subcategoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin subcategoría</SelectItem>
                      {subcategories
                        .filter((s) => s.categoryId === form.categoryId)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

            {/* Cost + Markup + PV */}
            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div>
                <Label htmlFor="unitCost" className="text-base font-semibold">
                  Costo unitario
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Ingresá el costo SIN IVA (salvo que seas monotributista, en cuyo caso podés incluirlo).
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                    $
                  </span>
                  <Input
                    id="unitCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unitCost}
                    onChange={handleCostChange}
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="markup">
                    Markup{" "}
                    <span className="font-normal text-muted-foreground">(%)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="markup"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.markup}
                      onChange={handleMarkupChange}
                      placeholder="Ej: 30"
                      className="pr-7"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                      %
                    </span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="salePrice">Precio de venta</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                      $
                    </span>
                    <Input
                      id="salePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.salePrice}
                      onChange={handleSalePriceChange}
                      placeholder="Ej: 1500"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {priceListName
                  ? `Se guarda en la lista "${priceListName}"`
                  : 'Si completás el precio, se creará automáticamente la lista "Lista General"'}
              </p>

              {accountConfig?.taxStatus === "responsable_inscripto" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label>IVA para PV público</Label>
                    <Select
                      value={String(saleIvaRate)}
                      onValueChange={(v) => setSaleIvaRate(parseFloat(v) || 21)}
                    >
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="21">21%</SelectItem>
                        <SelectItem value="10.5">10.5%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Precio de venta + IVA</Label>
                    <div className="h-9 px-3 rounded-md border border-input bg-background flex items-center font-mono text-sm">
                      {salePriceWithIva !== null
                        ? `$ ${salePriceWithIva.toFixed(2)}`
                        : "—"}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="rounded-md border border-border bg-background p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">MKUP</p>
                  <p className="text-sm font-mono font-semibold text-foreground">{markupPct.toFixed(2)}%</p>
                </div>
                <div className="rounded-md border border-border bg-background p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">CMG</p>
                  <p className="text-sm font-mono font-semibold text-foreground">$ {contributionMargin.toFixed(2)}</p>
                </div>
                <div className="rounded-md border border-border bg-background p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Margen contrib.</p>
                  <p className="text-sm font-mono font-semibold text-foreground">{marginPct.toFixed(2)}%</p>
                </div>
              </div>
            </div>

            {/* Stock */}
            <div className="grid grid-cols-2 gap-3">
              {editingId ? (
                /* Al editar: stock actual es solo lectura, no se puede manipular */
                <div>
                  <Label className="text-muted-foreground">Stock actual</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border border-input bg-muted/50 text-sm font-mono text-muted-foreground select-none">
                    {currentStock ?? "—"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se actualiza con compras y ventas
                  </p>
                </div>
              ) : (
                /* Al crear: se puede setear el stock de apertura */
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Stock de apertura (solo al crear)
                  </p>
                </div>
              )}
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
