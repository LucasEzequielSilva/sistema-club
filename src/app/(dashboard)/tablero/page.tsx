"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  Receipt,
  ArrowDownCircle,
  Layers,
  Building2,
  FileText,
  Sparkles,
  LayoutDashboard,
  BarChart3,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { SetupChecklist } from "@/components/shared/setup-checklist";
import { useAccountId } from "@/hooks/use-account-id";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatCurrencyShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPct(n: number) {
  return n.toFixed(1) + "%";
}

function formatDateFull(d: Date | string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];
const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  partial: "#3b82f6",
  paid: "#22c55e",
  overdue: "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Cobrada",
  overdue: "Vencida",
};

type PeriodPreset = "today" | "this_month" | "last_month" | "quarter" | "year";

export default function TableroPage() {
  const { accountId } = useAccountId();
  const router = useRouter();
  const [preset, setPreset] = useState<PeriodPreset>("today");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // ── Meta mensual ──
  const [salesGoal, setSalesGoal] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("clubiSalesGoal") || "0");
  });
  const [goalInputValue, setGoalInputValue] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);

  const getDateRange = useCallback((p: PeriodPreset) => {
    const today = new Date();
    switch (p) {
      case "today":
        return {
          from: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0),
          to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
        };
      case "this_month":
        return {
          from: new Date(today.getFullYear(), today.getMonth(), 1),
          to: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59),
        };
      case "last_month":
        return {
          from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
          to: new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59),
        };
      case "quarter": {
        const qStart = Math.floor(today.getMonth() / 3) * 3;
        return {
          from: new Date(today.getFullYear(), qStart, 1),
          to: new Date(today.getFullYear(), qStart + 3, 0, 23, 59, 59),
        };
      }
      case "year":
        return {
          from: new Date(today.getFullYear(), 0, 1),
          to: new Date(today.getFullYear(), 11, 31, 23, 59, 59),
        };
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const range = getDateRange(preset);
      const result = await trpc.tablero.getDashboard.query({
        accountId,
        dateFrom: range.from,
        dateTo: range.to,
      });
      setData(result);
    } catch {
      toast.error("Error al cargar dashboard");
    } finally {
      setLoading(false);
    }
  }, [preset, getDateRange, accountId]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const PRESETS: { id: PeriodPreset; label: string }[] = [
    { id: "today", label: "Hoy" },
    { id: "this_month", label: "Este Mes" },
    { id: "last_month", label: "Mes Anterior" },
    { id: "quarter", label: "Trimestre" },
    { id: "year", label: "Año" },
  ];

  const statusPieData = data
    ? Object.entries(data.charts.statusCounts)
        .filter(([, v]) => (v as number) > 0)
        .map(([key, value]) => ({
          name: STATUS_LABELS[key] || key,
          value: value as number,
          color: STATUS_COLORS[key] || "#94a3b8",
        }))
    : [];

  const marginVariant =
    data?.kpis.margenCM >= 30
      ? "success"
      : data?.kpis.margenCM >= 20
        ? "warning"
        : "danger";

  // Calcular streak de días consecutivos con ventas
  const streak = (() => {
    if (!data?.charts?.dailySales?.length) return 0;
    const salesByDate: Record<string, number> = {};
    data.charts.dailySales.forEach((d: any) => {
      salesByDate[d.date] = d.ventas;
    });
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      if ((salesByDate[key] ?? 0) > 0) {
        count++;
      } else if (i > 0) {
        break; // Cadena rota
      }
    }
    return count;
  })();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Tablero"
        description="Vista general del negocio"
        icon={LayoutDashboard}
        actions={
          <div className="flex items-center gap-2">
            {streak >= 3 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-medium">
                🔥 {streak} días seguidos
              </span>
            )}
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={preset === p.id ? "default" : "outline"}
                  onClick={() => setPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {/* Skeleton stat cards row 1 */}
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-4 w-4 bg-muted rounded" />
                </div>
                <div className="h-7 w-32 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
          {/* Skeleton stat cards row 2 */}
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-4 w-4 bg-muted rounded" />
                </div>
                <div className="h-7 w-32 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
          {/* Skeleton activity table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="h-4 w-36 bg-muted rounded animate-pulse" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 animate-pulse">
                <div className="h-4 w-4 bg-muted rounded-full" />
                <div className="h-3 w-48 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded ml-auto" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : !data ? (
        <SetupChecklist hasSales={false} />
      ) : !data.recentActivity.some((a: any) => a.type === "venta") ? (
        <SetupChecklist hasSales={false} />
      ) : (
        <>
          {/* Proactive alerts strip */}
          {data.kpis?.lowStockCount > 0 && !dismissedAlerts.includes("lowstock") && (
            <div className="flex items-center gap-3 py-2.5 px-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span className="flex-1">
                <strong>{data.kpis.lowStockCount}</strong>{" "}
                {data.kpis.lowStockCount === 1 ? "producto bajo stock mínimo" : "productos bajo stock mínimo"}.{" "}
                <button onClick={() => router.push("/mercaderia")} className="underline font-medium hover:text-amber-900">
                  Ver mercadería
                </button>
              </span>
              <button
                onClick={() => setDismissedAlerts((d) => [...d, "lowstock"])}
                className="text-amber-600 hover:text-amber-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Meta mensual de ventas */}
          {(preset === "this_month" || preset === "today") && (
            <div className="rounded-xl border border-border bg-card p-4">
              {salesGoal === 0 || editingGoal ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Meta de ventas del mes</p>
                    <input
                      type="number"
                      placeholder="Ej: 500000"
                      value={goalInputValue}
                      onChange={(e) => setGoalInputValue(e.target.value)}
                      className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = Number(goalInputValue);
                          if (val > 0) {
                            setSalesGoal(val);
                            localStorage.setItem("clubiSalesGoal", String(val));
                            setEditingGoal(false);
                            setGoalInputValue("");
                          }
                        }
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const val = Number(goalInputValue);
                      if (val > 0) {
                        setSalesGoal(val);
                        localStorage.setItem("clubiSalesGoal", String(val));
                        setEditingGoal(false);
                        setGoalInputValue("");
                      }
                    }}
                    className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">Meta del mes</p>
                      {data.kpis.totalVentas >= salesGoal && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium border border-green-200">
                          ¡Meta superada!
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { setEditingGoal(true); setGoalInputValue(String(salesGoal)); }}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline"
                    >
                      Editar meta
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-semibold text-foreground">{formatCurrency(data.kpis.totalVentas)}</span>
                    <span className="text-muted-foreground text-xs">de {formatCurrency(salesGoal)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((data.kpis.totalVentas / salesGoal) * 100, 100)}%`,
                        backgroundColor: data.kpis.totalVentas >= salesGoal ? "var(--success)" : "var(--primary)",
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {data.kpis.totalVentas >= salesGoal
                      ? `Superaste la meta por ${formatCurrency(data.kpis.totalVentas - salesGoal)}`
                      : `Falta ${formatCurrency(salesGoal - data.kpis.totalVentas)} para la meta (${((data.kpis.totalVentas / salesGoal) * 100).toFixed(0)}%)`
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* KPI Row 1 — Sales */}
          <div className="grid grid-cols-5 gap-3">
            <StatCard
              title="Ventas Totales"
              value={formatCurrency(data.kpis.totalVentas)}
              subtitle={`${data.kpis.countSales} transacciones`}
              icon={TrendingUp}
              variant="default"
              trend={(() => {
                if (preset !== "this_month" || !data.charts?.dailySales?.length) return undefined;
                const days = data.charts.dailySales.filter((d: any) => d.ventas > 0);
                if (days.length < 2) return undefined;
                const avg = days.reduce((s: number, d: any) => s + d.ventas, 0) / days.length;
                const today = new Date().toISOString().split("T")[0];
                const todayData = data.charts.dailySales.find((d: any) => d.date === today);
                if (!todayData || avg === 0) return undefined;
                const diffPct = ((todayData.ventas - avg) / avg) * 100;
                return { value: Math.abs(diffPct), isPositive: diffPct >= 0, label: "vs promedio" };
              })()}
            />
            <StatCard
              title="Contribución Marginal"
              value={formatCurrency(data.kpis.totalCM)}
              subtitle={`Margen: ${formatPct(data.kpis.margenCM)}`}
              icon={Percent}
              variant={marginVariant}
            />
            <StatCard
              title="Cobrado"
              value={formatCurrency(data.kpis.totalCobrado)}
              subtitle={`${formatPct(data.kpis.pctCobrado)} del total`}
              icon={CheckCircle2}
              variant="success"
            />
            <StatCard
              title="Pendiente de Cobro"
              value={formatCurrency(data.kpis.totalPendiente)}
              icon={Clock}
              variant="warning"
            />
            <StatCard
              title="Ticket Promedio"
              value={formatCurrency(data.kpis.ticketPromedio)}
              icon={Receipt}
              variant="default"
            />
          </div>

          {/* KPI Row 2 — Expenses + Result */}
          <div className="grid grid-cols-5 gap-3">
            <StatCard
              title="Egresos Totales"
              value={formatCurrency(data.kpis.totalEgresos)}
              icon={ArrowDownCircle}
              variant="danger"
            />
            <StatCard
              title="Costos Variables"
              value={formatCurrency(data.kpis.totalCV)}
              icon={Layers}
              variant="warning"
            />
            <StatCard
              title="Costos Fijos"
              value={formatCurrency(data.kpis.totalCF)}
              icon={Building2}
              variant="muted"
            />
            <StatCard
              title="Impuestos"
              value={formatCurrency(data.kpis.totalImpuestos)}
              icon={FileText}
              variant="muted"
            />
            <StatCard
              title="Utilidad (CM − CF)"
              value={formatCurrency(data.kpis.utilidad)}
              icon={Sparkles}
              variant={data.kpis.utilidad >= 0 ? "success" : "danger"}
            />
          </div>

          {/* Tendencia del período — mini chart */}
          {data.charts?.dailySales?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Tendencia del período</h3>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={data.charts.dailySales} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => {
                      const parts = d.split("-");
                      return `${parts[2]}/${parts[1]}`;
                    }}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [formatCurrency(Number(value)), "Ventas"]}
                    labelFormatter={(label: unknown) => {
                      const parts = String(label).split("-");
                      return `${parts[2]}/${parts[1]}`;
                    }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#trendGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Charts Row 1 */}
          <div className="grid grid-cols-3 gap-4">
            {/* Daily Sales Area Chart */}
            <div className="col-span-2 rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Ventas por Día
              </h3>
              {data.charts.dailySales.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={data.charts.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => {
                        const parts = d.split("-");
                        return `${parts[2]}/${parts[1]}`;
                      }}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatCurrencyShort(v)}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatCurrency(Number(value)),
                        name === "ventas" ? "Ventas" : "CM",
                      ]}
                      labelFormatter={(label: any) => {
                        const parts = String(label).split("-");
                        return `${parts[2]}/${parts[1]}/${parts[0]}`;
                      }}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ventas"
                      stroke="#3b82f6"
                      fill="#93c5fd"
                      fillOpacity={0.3}
                      name="ventas"
                    />
                    <Area
                      type="monotone"
                      dataKey="cm"
                      stroke="#22c55e"
                      fill="#86efac"
                      fillOpacity={0.3}
                      name="cm"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <BarChart3 className="w-8 h-8 opacity-30" />
                  <span className="text-sm">Sin ventas en el período</span>
                </div>
              )}
            </div>

            {/* Status Pie Chart */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Estado de Cobro
              </h3>
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        `${value} ventas`,
                        name,
                      ]}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      formatter={(value: string) => (
                        <span className="text-xs">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <BarChart3 className="w-8 h-8 opacity-30" />
                  <span className="text-sm">Sin ventas</span>
                </div>
              )}
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-3 gap-4">
            {/* Top Products Bar Chart */}
            <div className="col-span-2 rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Top 5 Productos <span className="text-muted-foreground font-normal">(por facturación)</span>
              </h3>
              {data.charts.topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.charts.topProducts}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatCurrencyShort(v)}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      width={75}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatCurrency(Number(value)),
                        name === "revenue" ? "Ventas" : "CM",
                      ]}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" name="revenue" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="cm" fill="#22c55e" name="cm" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <BarChart3 className="w-8 h-8 opacity-30" />
                  <span className="text-sm">Sin productos vendidos</span>
                </div>
              )}
            </div>

            {/* Expense by Type Pie Chart */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Egresos por Tipo
              </h3>
              {data.charts.expenseByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.charts.expenseByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {data.charts.expenseByType.map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatCurrency(Number(value)),
                        name,
                      ]}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      formatter={(value: string) => (
                        <span className="text-xs">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <BarChart3 className="w-8 h-8 opacity-30" />
                  <span className="text-sm">Sin egresos</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Recent Activity + Stock Alerts */}
          <div className="grid grid-cols-2 gap-4">
            {/* Recent Activity */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Actividad Reciente
              </h3>
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sin actividad reciente
                </p>
              ) : (
                <div className="space-y-2">
                  {data.recentActivity.map((item: any) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          variant={item.type === "venta" ? "default" : "destructive"}
                          className="text-xs shrink-0"
                        >
                          {item.type === "venta" ? "Venta" : "Compra"}
                        </Badge>
                        <span className="truncate max-w-[120px] text-foreground">
                          {item.concept}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatDateFull(item.date)}
                        </span>
                        <span className="font-mono font-semibold text-foreground">
                          {item.type === "venta" ? "+" : "−"}
                          {formatCurrency(item.amount)}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor:
                              item.status === "paid"
                                ? "var(--success-muted-foreground)"
                                : item.status === "overdue"
                                  ? "var(--danger-muted-foreground)"
                                  : item.status === "partial"
                                    ? "var(--info-muted-foreground)"
                                    : "var(--warning-muted-foreground)",
                            color:
                              item.status === "paid"
                                ? "var(--success-muted-foreground)"
                                : item.status === "overdue"
                                  ? "var(--danger-muted-foreground)"
                                  : item.status === "partial"
                                    ? "var(--info-muted-foreground)"
                                    : "var(--warning-muted-foreground)",
                          }}
                        >
                          {STATUS_LABELS[item.status] || item.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stock Alerts */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Alertas de Stock Bajo
                </h3>
                {data.lowStockProducts.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {data.lowStockProducts.length}
                  </Badge>
                )}
              </div>
              {data.lowStockProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Todos los productos tienen stock suficiente
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase text-muted-foreground">
                        Producto
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase text-muted-foreground">
                        Actual
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase text-muted-foreground">
                        Mínimo
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase text-muted-foreground">
                        Faltante
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lowStockProducts.map((p: any) => (
                      <TableRow key={p.id} className="text-sm hover:bg-muted/40">
                        <TableCell className="font-medium text-foreground">
                          {p.name}
                        </TableCell>
                        <TableCell
                          className="text-right font-mono"
                          style={{ color: "var(--danger-muted-foreground)" }}
                        >
                          {p.currentStock}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {p.minStock}
                        </TableCell>
                        <TableCell
                          className="text-right font-mono font-bold"
                          style={{ color: "var(--danger-muted-foreground)" }}
                        >
                          {p.minStock - p.currentStock}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
          {/* Cobros Pendientes */}
          {(() => {
            const pending = (data.recentActivity || []).filter(
              (a: any) => a.type === "venta" && a.cobro !== "Cobrada"
            );
            return (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Cobros Pendientes</h3>
                  </div>
                  {pending.length > 0 && (
                    <button
                      onClick={() => router.push("/ventas")}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Ver todos →
                    </button>
                  )}
                </div>
                {pending.length === 0 ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />
                    <span>Todo cobrado en este período</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs uppercase text-muted-foreground">Concepto</TableHead>
                          <TableHead className="text-xs uppercase text-muted-foreground">Fecha</TableHead>
                          <TableHead className="text-right text-xs uppercase text-muted-foreground">Total</TableHead>
                          <TableHead className="text-center text-xs uppercase text-muted-foreground">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pending.slice(0, 5).map((item: any, i: number) => (
                          <TableRow key={i} className="text-sm hover:bg-muted/40">
                            <TableCell className="font-medium text-foreground max-w-[160px] truncate">
                              {item.description}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {new Date(item.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(item.amount)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.cobro === "Parcial"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}>
                                {item.cobro}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
