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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductDialog } from "./components/product-dialog";
import { ProductDetail } from "./components/product-detail";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { Package, MoreHorizontal, Loader2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { useAccountId } from "@/hooks/use-account-id";

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

function getMarginClass(marginPct: number): string {
  if (marginPct < 20) return "text-[var(--danger-muted-foreground)]";
  if (marginPct < 30) return "text-[var(--warning-muted-foreground)]";
  return "text-[var(--success-muted-foreground)]";
}

export default function ProductosPage() {
  const { accountId } = useAccountId();
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

  const [confirmDeactivate, ConfirmDeactivateDialog] = useConfirm({
    title: "Desactivar producto",
    description: "El producto dejará de aparecer en ventas y POS. Sus datos históricos se conservan.",
    confirmLabel: "Desactivar",
    destructive: false,
  });
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm({
    title: "Eliminar producto",
    description: "Esta acción elimina el producto permanentemente y no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  // Load filters data
  useEffect(() => {
    if (!accountId) return;
    trpc.clasificaciones.listProductCategories
      .query({ accountId })
      .then((cats: any[]) => setCategories(cats.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    trpc.proveedores.list
      .query({ accountId, isActive: true })
      .then((sups) =>
        setSuppliers(sups.map((s) => ({ id: s.id, name: s.name })))
      )
      .catch(() => {});
  }, [accountId]);

  const loadProducts = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const result = await trpc.productos.list.query({
        accountId,
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
  }, [search, categoryFilter, supplierFilter, lowStockOnly, accountId]);

  useEffect(() => {
    const timer = setTimeout(loadProducts, 300);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  const handleSoftDelete = async (id: string, name: string) => {
    if (!(await confirmDeactivate())) return;
    try {
      await trpc.productos.softDelete.mutate({ id });
      toast.success(`"${name}" desactivado`);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Error al desactivar");
    }
  };

  const handleActivate = async (id: string, name: string) => {
    try {
      await trpc.productos.softDelete.mutate({ id });
      toast.success(`"${name}" activado`);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Error al activar");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirmDelete())) return;
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Productos"
        description="Catálogo de productos, costos y precios"
        icon={Package}
        actions={
          <Button
            onClick={() => {
              setEditingId(null);
              setShowDialog(true);
            }}
          >
            + Nuevo Producto
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border mb-4 flex-wrap">
        <Input
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
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
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b border-border">
            <div className="grid grid-cols-9 gap-3 animate-pulse">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-3 bg-muted rounded" />
              ))}
            </div>
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-9 gap-3 px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded ml-auto" />
              <div className="h-3 w-16 bg-muted rounded ml-auto" />
              <div className="h-3 w-12 bg-muted rounded ml-auto" />
              <div className="h-3 w-8 bg-muted rounded mx-auto" />
              <div className="h-5 w-12 bg-muted rounded mx-auto" />
              <div className="h-3 w-6 bg-muted rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        hasFilters ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={Package}
              title="Sin resultados"
              description="No hay productos que coincidan con los filtros aplicados."
              actionLabel="Limpiar filtros"
              onAction={clearFilters}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={Package}
              title="Sin productos todavía"
              description="Cargá tu catálogo de productos con costos, precios y stock. Los necesitás antes de poder registrar ventas."
              actionLabel="+ Nuevo Producto"
              onAction={() => {
                setEditingId(null);
                setShowDialog(true);
              }}
            />
          </div>
        )
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
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
                  className={`hover:bg-muted/40 ${!p.isActive ? "opacity-50" : ""}`}
                >
                  <TableCell>
                    <div
                      className="cursor-pointer hover:underline"
                      onClick={() => setDetailId(p.id)}
                    >
                      <span className="font-medium">{p.name}</span>
                      <div className="text-xs text-muted-foreground">
                        {UNIT_LABELS[p.unit] || p.unit}
                        {p.sku && ` | SKU: ${p.sku}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.category.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.supplier?.name || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                    {formatCurrency(p.unitCost)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                    {p.defaultPricing
                      ? formatCurrency(p.defaultPricing.salePrice)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {p.defaultPricing ? (
                      <span className={getMarginClass(p.defaultPricing.marginPct)}>
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
                      <Badge variant="outline" className="text-[var(--success-muted-foreground)] border-[var(--success-muted-foreground)]/30 bg-[var(--success-muted-foreground)]/10">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailId(p.id)}>
                          Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingId(p.id);
                            setShowDialog(true);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {p.isActive ? (
                          <DropdownMenuItem
                            onClick={() => handleSoftDelete(p.id, p.name)}
                          >
                            Desactivar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleActivate(p.id, p.name)}
                          >
                            Activar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
        accountId={accountId ?? ""}
        editingId={editingId}
      />
      {ConfirmDeactivateDialog}
      {ConfirmDeleteDialog}
    </div>
  );
}
