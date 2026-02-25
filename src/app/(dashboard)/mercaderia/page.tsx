"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
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
import { MerchandiseEntryDialog } from "./components/entry-dialog";
import { StockAdjustmentDialog } from "./components/adjustment-dialog";
import { toast } from "sonner";

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

const MOVEMENT_COLORS: Record<string, string> = {
  initial: "bg-blue-100 text-blue-700 border-blue-200",
  purchase: "bg-green-100 text-green-700 border-green-200",
  sale: "bg-red-100 text-red-700 border-red-200",
  merchandise_entry: "bg-purple-100 text-purple-700 border-purple-200",
  adjustment: "bg-amber-100 text-amber-700 border-amber-200",
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
    if (!confirm("¿Eliminar este movimiento? Se revertirá el efecto en stock."))
      return;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Mercadería y Stock</h1>
          <p className="text-gray-500 mt-1">
            Movimientos de stock, ingresos de mercadería y ajustes manuales
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAdjustmentDialog(true)}
          >
            Ajustar Stock
          </Button>
          <Button onClick={() => setShowEntryDialog(true)}>
            + Ingreso Mercadería
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === "movements"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setViewMode("movements")}
        >
          Movimientos
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            viewMode === "stock"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
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
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[200px]">
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
              <SelectTrigger className="w-[200px]">
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
              <span className="text-sm text-gray-500">Desde:</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Hasta:</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>

            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* Movements Table */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">Cargando...</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              {hasFilters
                ? "Sin resultados para los filtros aplicados"
                : "No hay movimientos de stock registrados."}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => {
                    const canDelete =
                      m.movementType === "merchandise_entry" ||
                      m.movementType === "adjustment";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">
                          {formatDate(m.movementDate)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {m.product.name}
                          <span className="text-xs text-gray-400 ml-1">
                            ({m.product.unit})
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                              MOVEMENT_COLORS[m.movementType] ||
                              "bg-gray-100 text-gray-700 border-gray-200"
                            }`}
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
                            : "\u2014"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-[250px] truncate">
                          {m.notes || "\u2014"}
                        </TableCell>
                        <TableCell className="text-right">
                          {canDelete ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 border-red-300 hover:bg-red-50"
                              onClick={() =>
                                handleDeleteMovement(m.id, m.movementType)
                              }
                            >
                              Eliminar
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">
                              {m.movementType === "sale"
                                ? "Via Ventas"
                                : m.movementType === "purchase"
                                  ? "Via Compras"
                                  : "\u2014"}
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
            <p className="text-xs text-gray-400 text-right">
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
          {/* Summary Cards */}
          {stockTotals && (
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-gray-500">Productos Activos</p>
                <p className="text-2xl font-bold">
                  {stockTotals.totalProducts}
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-gray-500">Stock Total Valuado</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stockTotals.totalValued)}
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-gray-500">Stock Bajo</p>
                <p
                  className={`text-2xl font-bold ${
                    stockTotals.lowStockCount > 0
                      ? "text-red-500"
                      : "text-green-600"
                  }`}
                >
                  {stockTotals.lowStockCount} producto
                  {stockTotals.lowStockCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}

          {/* Stock Table */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">Cargando...</div>
          ) : stockSummary.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              No hay productos activos.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-right">Stock Mín.</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Valuado</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockSummary.map((p) => (
                    <TableRow
                      key={p.id}
                      className={p.isLowStock ? "bg-red-50" : ""}
                    >
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {p.unit}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          p.isLowStock ? "text-red-500" : ""
                        }`}
                      >
                        {p.currentStock}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-gray-500">
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
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                            Bajo
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                            OK
                          </span>
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
    </div>
  );
}
