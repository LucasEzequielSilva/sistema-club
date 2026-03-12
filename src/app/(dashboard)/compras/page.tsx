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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PurchaseDialog } from "./components/purchase-dialog";
import { PurchaseDetail } from "./components/purchase-detail";
import { PurchaseInvoiceModal } from "./components/purchase-invoice-modal";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { ShoppingCart, MoreHorizontal, Loader2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { useAccountId } from "@/hooks/use-account-id";

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

type StatusVariant = "default" | "success" | "danger" | "warning" | "info" | "muted";

const STATUS_CONFIG: Record<string, { label: string; variant: StatusVariant }> = {
  pending: { label: "Pendiente", variant: "warning" },
  partial: { label: "Parcial", variant: "info" },
  paid: { label: "Pagado", variant: "success" },
  overdue: { label: "Vencido", variant: "danger" },
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  partial: "bg-blue-100 text-blue-700 border-blue-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
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
  const { accountId } = useAccountId();
  const router = useRouter();
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
  const [invoiceModalId, setInvoiceModalId] = useState<string | null>(null);

  const [confirmDelete, ConfirmDialog] = useConfirm({
    title: "Eliminar compra",
    description: "Se revertirá el movimiento de stock (si aplica). Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  const loadPurchases = useCallback(async () => {
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
        ...(search && { search }),
      };
      const [result, summaryResult] = await Promise.all([
        trpc.compras.list.query(params),
        trpc.compras.getSummary.query({
          accountId,
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
  }, [statusFilter, dateFrom, dateTo, search, accountId]);

  useEffect(() => {
    const timer = setTimeout(loadPurchases, 300);
    return () => clearTimeout(timer);
  }, [loadPurchases]);

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete())) return;
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Compras"
        description="Registro de egresos y pagos a proveedores"
        icon={ShoppingCart}
        actions={
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
        }
      />

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            title="Total Egresos"
            value={formatCurrency(summary.totalPurchases)}
            subtitle={`${summary.countPurchases} registros`}
            variant="danger"
          />
          <StatCard
            title="Pagado"
            value={formatCurrency(summary.totalPaid)}
            variant="muted"
          />
          <StatCard
            title="Pendiente"
            value={formatCurrency(summary.totalPending)}
            variant="warning"
          />
          <StatCard
            title="C. Variables"
            value={formatCurrency(summary.totalVariable)}
            variant="warning"
          />
          <StatCard
            title="C. Fijos"
            value={formatCurrency(summary.totalFijo)}
            variant="muted"
          />
          <StatCard
            title="Impuestos"
            value={formatCurrency(summary.totalImpuestos)}
            variant="muted"
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border mb-4 flex-wrap">
        <Input
          placeholder="Buscar por descripción o factura..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[260px]"
        />
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
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="h-3 w-8 bg-muted rounded mx-auto" />
              <div className="h-3 w-16 bg-muted rounded ml-auto" />
              <div className="h-3 w-16 bg-muted rounded ml-auto" />
              <div className="h-5 w-14 bg-muted rounded mx-auto" />
              <div className="h-3 w-6 bg-muted rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : purchases.length === 0 ? (
        hasFilters ? (
          <div className="text-center py-16 text-muted-foreground">
            Sin resultados para los filtros aplicados
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={ShoppingCart}
              title="Sin compras registradas"
              description="Antes de registrar compras, asegurate de tener proveedores cargados."
              actionLabel="Ver Proveedores"
              onAction={() => router.push("/proveedores")}
            />
          </div>
        )
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
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
                const conceptLabel = p.product?.name || p.description || "—";
                const statusClass = STATUS_BADGE_CLASS[p.status] || STATUS_BADGE_CLASS.pending;
                const statusLabel = STATUS_CONFIG[p.status]?.label || p.status;
                return (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell className="text-sm">
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => setInvoiceModalId(p.id)}
                      >
                        {formatDate(p.invoiceDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => setInvoiceModalId(p.id)}
                      >
                        <span className="font-medium">{conceptLabel}</span>
                        <div className="text-xs text-muted-foreground">
                          {COST_TYPE_LABELS[p.costCategory.costType] ||
                            p.costCategory.costType}
                          {p.invoiceNumber && ` | Fact. ${p.invoiceNumber}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.supplier?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.costCategory.name}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {p.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                      {formatCurrency(p.subtotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                      {formatCurrency(p.total)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setInvoiceModalId(p.id)}>
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingId(p.id);
                              setShowDialog(true);
                            }}
                          >
                            Agregar pago
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(p.id)}
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

      <PurchaseDialog
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

      <PurchaseInvoiceModal
        purchaseId={invoiceModalId}
        onClose={() => setInvoiceModalId(null)}
      />
    </div>
  );
}
