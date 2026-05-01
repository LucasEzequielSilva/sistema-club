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
import { isDeposit } from "@/lib/sale-flags";

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
  payments: {
    id: string;
    amount: number;
    paymentMethod: { id: string; name: string };
    paymentChannel?: { id: string; name: string; feePct?: number } | null;
    paymentAccount?: { id: string; name: string } | null;
  }[];
};

type PaymentMethodRow = {
  id: string;
  name: string;
  isActive: boolean;
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

function defaultOnePayFee(methodName: string): number {
  const name = methodName.toLowerCase();
  if (name.includes("efectivo") || name.includes("transfer")) return 0;
  if (name.includes("debito") || name.includes("débito")) return 1.5;
  if (name.includes("mercado pago") || name.includes("mp")) return 5;
  if (name.includes("credito") || name.includes("crédito") || name.includes("tarjeta")) return 7;
  return 0;
}

function toInputDate(d: Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().split("T")[0];
}

function getPosTicketId(notes?: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/\[POS_TICKET:([^\]]+)\]/);
  return m?.[1] ?? null;
}

function mergeStatus(current: string, next: string): string {
  const weight: Record<string, number> = { overdue: 4, partial: 3, pending: 2, paid: 1 };
  return (weight[next] ?? 0) > (weight[current] ?? 0) ? next : current;
}

