"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SaleDialog } from "./components/sale-dialog";
import { SaleDetail } from "./components/sale-detail";
import { toast } from "sonner";
import { TrendingUp, Receipt, CheckCircle2, Clock, Percent, MoreHorizontal, Loader2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useAccountId } from "@/hooks/use-account-id";

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

// Semantic badge styles using CSS variables
const STATUS_BADGE_STYLE: Record<string, React.CSSProperties> = {
  pending: {
    backgroundColor: "var(--warning-muted)",
    color: "var(--warning-muted-foreground)",
    borderColor: "var(--warning-muted-foreground)",
  },
  partial: {
    backgroundColor: "var(--info-muted)",
    color: "var(--info-muted-foreground)",
    borderColor: "var(--info-muted-foreground)",
  },
  paid: {
    backgroundColor: "var(--success-muted)",
    color: "var(--success-muted-foreground)",
    borderColor: "var(--success-muted-foreground)",
  },
  overdue: {
    backgroundColor: "var(--danger-muted)",
    color: "var(--danger-muted-foreground)",
    borderColor: "var(--danger-muted-foreground)",
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
  const { accountId } = useAccountId();
  const router = useRouter();
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

  const [confirmDelete, ConfirmDialog] = useConfirm({
    title: "Eliminar venta",
    description: "Se revertirá el movimiento de stock. Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  const loadSales = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const params: any = {
        accountId,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(dateFrom && { dateFrom: new Date(dateFrom) }),
        ...(dateTo && {
          dateTo: new Date(dateTo + "T23:59:59"),
        }),
      };
      const [result, summaryResult] = await Promise.all([
        trpc.ventas.list.query(params),
        trpc.ventas.getSummary.query({
          accountId,
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
  }, [statusFilter, dateFrom, dateTo, accountId]);

  useEffect(() => {
    const timer = setTimeout(loadSales, 300);
    return () => clearTimeout(timer);
  }, [loadSales]);

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete())) return;
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

  const totalFacturadoMonto = sales
    .filter((s) => s.invoiced)
    .reduce((sum, s) => sum + s.total, 0);
  const totalNoFacturadoMonto = sales
    .filter((s) => !s.invoiced)
    .reduce((sum, s) => sum + s.total, 0);
  const totalMontoVentas = totalFacturadoMonto + totalNoFacturadoMonto;
  const pctFacturado = totalMontoVentas > 0 ? (totalFacturadoMonto / totalMontoVentas) * 100 : 0;
  const pctNoFacturado = totalMontoVentas > 0 ? (totalNoFacturadoMonto / totalMontoVentas) * 100 : 0;
  const avgMcPct = sales.length > 0 ? sales.reduce((sum, s) => sum + s.marginPct, 0) / sales.length : 0;

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Ventas"
        description="Registro de ingresos"
        icon={TrendingUp}
          actions={
          <>
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              className={statusFilter === "pending" ? "" : ""}
              onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Cobros pendientes
            </Button>
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
          </>
        }
      />

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-3">
          <StatCard
            title="Total Facturado"
            value={formatCurrency(summary.totalSales)}
            icon={TrendingUp}
            variant="default"
          />
          <StatCard
            title="Contribución Marginal"
            value={formatCurrency(summary.totalCM)}
            icon={Percent}
            variant="success"
          />
          <StatCard
            title="Cobrado"
            value={formatCurrency(summary.totalPaid)}
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="Pendiente de Cobro"
            value={formatCurrency(summary.totalPending)}
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Ticket Promedio"
            value={formatCurrency(summary.avgTicket)}
            subtitle={`${summary.countSales} ventas | ${summary.countInvoiced} facturadas`}
            icon={Receipt}
            variant="default"
          />
          <StatCard
            title="MC Promedio"
            value={`${avgMcPct.toFixed(1)}%`}
            subtitle="Margen de contribución promedio"
            icon={Percent}
            variant="default"
          />
          <StatCard
            title="Facturado"
            value={formatCurrency(totalFacturadoMonto)}
            subtitle={`${pctFacturado.toFixed(1)}% del total`}
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="No Facturado"
            value={formatCurrency(totalNoFacturadoMonto)}
            subtitle={`${pctNoFacturado.toFixed(1)}% del total`}
            icon={Clock}
            variant="warning"
          />
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Desde:</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Hasta:</span>
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

      {/* Table */}
      {loading ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b border-border">
            <div className="grid grid-cols-10 gap-3 animate-pulse">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-3 bg-muted rounded" />
              ))}
            </div>
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-10 gap-3 px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="h-3 w-8 bg-muted rounded mx-auto" />
              <div className="h-3 w-16 bg-muted rounded ml-auto" />
              <div className="h-3 w-16 bg-muted rounded ml-auto" />
              <div className="h-3 w-16 bg-muted rounded ml-auto" />
              <div className="h-5 w-14 bg-muted rounded mx-auto" />
              <div className="h-3 w-6 bg-muted rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : sales.length === 0 ? (
        hasFilters ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={TrendingUp}
              title="Sin resultados"
              description="No se encontraron ventas para los filtros aplicados."
              actionLabel="Limpiar filtros"
              onAction={clearFilters}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={TrendingUp}
              title="Tu primera venta te espera"
              description="Registrá ventas desde acá o usá el Punto de Venta para hacerlo rápido."
              actionLabel="Ir al Punto de Venta"
              onAction={() => router.push("/pos")}
            />
          </div>
        )
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase text-muted-foreground">Fecha</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Producto</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Cliente</TableHead>
                <TableHead className="text-center text-xs uppercase text-muted-foreground">Cant.</TableHead>
                <TableHead className="text-right text-xs uppercase text-muted-foreground">Subtotal</TableHead>
                <TableHead className="text-right text-xs uppercase text-muted-foreground">Total</TableHead>
                <TableHead className="text-right text-xs uppercase text-muted-foreground">CM</TableHead>
                <TableHead className="text-center text-xs uppercase text-muted-foreground">Estado</TableHead>
                <TableHead className="text-center text-xs uppercase text-muted-foreground">Fact.</TableHead>
                <TableHead className="text-right text-xs uppercase text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => {
                const badgeStyle = STATUS_BADGE_STYLE[s.status] || STATUS_BADGE_STYLE.pending;
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                return (
                  <TableRow key={s.id} className="hover:bg-muted/40">
                    <TableCell className="text-sm">
                      <div
                        className="cursor-pointer hover:underline text-foreground"
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
                        <span className="font-medium text-foreground">{s.product.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {s.origin === "mayorista" ? "Mayorista" : "Minorista"}
                          {s.priceList && ` | ${s.priceList.name}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.client?.name || "—"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm text-foreground">
                      {s.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {formatCurrency(s.subtotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                      {formatCurrency(s.total)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                      {formatCurrency(s.contributionMargin)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={badgeStyle}
                      >
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-foreground">
                      {s.invoiced ? (
                        <span style={{ color: "var(--success-muted-foreground)" }}>&#10003;</span>
                      ) : (
                        <span className="text-muted-foreground">&#10007;</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Abrir menú</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailId(s.id)}>
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDetailId(s.id)}>
                            Agregar cobro
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(s.id)}
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        accountId={accountId ?? ""}
        editingId={editingId}
      />
      {ConfirmDialog}
    </div>
  );
}
