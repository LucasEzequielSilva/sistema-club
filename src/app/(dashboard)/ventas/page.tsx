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
import { SaleDialog } from "./components/sale-dialog";
import { SaleDetail } from "./components/sale-detail";
import { toast } from "sonner";

const ACCOUNT_ID = "test-account-id";

type SaleListItem = {
  id: string;
  saleDate: Date;
  origin: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  discountPct: number;
  invoiced: boolean;
  invoiceNumber: string | null;
  status: string;
  dueDate: Date | null;
  notes: string | null;
  product: { id: string; name: string };
  category: { id: string; name: string };
  client: { id: string; name: string } | null;
  priceList: { id: string; name: string } | null;
  subtotal: number;
  ivaAmount: number;
  total: number;
  variableCostTotal: number;
  contributionMargin: number;
  marginPct: number;
  totalPaid: number;
  pendingAmount: number;
};

type SummaryData = {
  totalSales: number;
  totalCM: number;
  totalPaid: number;
  totalPending: number;
  countSales: number;
  countInvoiced: number;
  avgTicket: number;
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
    label: "Cobrado",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  overdue: {
    label: "Vencido",
    className: "bg-red-100 text-red-700 border-red-200",
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

function toInputDate(d: Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().split("T")[0];
}

export default function VentasPage() {
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dialog / detail state
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        accountId: ACCOUNT_ID,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(dateFrom && { dateFrom: new Date(dateFrom) }),
        ...(dateTo && {
          dateTo: new Date(dateTo + "T23:59:59"),
        }),
      };
      const [result, summaryResult] = await Promise.all([
        trpc.ventas.list.query(params),
        trpc.ventas.getSummary.query({
          accountId: ACCOUNT_ID,
          ...(dateFrom && { dateFrom: new Date(dateFrom) }),
          ...(dateTo && {
            dateTo: new Date(dateTo + "T23:59:59"),
          }),
        }),
      ]);
      setSales(result as SaleListItem[]);
      setSummary(summaryResult);
    } catch {
      toast.error("Error al cargar las ventas");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(loadSales, 300);
    return () => clearTimeout(timer);
  }, [loadSales]);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "¿Eliminar esta venta? Se revertirá el movimiento de stock. Esta acción no se puede deshacer."
      )
    )
      return;
    try {
      await trpc.ventas.delete.mutate({ id });
      toast.success("Venta eliminada");
      loadSales();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const handleDialogSuccess = () => {
    setShowDialog(false);
    setEditingId(null);
    loadSales();
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = statusFilter !== "all" || dateFrom || dateTo;

  const exportCSV = () => {
    if (sales.length === 0) return;
    const headers = [
      "Fecha",
      "Producto",
      "Cliente",
      "Origen",
      "Cantidad",
      "Precio Unit.",
      "Descuento %",
      "Subtotal",
      "IVA",
      "Total",
      "Costo Var.",
      "CM",
      "Margen %",
      "Cobrado",
      "Pendiente",
      "Estado",
      "Facturado",
      "Nro Factura",
    ];
    const rows = sales.map((s) => [
      formatDate(s.saleDate),
      s.product.name,
      s.client?.name || "",
      s.origin,
      s.quantity,
      s.unitPrice,
      s.discountPct,
      s.subtotal,
      s.ivaAmount,
      s.total,
      s.variableCostTotal,
      s.contributionMargin,
      s.marginPct.toFixed(1),
      s.totalPaid,
      s.pendingAmount,
      STATUS_CONFIG[s.status]?.label || s.status,
      s.invoiced ? "Si" : "No",
      s.invoiceNumber || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Detail view
  if (detailId) {
    return (
      <SaleDetail
        saleId={detailId}
        onBack={() => setDetailId(null)}
        onEdit={(id: string) => {
          setEditingId(id);
          setShowDialog(true);
          setDetailId(null);
        }}
        onRefresh={loadSales}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Ventas</h1>
          <p className="text-gray-500 mt-1">
            {loading
              ? "Cargando..."
              : `${sales.length} venta${sales.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={sales.length === 0}>
            Exportar CSV
          </Button>
          <Button
            onClick={() => {
              setEditingId(null);
              setShowDialog(true);
            }}
          >
            + Nueva Venta
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
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
            <SelectItem value="paid">Cobrado</SelectItem>
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
            <p className="text-xs text-gray-500">Total Facturado</p>
            <p className="text-lg font-bold">{formatCurrency(summary.totalSales)}</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Contribución Marginal</p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(summary.totalCM)}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Cobrado</p>
            <p className="text-lg font-bold">{formatCurrency(summary.totalPaid)}</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Pendiente de Cobro</p>
            <p className="text-lg font-bold text-amber-600">
              {formatCurrency(summary.totalPending)}
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Ticket Promedio</p>
            <p className="text-lg font-bold">{formatCurrency(summary.avgTicket)}</p>
            <p className="text-[10px] text-gray-400">
              {summary.countSales} ventas | {summary.countInvoiced} facturadas
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : sales.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {hasFilters
            ? "Sin resultados para los filtros aplicados"
            : "No hay ventas. Registrá una para comenzar."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">CM</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-center">Fact.</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => setDetailId(s.id)}
                      >
                        {formatDate(s.saleDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => setDetailId(s.id)}
                      >
                        <span className="font-medium">{s.product.name}</span>
                        <div className="text-xs text-gray-400">
                          {s.origin === "mayorista" ? "Mayorista" : "Minorista"}
                          {s.priceList && ` | ${s.priceList.name}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {s.client?.name || "—"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {s.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(s.subtotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {formatCurrency(s.total)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span
                        className={
                          s.marginPct < 20
                            ? "text-red-500"
                            : s.marginPct < 30
                              ? "text-amber-500"
                              : "text-green-600"
                        }
                      >
                        {formatCurrency(s.contributionMargin)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}
                      >
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {s.invoiced ? (
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
                          onClick={() => setDetailId(s.id)}
                        >
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 border-red-300 hover:bg-red-50"
                          onClick={() => handleDelete(s.id)}
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

      <SaleDialog
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
