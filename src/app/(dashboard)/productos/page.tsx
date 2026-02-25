"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductDialog } from "./components/product-dialog";
import { ProductDetail } from "./components/product-detail";
import { toast } from "sonner";

const ACCOUNT_ID = "test-account-id"; // TODO: reemplazar por sesión real

const UNIT_LABELS: Record<string, string> = {
  unidad: "Unidad",
  kg: "Kg",
  litro: "Litro",
  metro: "Metro",
  par: "Par",
};

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

type ProductListItem = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  unit: string;
  origin: string;
  initialStock: number;
  minStock: number;
  acquisitionCost: number;
  rawMaterialCost: number;
  laborCost: number;
  packagingCost: number;
  isActive: boolean;
  createdAt: Date;
  category: { id: string; name: string };
  supplier: { id: string; name: string } | null;
  unitCost: number;
  currentStock: number;
  isLowStock: boolean;
  defaultPricing: {
    salePrice: number;
    salePriceWithIva: number | null;
    contributionMargin: number;
    marginPct: number;
  } | null;
  _count: { sales: number; purchases: number; stockMovements: number };
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function ProductosPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Dialog / detail state
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Load filters data
  useEffect(() => {
    trpc.clasificaciones.listProductCategories
      .query({ accountId: ACCOUNT_ID })
      .then((cats: any[]) => setCategories(cats.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    trpc.proveedores.list
      .query({ accountId: ACCOUNT_ID, isActive: true })
      .then((sups) =>
        setSuppliers(sups.map((s) => ({ id: s.id, name: s.name })))
      )
      .catch(() => {});
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await trpc.productos.list.query({
        accountId: ACCOUNT_ID,
        search: search.trim() || undefined,
        categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
        supplierId: supplierFilter !== "all" ? supplierFilter : undefined,
        lowStockOnly: lowStockOnly || undefined,
      });
      setProducts(result as ProductListItem[]);
    } catch {
      toast.error("Error al cargar los productos");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, supplierFilter, lowStockOnly]);

  useEffect(() => {
    const timer = setTimeout(loadProducts, 300);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  const handleSoftDelete = async (id: string, name: string) => {
    if (!confirm(`¿Desactivar "${name}"? No se eliminarán sus datos.`)) return;
    try {
      await trpc.productos.softDelete.mutate({ id });
      toast.success(`"${name}" desactivado`);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Error al desactivar");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `¿Eliminar permanentemente "${name}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    try {
      await trpc.productos.delete.mutate({ id });
      toast.success(`"${name}" eliminado`);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const handleDialogSuccess = () => {
    setShowDialog(false);
    setEditingId(null);
    loadProducts();
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setSupplierFilter("all");
    setLowStockOnly(false);
  };

  const hasFilters =
    search || categoryFilter !== "all" || supplierFilter !== "all" || lowStockOnly;

  // If detail view is open, show it
  if (detailId) {
    return (
      <ProductDetail
        productId={detailId}
        onBack={() => setDetailId(null)}
        onEdit={(id: string) => {
          setEditingId(id);
          setShowDialog(true);
          setDetailId(null);
        }}
        onRefresh={loadProducts}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-gray-500 mt-1">
            {loading
              ? "Cargando..."
              : `${products.length} producto${products.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowDialog(true);
          }}
        >
          + Nuevo Producto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Proveedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proveedores</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={lowStockOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setLowStockOnly(!lowStockOnly)}
        >
          Stock bajo
        </Button>

        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {hasFilters
            ? "Sin resultados para los filtros aplicados"
            : "No hay productos. Creá uno para comenzar."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Costo Unit.</TableHead>
                <TableHead className="text-right">PV (Lista)</TableHead>
                <TableHead className="text-right">Margen %</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow
                  key={p.id}
                  className={!p.isActive ? "opacity-50" : ""}
                >
                  <TableCell>
                    <div
                      className="cursor-pointer hover:underline"
                      onClick={() => setDetailId(p.id)}
                    >
                      <span className="font-medium">{p.name}</span>
                      <div className="text-xs text-gray-400">
                        {UNIT_LABELS[p.unit] || p.unit}
                        {p.sku && ` | SKU: ${p.sku}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {p.category.name}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {p.supplier?.name || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(p.unitCost)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {p.defaultPricing
                      ? formatCurrency(p.defaultPricing.salePrice)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {p.defaultPricing ? (
                      <span
                        className={
                          p.defaultPricing.marginPct < 20
                            ? "text-red-500"
                            : p.defaultPricing.marginPct < 30
                              ? "text-amber-500"
                              : "text-green-600"
                        }
                      >
                        {p.defaultPricing.marginPct.toFixed(1)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-mono text-sm">
                        {p.currentStock}
                      </span>
                      {p.isLowStock && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5"
                        >
                          Bajo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {p.isActive ? (
                      <span className="text-green-600">&#10003;</span>
                    ) : (
                      <span className="text-gray-400">&#10007;</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(p.id);
                          setShowDialog(true);
                        }}
                      >
                        Editar
                      </Button>
                      {p.isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                          onClick={() => handleSoftDelete(p.id, p.name)}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 border-red-300 hover:bg-red-50"
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onClose={() => {
          setShowDialog(false);
          setEditingId(null);
        }}
        onSuccess={handleDialogSuccess}
        accountId={ACCOUNT_ID}
        editingId={editingId}
      />
    </div>
  );
}