export default function VentasPage() {
  const { accountId } = useAccountId();
  const router = useRouter();
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"ventas" | "rentabilidad">("ventas");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [onePayFeePct, setOnePayFeePct] = useState<Record<string, number>>({});
  const [installmentFeePct, setInstallmentFeePct] = useState<Record<string, number>>({});
  const [absorbInstallments, setAbsorbInstallments] = useState(false);
  // feePct configurado por canal, mapeado a paymentMethodId.
  // Permite que la tabla de rentabilidad arranque con la comisión real
  // que el user configuró en Clasificaciones, no con una heurística.
  const [configuredFees, setConfiguredFees] = useState<Record<string, number>>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyDeposits, setOnlyDeposits] = useState(false);

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
      const params: {
        status?: string;
        dateFrom?: Date;
        dateTo?: Date;
      } = {
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(dateFrom && { dateFrom: new Date(dateFrom) }),
        ...(dateTo && {
          dateTo: new Date(dateTo + "T23:59:59"),
        }),
      };
      const [result, summaryResult, methodsResult, channelsResult] = await Promise.all([
        trpc.ventas.list.query(params),
        trpc.ventas.getSummary.query({
          ...(dateFrom && { dateFrom: new Date(dateFrom) }),
          ...(dateTo && {
            dateTo: new Date(dateTo + "T23:59:59"),
          }),
        }),
        trpc.clasificaciones.listPaymentMethods.query(),
        trpc.clasificaciones.listPaymentChannels.query({ isActive: true }),
      ]);
      setSales(result as SaleListItem[]);
      setSummary(summaryResult);

      const methods = (methodsResult as PaymentMethodRow[])
        .filter((m) => m.isActive)
        .map((m) => ({ id: m.id, name: m.name, isActive: m.isActive }));
      setPaymentMethods(methods);

      // Mapear methodId → feePct desde los canales configurados.
      // Estrategia: por cada método, agarrar el canal default si existe;
      // sino el primero activo. Si no hay canal, fallback a 0 (luego se
      // resuelve con la heurística defaultOnePayFee).
      const channels = channelsResult as Array<{
        id: string;
        paymentMethodId: string | null;
        feePct: number;
        isDefault: boolean;
        isActive: boolean;
      }>;
      const fees: Record<string, number> = {};
      for (const m of methods) {
        const ofMethod = channels.filter((c) => c.paymentMethodId === m.id);
        const chosen = ofMethod.find((c) => c.isDefault) ?? ofMethod[0];
        if (chosen) fees[m.id] = chosen.feePct;
      }
      setConfiguredFees(fees);

      setOnePayFeePct((prev) => {
        const next = { ...prev };
        for (const m of methods) {
          if (next[m.id] === undefined) {
            next[m.id] = fees[m.id] ?? defaultOnePayFee(m.name);
          }
        }
        return next;
      });
      setInstallmentFeePct((prev) => {
        const next = { ...prev };
        for (const m of methods) {
          if (next[m.id] === undefined) next[m.id] = 0;
        }
        return next;
      });
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

  useEffect(() => {
    if (!accountId) return;
    try {
      const raw = localStorage.getItem(`sc_fee_config_${accountId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.onePayFeePct) setOnePayFeePct(parsed.onePayFeePct);
      if (parsed?.installmentFeePct) setInstallmentFeePct(parsed.installmentFeePct);
      if (typeof parsed?.absorbInstallments === "boolean") {
        setAbsorbInstallments(parsed.absorbInstallments);
      }
    } catch {
      // ignore invalid local data
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    localStorage.setItem(
      `sc_fee_config_${accountId}`,
      JSON.stringify({ onePayFeePct, installmentFeePct, absorbInstallments })
    );
  }, [accountId, onePayFeePct, installmentFeePct, absorbInstallments]);

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete())) return;
    try {
      await trpc.ventas.delete.mutate({ id });
      toast.success("Venta eliminada");
      loadSales();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al eliminar";
      toast.error(message);
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
    setOnlyDeposits(false);
  };

  const hasFilters = statusFilter !== "all" || dateFrom || dateTo || onlyDeposits;

  const filteredSales = onlyDeposits
    ? sales.filter((s) => isDeposit(s.notes))
    : sales;

  const ticketRows = (() => {
    const groups = new Map<
      string,
      {
        key: string;
        saleIds: string[];
        saleDate: Date;
        productNames: Set<string>;
        clientNames: Set<string>;
        quantity: number;
        subtotal: number;
        total: number;
        contributionMargin: number;
        status: string;
        invoicedCount: number;
        salesCount: number;
        origin: string;
        priceListName: string;
        hasDeposit: boolean;
      }
    >();

    for (const s of filteredSales) {
      const ticket = getPosTicketId(s.notes) ?? `single-${s.id}`;
      const current = groups.get(ticket) ?? {
        key: ticket,
        saleIds: [],
        saleDate: new Date(s.saleDate),
        productNames: new Set<string>(),
        clientNames: new Set<string>(),
        quantity: 0,
        subtotal: 0,
        total: 0,
        contributionMargin: 0,
        status: s.status,
        invoicedCount: 0,
        salesCount: 0,
        origin: s.origin,
        priceListName: s.priceList?.name ?? "",
        hasDeposit: false,
      };

      current.saleIds.push(s.id);
      if (new Date(s.saleDate) > current.saleDate) current.saleDate = new Date(s.saleDate);
      current.productNames.add(s.product.name);
      if (s.client?.name) current.clientNames.add(s.client.name);
      current.quantity += s.quantity;
      current.subtotal += s.subtotal;
      current.total += s.total;
      current.contributionMargin += s.contributionMargin;
      current.status = mergeStatus(current.status, s.status);
      current.invoicedCount += s.invoiced ? 1 : 0;
      current.salesCount += 1;
      if (isDeposit(s.notes)) current.hasDeposit = true;
      groups.set(ticket, current);
    }

    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
    );
  })();

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

  const profitabilityByMethod = paymentMethods.map((method) => {
    let collected = 0;
    let grossContribution = 0;
    let paymentsCount = 0;
    const productNames = new Set<string>();

    for (const sale of sales) {
      const saleTotal = sale.total || 0;
      for (const p of sale.payments || []) {
        if (p.paymentMethod.id !== method.id) continue;
        const amount = p.amount || 0;
        const contributionShare =
          saleTotal > 0 ? (sale.contributionMargin * amount) / saleTotal : 0;
        collected += amount;
        grossContribution += contributionShare;
        paymentsCount += 1;
        productNames.add(sale.product.name);
      }
    }

    const onePayPct = onePayFeePct[method.id] ?? configuredFees[method.id] ?? defaultOnePayFee(method.name);
    const installmentPct = absorbInstallments ? installmentFeePct[method.id] ?? 0 : 0;
    const totalFeePct = onePayPct + installmentPct;
    const feeCost = collected * (totalFeePct / 100);
    const netContribution = grossContribution - feeCost;
    const netMarginPct = collected > 0 ? (netContribution / collected) * 100 : 0;

    return {
      methodId: method.id,
      methodName: method.name,
      paymentsCount,
      productsCount: productNames.size,
      productsPreview: Array.from(productNames).slice(0, 3).join(", "),
      collected,
      onePayPct,
      installmentPct,
      totalFeePct,
      feeCost,
      grossContribution,
      netContribution,
      netMarginPct,
    };
  });

  const profitabilityTotals = profitabilityByMethod.reduce(
    (acc, row) => {
      acc.collected += row.collected;
      acc.feeCost += row.feeCost;
      acc.grossContribution += row.grossContribution;
      acc.netContribution += row.netContribution;
      return acc;
    },
    { collected: 0, feeCost: 0, grossContribution: 0, netContribution: 0 }
  );

  const profitabilityByChannelMap = new Map<
    string,
    {
      channelId: string;
      channelName: string;
      accountName: string;
      paymentsCount: number;
      collected: number;
      grossContribution: number;
      feeCost: number;
      netContribution: number;
      products: Set<string>;
    }
  >();

  for (const sale of sales) {
    const saleTotal = sale.total || 0;
    for (const p of sale.payments || []) {
      const channelId = p.paymentChannel?.id ?? "no-channel";
      const channelName = p.paymentChannel?.name ?? "Sin canal";
      const accountName = p.paymentAccount?.name ?? "Sin cuenta";
      const amount = p.amount || 0;
      const contributionShare =
        saleTotal > 0 ? (sale.contributionMargin * amount) / saleTotal : 0;

      let feePct = 0;
      if (p.paymentChannel?.id) {
        feePct = p.paymentChannel?.feePct ?? 0;
      } else {
        const one = onePayFeePct[p.paymentMethod.id] ?? configuredFees[p.paymentMethod.id] ?? defaultOnePayFee(p.paymentMethod.name);
        const inst = absorbInstallments ? installmentFeePct[p.paymentMethod.id] ?? 0 : 0;
        feePct = one + inst;
      }

      const feeCost = amount * (feePct / 100);

      const current = profitabilityByChannelMap.get(channelId) ?? {
        channelId,
        channelName,
        accountName,
        paymentsCount: 0,
        collected: 0,
        grossContribution: 0,
        feeCost: 0,
        netContribution: 0,
        products: new Set<string>(),
      };

      current.paymentsCount += 1;
      current.collected += amount;
      current.grossContribution += contributionShare;
      current.feeCost += feeCost;
      current.netContribution += contributionShare - feeCost;
      current.products.add(sale.product.name);

      profitabilityByChannelMap.set(channelId, current);
    }
  }

  const profitabilityByChannel = Array.from(profitabilityByChannelMap.values())
    .map((row) => ({
      ...row,
      productsCount: row.products.size,
      productsPreview: Array.from(row.products).slice(0, 3).join(", "),
      netMarginPct: row.collected > 0 ? (row.netContribution / row.collected) * 100 : 0,
    }))
    .sort((a, b) => b.collected - a.collected);

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

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={activeView === "ventas" ? "default" : "outline"}
          onClick={() => setActiveView("ventas")}
        >
          Ventas
        </Button>
        <Button
          size="sm"
          variant={activeView === "rentabilidad" ? "default" : "outline"}
          onClick={() => setActiveView("rentabilidad")}
        >
          Rentabilidad por cobro
        </Button>
      </div>

      {activeView === "rentabilidad" && (
      <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Rentabilidad por medio de cobro
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Segmenta productos vendidos por medio de cobro y estima impacto de comisiones.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={absorbInstallments}
              onChange={(e) => setAbsorbInstallments(e.target.checked)}
              className="h-4 w-4"
            />
            Absorber comisión de cuotas
          </label>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2">Medio de cobro</th>
                <th className="text-left py-2">Productos vendidos</th>
                <th className="text-right py-2">Cobros</th>
                <th className="text-right py-2">Monto cobrado</th>
                <th className="text-right py-2">Comisión 1 pago %</th>
                <th className="text-right py-2">Comisión cuotas %</th>
                <th className="text-right py-2">Costo por cobrar</th>
                <th className="text-right py-2">CM bruto</th>
                <th className="text-right py-2">CM neto</th>
                <th className="text-right py-2">Margen neto %</th>
              </tr>
            </thead>
            <tbody>
              {profitabilityByMethod.map((row) => (
                <tr key={row.methodId} className="border-b border-border/60 last:border-0">
                  <td className="py-2 font-medium">{row.methodName}</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {row.productsCount > 0
                      ? `${row.productsCount} producto(s)${row.productsPreview ? ` · ${row.productsPreview}` : ""}`
                      : "—"}
                  </td>
                  <td className="py-2 text-right font-mono">{row.paymentsCount}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(row.collected)}</td>
                  <td className="py-2 text-right">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-[96px] ml-auto text-right"
                      value={String(onePayFeePct[row.methodId] ?? configuredFees[row.methodId] ?? defaultOnePayFee(row.methodName))}
                      onChange={(e) =>
                        setOnePayFeePct((prev) => ({
                          ...prev,
                          [row.methodId]: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </td>
                  <td className="py-2 text-right">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-[96px] ml-auto text-right"
                      value={String(installmentFeePct[row.methodId] ?? 0)}
                      onChange={(e) =>
                        setInstallmentFeePct((prev) => ({
                          ...prev,
                          [row.methodId]: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </td>
                  <td className="py-2 text-right font-mono">{formatCurrency(row.feeCost)}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(row.grossContribution)}</td>
                  <td className="py-2 text-right font-mono font-semibold">{formatCurrency(row.netContribution)}</td>
                  <td className="py-2 text-right font-mono">{row.netMarginPct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2" />
                <td className="py-2" />
                <td className="py-2 text-right font-mono">{formatCurrency(profitabilityTotals.collected)}</td>
                <td className="py-2" />
                <td className="py-2" />
                <td className="py-2 text-right font-mono">{formatCurrency(profitabilityTotals.feeCost)}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(profitabilityTotals.grossContribution)}</td>
                <td className="py-2 text-right font-mono">{formatCurrency(profitabilityTotals.netContribution)}</td>
                <td className="py-2 text-right font-mono">
                  {profitabilityTotals.collected > 0
                    ? `${((profitabilityTotals.netContribution / profitabilityTotals.collected) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Rentabilidad por canal / cuenta receptora
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Usa comisión del canal cuando existe; si no, cae a la comisión configurada del método.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2">Canal</th>
                <th className="text-left py-2">Cuenta</th>
                <th className="text-left py-2">Productos vendidos</th>
                <th className="text-right py-2">Cobros</th>
                <th className="text-right py-2">Monto cobrado</th>
                <th className="text-right py-2">Costo por cobrar</th>
                <th className="text-right py-2">CM bruto</th>
                <th className="text-right py-2">CM neto</th>
                <th className="text-right py-2">Margen neto %</th>
              </tr>
            </thead>
            <tbody>
              {profitabilityByChannel.map((row) => (
                <tr key={row.channelId} className="border-b border-border/60 last:border-0">
                  <td className="py-2 font-medium">{row.channelName}</td>
                  <td className="py-2 text-muted-foreground">{row.accountName}</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {row.productsCount > 0
                      ? `${row.productsCount} producto(s)${row.productsPreview ? ` · ${row.productsPreview}` : ""}`
                      : "—"}
                  </td>
                  <td className="py-2 text-right font-mono">{row.paymentsCount}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(row.collected)}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(row.feeCost)}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(row.grossContribution)}</td>
                  <td className="py-2 text-right font-mono font-semibold">{formatCurrency(row.netContribution)}</td>
                  <td className="py-2 text-right font-mono">{row.netMarginPct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}

      {/* Filter Bar */}
      {activeView === "ventas" && (
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

        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={onlyDeposits}
            onChange={(e) => setOnlyDeposits(e.target.checked)}
            className="h-4 w-4"
          />
          Solo señas
        </label>

        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>
      )}

      {/* Table */}
      {activeView === "ventas" && (loading ? (
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
      ) : ticketRows.length === 0 ? (
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
                  <TableHead className="text-xs uppercase text-muted-foreground">Ticket</TableHead>
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
              {ticketRows.map((t) => {
                const firstSaleId = t.saleIds[0];
                const badgeStyle = STATUS_BADGE_STYLE[t.status] || STATUS_BADGE_STYLE.pending;
                const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending;
                const productsPreview = Array.from(t.productNames).slice(0, 2).join(", ");
                const isSingle = t.salesCount === 1;
                return (
                  <TableRow key={t.key} className="hover:bg-muted/40">
                    <TableCell className="text-sm">
                      <div
                        className="cursor-pointer hover:underline text-foreground"
                        onClick={() => setDetailId(firstSaleId)}
                      >
                        {formatDate(t.saleDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="cursor-pointer hover:underline"
                        onClick={() => setDetailId(firstSaleId)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {isSingle ? productsPreview : `${t.salesCount} ítems`}
                          </span>
                          {t.hasDeposit && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0 font-medium"
                            >
                              Seña
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isSingle ? productsPreview : `${productsPreview}${t.productNames.size > 2 ? "…" : ""}`}
                          {` | ${t.origin === "mayorista" ? "Mayorista" : "Minorista"}`}
                          {t.priceListName ? ` | ${t.priceListName}` : ""}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.clientNames.size > 0 ? Array.from(t.clientNames).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm text-foreground">
                      {t.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {formatCurrency(t.subtotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                      {formatCurrency(t.total)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                      {formatCurrency(t.contributionMargin)}
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
                      {t.invoicedCount === t.salesCount ? (
                        <span style={{ color: "var(--success-muted-foreground)" }}>&#10003;</span>
                      ) : t.invoicedCount > 0 ? (
                        <span className="text-amber-500">~</span>
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
                          <DropdownMenuItem onClick={() => setDetailId(firstSaleId)}>
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDetailId(firstSaleId)}>
                            Agregar cobro
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(firstSaleId)}
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
      ))}

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
