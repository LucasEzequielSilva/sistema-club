"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { MerchandiseEntryDialog } from "./components/entry-dialog";
import { StockAdjustmentDialog } from "./components/adjustment-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import {
  Warehouse,
  Plus,
  SlidersHorizontal,
  Download,
  PackageOpen,
  DollarSign,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const ACCOUNT_ID = "test-account-id";

type StockMovementItem = {
  id: string;
  movementType: string;
  quantity: number;
  unitCost: number | null;
  movementDate: Date;
  notes: string | null;
  referenceType: string | null;
  referenceId: string | null;
  product: { id: string; name: string; unit: string };
};

type StockProductSummary = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost: number;
  valuedStock: number;
  isLowStock: boolean;
};

type StockTotals = {
  totalProducts: number;
  totalValued: number;
  lowStockCount: number;
};

const MOVEMENT_LABELS: Record<string, string> = {
  initial: "Stock inicial",
  purchase: "Compra",
  sale: "Venta",
  merchandise_entry: "Ingreso mercadería",
  adjustment: "Ajuste",
};

// CSS-var based badge styles per movement type
const MOVEMENT_STYLES: Record<string, React.CSSProperties> = {
  initial: {
    backgroundColor: "var(--color-blue-100, #dbeafe)",
    color: "var(--color-blue-700, #1d4ed8)",
    borderColor: "var(--color-blue-200, #bfdbfe)",
  },
  purchase: {
    backgroundColor: "var(--color-green-100, #dcfce7)",
    color: "var(--color-green-700, #15803d)",
    borderColor: "var(--color-green-200, #bbf7d0)",
  },
  sale: {
    backgroundColor: "var(--color-red-100, #fee2e2)",
    color: "var(--color-red-700, #b91c1c)",
    borderColor: "var(--color-red-200, #fecaca)",
  },
  merchandise_entry: {
    backgroundColor: "var(--color-purple-100, #f3e8ff)",
    color: "var(--color-purple-700, #7e22ce)",
    borderColor: "var(--color-purple-200, #e9d5ff)",
  },
  adjustment: {
    backgroundColor: "var(--color-amber-100, #fef3c7)",
    color: "var(--color-amber-700, #b45309)",
    borderColor: "var(--color-amber-200, #fde68a)",
  },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type ViewMode = "movements" | "stock";

export default function MercaderiaPage() {
  const [confirmDeleteMovement, ConfirmDeleteMovementDialog] = useConfirm({
    title: "Eliminar movimiento",
    description: "Se revertirá el efecto en stock. Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  const [viewMode, setViewMode] = useState<ViewMode>("movements");
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [stockSummary, setStockSummary] = useState<StockProductSummary[]>([]);
  const [stockTotals, setStockTotals] = useState<StockTotals | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters (movements view)
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dialog state
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);

  // Products for filter dropdown
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  // Load products for filter
  useEffect(() => {
    trpc.productos.list
      .query({ accountId: ACCOUNT_ID, isActive: true })
      .then((prods: any[]) =>
        setProducts(prods.map((p) => ({ id: p.id, name: p.name })))
      )
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "movements") {
        const result = await trpc.mercaderia.listMovements.query({
          accountId: ACCOUNT_ID,
          ...(typeFilter !== "all" && { movementType: typeFilter }),
          ...(productFilter !== "all" && { productId: productFilter }),
          ...(dateFrom && { dateFrom: new Date(dateFrom) }),
          ...(dateTo && { dateTo: new Date(dateTo + "T23:59:59") }),
        });
        setMovements(result as StockMovementItem[]);
      } else {
        const result = await trpc.mercaderia.getStockSummary.query({
          accountId: ACCOUNT_ID,
        });
        setStockSummary(result.products);
        setStockTotals(result.totals);
      }
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [viewMode, typeFilter, productFilter, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleDeleteMovement = async (id: string, type: string) => {
    if (type !== "merchandise_entry" && type !== "adjustment") {
      toast.error("Solo se pueden eliminar ingresos y ajustes desde aquí");
      return;
    }
    if (!(await confirmDeleteMovement())) return;
    try {
      await trpc.mercaderia.deleteMovement.mutate({ id });
      toast.success("Movimiento eliminado");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const handleDialogSuccess = () => {
    setShowEntryDialog(false);
    setShowAdjustmentDialog(false);
    loadData();
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setProductFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters =
    typeFilter !== "all" || productFilter !== "all" || dateFrom || dateTo;

  const exportCSV = () => {
    if (viewMode === "movements") {
      if (movements.length === 0) return;
      const headers = [
        "Fecha",
        "Producto",
        "Tipo",
        "Cantidad",
        "Costo Unit.",
        "Notas",
      ];
      const rows = movements.map((m) => [
        formatDate(m.movementDate),
        m.product.name,
        MOVEMENT_LABELS[m.movementType] || m.movementType,
        m.quantity,
        m.unitCost ?? "",
        (m.notes || "").replace(/,/g, ";"),
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n"
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimientos_stock_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      if (stockSummary.length === 0) return;
      const headers = [
        "Producto",
        "Unidad",
        "Stock Actual",
        "Stock Mín.",
        "Costo Unit.",
        "Stock Valuado",
        "Stock Bajo",
      ];
      const rows = stockSummary.map((p) => [
        p.name,
        p.unit,
        p.currentStock,
        p.minStock,
        p.unitCost,
        p.valuedStock,
        p.isLowStock ? "Si" : "No",
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n"
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Mercadería"
        description="Movimientos de stock y ajustes de inventario"
        icon={Warehouse}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1.5" />
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAdjustmentDialog(true)}>
              <SlidersHorizontal className="w-4 h-4 mr-1.5" />
              Ajuste de Stock
            </Button>
            <Button size="sm" onClick={() => setShowEntryDialog(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nuevo Ingreso
            </Button>
          </div>
        }
      />

      {/* Summary cards — always visible when stock data available */}
      {stockTotals && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Productos"
            value={stockTotals.totalProducts}
            subtitle="productos activos"
            icon={PackageOpen}
            variant="info"
          />
          <StatCard
            title="Stock Valorizado"
            value={formatCurrency(stockTotals.totalValued)}
            subtitle="valor total de inventario"
            icon={DollarSign}
            variant="default"
          />
          <StatCard
            title="Alertas de stock bajo"
            value={stockTotals.lowStockCount}
            subtitle={stockTotals.lowStockCount === 1 ? "producto bajo mínimo" : "productos bajo mínimo"}
            icon={AlertTriangle}
            variant={stockTotals.lowStockCount > 0 ? "warning" : "muted"}
          />
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            viewMode === "movements"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setViewMode("movements")}
        >
          Movimientos
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            viewMode === "stock"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setViewMode("stock")}
        >
          Stock por Producto
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MOVEMENTS VIEW */}
      {/* ═══════════════════════════════════════════════════════ */}
      {viewMode === "movements" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center p-3 bg-muted/50 rounded-lg border border-border">
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[200px] bg-background">
                <SelectValue placeholder="Producto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los productos</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px] bg-background">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="initial">Stock inicial</SelectItem>
                <SelectItem value="purchase">Compra</SelectItem>
                <SelectItem value="sale">Venta</SelectItem>
                <SelectItem value="merchandise_entry">
                  Ingreso mercadería
                </SelectItem>
                <SelectItem value="adjustment">Ajuste</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Desde:</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px] bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Hasta:</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px] bg-background"
              />
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* Movements Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : movements.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title={hasFilters ? "Sin resultados" : "Sin movimientos"}
              description={
                hasFilters
                  ? "No hay resultados para los filtros aplicados"
                  : "No hay movimientos de stock registrados"
              }
            />
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase text-muted-foreground">Fecha</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Producto</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Tipo</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Cantidad</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Costo Unit.</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Notas</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => {
                    const canDelete =
                      m.movementType === "merchandise_entry" ||
                      m.movementType === "adjustment";
                    return (
                      <TableRow key={m.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(m.movementDate)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {m.product.name}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({m.product.unit})
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium border"
                            style={MOVEMENT_STYLES[m.movementType] ?? {
                              backgroundColor: "var(--color-gray-100, #f3f4f6)",
                              color: "var(--color-gray-700, #374151)",
                              borderColor: "var(--color-gray-200, #e5e7eb)",
                            }}
                          >
                            {MOVEMENT_LABELS[m.movementType] || m.movementType}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span
                            className={
                              m.quantity > 0
                                ? "text-green-600"
                                : "text-red-500"
                            }
                          >
                            {m.quantity > 0 ? "+" : ""}
                            {m.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {m.unitCost !== null
                            ? formatCurrency(m.unitCost)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                          {m.notes || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                              onClick={() =>
                                handleDeleteMovement(m.id, m.movementType)
                              }
                            >
                              Eliminar
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {m.movementType === "sale"
                                ? "Via Ventas"
                                : m.movementType === "purchase"
                                  ? "Via Compras"
                                  : "—"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && movements.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              Mostrando {movements.length} movimientos (máx. 500)
            </p>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* STOCK SUMMARY VIEW */}
      {/* ═══════════════════════════════════════════════════════ */}
      {viewMode === "stock" && (
        <>
          {/* Stock Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : stockSummary.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title="Sin productos"
              description="No hay productos activos"
            />
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase text-muted-foreground">Producto</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Unidad</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Stock Actual</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Stock Mín.</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Costo Unit.</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Valuado</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockSummary.map((p) => (
                    <TableRow
                      key={p.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        <span
                          style={
                            p.isLowStock
                              ? { color: "var(--color-red-500, #ef4444)" }
                              : undefined
                          }
                        >
                          {p.currentStock}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {p.minStock}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(p.unitCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatCurrency(p.valuedStock)}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.isLowStock ? (
                          <Badge
                            variant="secondary"
                            className="bg-red-50 text-red-700 border-red-200"
                          >
                            Bajo
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-green-50 text-green-700 border-green-200"
                          >
                            OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <MerchandiseEntryDialog
        open={showEntryDialog}
        onOpenChange={setShowEntryDialog}
        onSuccess={handleDialogSuccess}
        accountId={ACCOUNT_ID}
      />

      <StockAdjustmentDialog
        open={showAdjustmentDialog}
        onOpenChange={setShowAdjustmentDialog}
        onSuccess={handleDialogSuccess}
        accountId={ACCOUNT_ID}
      />

      {ConfirmDeleteMovementDialog}
    </div>
  );
}
