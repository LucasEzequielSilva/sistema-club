"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ACCOUNT_ID = "test-account-id";

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

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatDateFull(d: Date | string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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

type PeriodPreset = "this_month" | "last_month" | "quarter" | "year";

export default function TableroPage() {
  const now = new Date();
  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const getDateRange = useCallback(
    (p: PeriodPreset) => {
      const today = new Date();
      switch (p) {
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
    },
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const range = getDateRange(preset);
      const result = await trpc.tablero.getDashboard.query({
        accountId: ACCOUNT_ID,
        dateFrom: range.from,
        dateTo: range.to,
      });
      setData(result);
    } catch {
      toast.error("Error al cargar dashboard");
    } finally {
      setLoading(false);
    }
  }, [preset, getDateRange]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const PRESETS: { id: PeriodPreset; label: string }[] = [
    { id: "this_month", label: "Este Mes" },
    { id: "last_month", label: "Mes Anterior" },
    { id: "quarter", label: "Trimestre" },
    { id: "year", label: "Año" },
  ];

  // Status pie data
  const statusPieData = data
    ? Object.entries(data.charts.statusCounts)
        .filter(([, v]) => (v as number) > 0)
        .map(([key, value]) => ({
          name: STATUS_LABELS[key] || key,
          value: value as number,
          color: STATUS_COLORS[key] || "#94a3b8",
        }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tablero</h1>
          <p className="text-gray-500 mt-1">
            Vista general del negocio
          </p>
        </div>

        {/* Period presets */}
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              variant={preset === p.id ? "default" : "outline"}
              size="sm"
              onClick={() => setPreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400">Sin datos</div>
      ) : (
        <>
          {/* ═══════════════════════════════════════ */}
          {/* KPI CARDS — Row 1 (Sales)              */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-5 gap-3">
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Ventas Totales</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data.kpis.totalVentas)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.kpis.countSales} transacciones
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Contribución Marginal</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(data.kpis.totalCM)}
              </p>
              <p
                className={`text-xs mt-1 font-medium ${
                  data.kpis.margenCM >= 30
                    ? "text-green-600"
                    : data.kpis.margenCM >= 20
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                Margen: {formatPct(data.kpis.margenCM)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Cobrado</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.kpis.totalCobrado)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {formatPct(data.kpis.pctCobrado)} del total
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Pendiente de Cobro</p>
              <p
                className={`text-2xl font-bold ${
                  data.kpis.totalPendiente > 0
                    ? "text-amber-600"
                    : "text-green-600"
                }`}
              >
                {formatCurrency(data.kpis.totalPendiente)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Ticket Promedio</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data.kpis.ticketPromedio)}
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* KPI CARDS — Row 2 (Expenses + Result)  */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-5 gap-3">
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Egresos Totales</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(data.kpis.totalEgresos)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Costos Variables</p>
              <p className="text-lg font-bold text-red-500">
                {formatCurrency(data.kpis.totalCV)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Costos Fijos</p>
              <p className="text-lg font-bold text-orange-500">
                {formatCurrency(data.kpis.totalCF)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Impuestos</p>
              <p className="text-lg font-bold text-purple-500">
                {formatCurrency(data.kpis.totalImpuestos)}
              </p>
            </div>
            <div
              className={`border rounded-lg p-4 ${
                data.kpis.utilidad >= 0
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p className="text-xs text-gray-500">Utilidad (CM - CF)</p>
              <p
                className={`text-2xl font-bold ${
                  data.kpis.utilidad >= 0
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {formatCurrency(data.kpis.utilidad)}
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* CHARTS ROW 1                           */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-3 gap-4">
            {/* Daily Sales Area Chart */}
            <div className="col-span-2 border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Ventas por Día</h3>
              {data.charts.dailySales.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={data.charts.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => {
                        const parts = d.split("-");
                        return `${parts[2]}/${parts[1]}`;
                      }}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatCurrencyShort(v)}
                      tick={{ fontSize: 11 }}
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
                <div className="h-[250px] flex items-center justify-center text-gray-400">
                  Sin ventas en el período
                </div>
              )}
            </div>

            {/* Status Pie Chart */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Estado de Cobro</h3>
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
                    />
                    <Legend
                      formatter={(value: string) => (
                        <span className="text-xs">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-400">
                  Sin ventas
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* CHARTS ROW 2                           */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-3 gap-4">
            {/* Top Products Bar Chart */}
            <div className="col-span-2 border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Top 5 Productos (por facturación)</h3>
              {data.charts.topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.charts.topProducts}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatCurrencyShort(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={75}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatCurrency(Number(value)),
                        name === "revenue" ? "Ventas" : "CM",
                      ]}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" name="revenue" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="cm" fill="#22c55e" name="cm" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400">
                  Sin productos vendidos
                </div>
              )}
            </div>

            {/* Expense by Type Pie Chart */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Egresos por Tipo</h3>
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
                    />
                    <Legend
                      formatter={(value: string) => (
                        <span className="text-xs">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400">
                  Sin egresos
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* BOTTOM ROW: Recent + Alerts            */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-2 gap-4">
            {/* Recent Activity */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Actividad Reciente</h3>
              {data.recentActivity.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  Sin actividad reciente
                </p>
              ) : (
                <div className="space-y-2">
                  {data.recentActivity.map((item: any) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            item.type === "venta" ? "default" : "destructive"
                          }
                          className="text-xs"
                        >
                          {item.type === "venta" ? "Venta" : "Compra"}
                        </Badge>
                        <span className="truncate max-w-[120px]">
                          {item.concept}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">
                          {formatDateFull(item.date)}
                        </span>
                        <span
                          className={`font-mono font-medium ${
                            item.type === "venta"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {item.type === "venta" ? "+" : "-"}
                          {formatCurrency(item.amount)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            item.status === "paid"
                              ? "border-green-300 text-green-700"
                              : item.status === "overdue"
                                ? "border-red-300 text-red-700"
                                : item.status === "partial"
                                  ? "border-blue-300 text-blue-700"
                                  : "border-amber-300 text-amber-700"
                          }`}
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
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">
                Alertas de Stock Bajo
                {data.lowStockProducts.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-2 text-xs"
                  >
                    {data.lowStockProducts.length}
                  </Badge>
                )}
              </h3>
              {data.lowStockProducts.length === 0 ? (
                <p className="text-green-600 text-sm text-center py-4">
                  Todos los productos tienen stock suficiente
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Faltante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lowStockProducts.map((p: any) => (
                      <TableRow key={p.id} className="text-sm">
                        <TableCell className="font-medium">
                          {p.name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {p.currentStock}
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-500">
                          {p.minStock}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600 font-bold">
                          {p.minStock - p.currentStock}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
