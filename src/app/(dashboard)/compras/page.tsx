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
import { PurchaseDialog } from "./components/purchase-dialog";
import { PurchaseDetail } from "./components/purchase-detail";
import { toast } from "sonner";

const ACCOUNT_ID = "test-account-id";

type PurchaseListItem = {
  id: string;
  invoiceDate: Date;
  unitCost: number;
  quantity: number;
  discountPct: number;
  ivaAmount: number;
  invoiceNumber: string | null;
  description: string | null;
  status: string;
  dueDate: Date | null;
  notes: string | null;
  supplier: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
  costCategory: { id: string; name: string; costType: string };
  subtotal: number;
  total: number;
  totalPaid: number;
  pendingAmount: number;
};

type SummaryData = {
  totalPurchases: number;
  totalPaid: number;
  totalPending: number;
  countPurchases: number;
  totalVariable: number;
  totalFijo: number;
  totalImpuestos: number;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  partial: {
    label: "Parcial",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  paid: {
    label: "Pagado",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  overdue: {
    label: "Vencido",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

const COST_TYPE_LABELS: Record<string, string> = {
  variable: "Variable",
  fijo: "Fijo",
  impuestos: "Impuestos",
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

export default function ComprasPage() {
  const [purchases, setPurchases] = useState<PurchaseListItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // Dialog / detail state
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        accountId: ACCOUNT_ID,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(dateFrom && { dateFrom: new Date(dateFrom) }),
        ...(dateTo && {
          dateTo: new Date(dateTo + "T23:59:59"),
        }),
        ...(search && { search }),
      };
      const [result, summaryResult] = await Promise.all([
        trpc.compras.list.query(params),
        trpc.compras.getSummary.query({
          accountId: ACCOUNT_ID,
          ...(dateFrom && { dateFrom: new Date(dateFrom) }),
          ...(dateTo && {
            dateTo: new Date(dateTo + "T23:59:59"),
          }),
        }),
      ]);
      setPurchases(result as PurchaseListItem[]);
      setSummary(summaryResult);
    } catch {
      toast.error("Error al cargar las compras");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    const timer = setTimeout(loadPurchases, 300);
    return () => clearTimeout(timer);
  }, [loadPurchases]);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "¿Eliminar esta compra? Se revertirá el movimiento de stock (si aplica). Esta acción no se puede deshacer."
      )
    )
      return;
    try {
      await trpc.compras.delete.mutate({ id });
      toast.success("Compra eliminada");
      loadPurchases();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const handleDialogSuccess = () => {
    setShowDialog(false);
    setEditingId(null);
    loadPurchases();
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const hasFilters =
    statusFilter !== "all" || dateFrom || dateTo || search;

  const exportCSV = () => {
    if (purchases.length === 0) return;
    const headers = [
      "Fecha",
      "Proveedor",
      "Producto",
      "Descripción",
      "Categoría Costo",
      "Tipo Costo",
      "Cantidad",
      "Costo Unit.",
      "Descuento %",
      "Subtotal",
      "IVA",
      "Total",
      "Pagado",
      "Pendiente",
      "Estado",
      "Nro Factura",
    ];
    const rows = purchases.map((p) => [
      formatDate(p.invoiceDate),
      p.supplier?.name || "",
      p.product?.name || "",
      p.description || "",
      p.costCategory.name,
      COST_TYPE_LABELS[p.costCategory.costType] || p.costCategory.costType,
      p.quantity,
      p.unitCost,
      p.discountPct,
      p.subtotal,
      p.ivaAmount,
      p.total,
      p.totalPaid,
      p.pendingAmount,
      STATUS_CONFIG[p.status]?.label || p.status,
      p.invoiceNumber || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compras_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Detail view
  if (detailId) {
    return (
      <PurchaseDetail
        purchaseId={detailId}
        onBack={() => setDetailId(null)}
        onEdit={(id: string) => {
          setEditingId(id);
          setShowDialog(true);
          setDetailId(null);
        }}
        onRefresh={loadPurchases}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Compras / Egresos</h1>
          <p className="text-gray-500 mt-1">
            {loading
              ? "Cargando..."
              : `${purchases.length} registro${purchases.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportCSV}
            disabled={purchases.length === 0}
          >
            Exportar CSV
          </Button>
          <Button
            onClick={() => {
              setEditingId(null);
              setShowDialog(true);
            }}
          >
            + Nueva Compra
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Buscar por descripción o factura..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[260px]"
        />
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-3">
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Total Egresos</p>
            <p className="text-lg font-bold">
              {formatCurrency(summary.totalPurchases)}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Pagado</p>
            <p className="text-lg font-bold">
              {formatCurrency(summary.totalPaid)}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Pendiente de Pago</p>
            <p className="text-lg font-bold text-amber-600">
              {formatCurrency(summary.totalPending)}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">C. Variables</p>
            <p className="text-lg font-bold text-blue-600">
              {formatCurrency(summary.totalVariable)}
            </p>
            <p className="text-[10px] text-gray-400">
              Fijos: {formatCurrency(summary.totalFijo)}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Impuestos</p>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(summary.totalImpuestos)}
            </p>
            <p className="text-[10px] text-gray-400">
              {summary.countPurchases} registros
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {hasFilters
            ? "Sin resultados para los filtros aplicados"
            : "No hay compras. Registrá una para comenzar."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => {
                const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                const conceptLabel = p.product?.name || p.description || "—";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => setDetailId(p.id)}
                      >
                        {formatDate(p.invoiceDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => setDetailId(p.id)}
                      >
                        <span className="font-medium">{conceptLabel}</span>
                        <div className="text-xs text-gray-400">
                          {COST_TYPE_LABELS[p.costCategory.costType] ||
                            p.costCategory.costType}
                          {p.invoiceNumber && ` | Fact. ${p.invoiceNumber}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {p.supplier?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.costCategory.name}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {p.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(p.subtotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {formatCurrency(p.total)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}
                      >
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailId(p.id)}
                        >
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 border-red-300 hover:bg-red-50"
                          onClick={() => handleDelete(p.id)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PurchaseDialog
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
