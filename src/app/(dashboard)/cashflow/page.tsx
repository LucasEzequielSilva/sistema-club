"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const ACCOUNT_ID = "test-account-id";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function CashflowPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Week detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailWeek, setDetailWeek] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Projection form
  const [projSales, setProjSales] = useState("");
  const [projRate, setProjRate] = useState("");
  const [projNotes, setProjNotes] = useState("");
  const [projSaving, setProjSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await trpc.cashflow.getWeeklyProjection.query({
        accountId: ACCOUNT_ID,
        year,
        month,
      });
      setData(result);

      // Populate projection form
      if (result.projection) {
        setProjSales(result.projection.projectedSales?.toString() || "");
        setProjRate(result.projection.exchangeRate?.toString() || "");
        setProjNotes(result.projection.notes || "");
      } else {
        setProjSales("");
        setProjRate("");
        setProjNotes("");
      }
    } catch {
      toast.error("Error al cargar proyección");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const openWeekDetail = async (weekIndex: number) => {
    setDetailWeek(weekIndex);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const result = await trpc.cashflow.getWeekDetail.query({
        accountId: ACCOUNT_ID,
        year,
        month,
        weekIndex,
      });
      setDetailData(result);
    } catch {
      toast.error("Error al cargar detalle");
    } finally {
      setDetailLoading(false);
    }
  };

  const saveProjection = async () => {
    setProjSaving(true);
    try {
      await trpc.cashflow.upsertProjection.mutate({
        accountId: ACCOUNT_ID,
        year,
        month,
        projectedSales: projSales ? parseFloat(projSales) : null,
        exchangeRate: projRate ? parseFloat(projRate) : null,
        notes: projNotes || null,
      });
      toast.success("Proyección guardada");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setProjSaving(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  // Derived KPIs
  const realSales = data?.totals?.ingresos ?? 0;
  const projectedSalesNum = projSales ? parseFloat(projSales) : 0;
  const advancement = projectedSalesNum > 0 ? (realSales / projectedSalesNum) * 100 : 0;
  const exchangeRateNum = projRate ? parseFloat(projRate) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Cashflow Proyectado</h1>
        <p className="text-gray-500 mt-1">
          Proyección semanal de ingresos y egresos con saldo acumulado
        </p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          value={String(month)}
          onValueChange={(v) => setMonth(Number(v))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(year)}
          onValueChange={(v) => setYear(Number(v))}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Navigation */}
        <div className="flex gap-1 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (month === 0) {
                setMonth(11);
                setYear(year - 1);
              } else {
                setMonth(month - 1);
              }
            }}
          >
            &larr; Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const isCurrentMonth =
                month === now.getMonth() && year === now.getFullYear();
              if (!isCurrentMonth) {
                setMonth(now.getMonth());
                setYear(now.getFullYear());
              }
            }}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (month === 11) {
                setMonth(0);
                setYear(year + 1);
              } else {
                setMonth(month + 1);
              }
            }}
          >
            Siguiente &rarr;
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400">
          No hay datos disponibles
        </div>
      ) : (
        <>
          {/* ═══════════════════════════════════════ */}
          {/* SUMMARY CARDS                          */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-5 gap-3">
            <div className="border rounded-lg p-3">
              <p className="text-xs text-gray-500">Saldo Inicial</p>
              <p
                className={`text-lg font-bold ${
                  data.openingBalance >= 0
                    ? "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(data.openingBalance)}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-gray-500">Total Ingresos</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(data.totals.ingresos)}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-gray-500">Total Egresos</p>
              <p className="text-lg font-bold text-red-600">
                {formatCurrency(data.totals.egresos)}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-gray-500">Neto del Mes</p>
              <p
                className={`text-lg font-bold ${
                  data.totals.neto >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(data.totals.neto)}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-gray-500">Saldo Final Proyectado</p>
              <p
                className={`text-lg font-bold ${
                  data.closingBalance >= 0
                    ? "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(data.closingBalance)}
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* WEEKLY GRID                            */}
          {/* ═══════════════════════════════════════ */}
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b">
              <h3 className="font-semibold">
                Flujo Semanal — {MONTHS[month]} {year}
              </h3>
              <p className="text-xs text-gray-400">
                Click en una semana para ver detalle de movimientos
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10 min-w-[160px]">
                      Concepto
                    </TableHead>
                    {data.weeks.map((w: any) => (
                      <TableHead
                        key={w.weekIndex}
                        className="text-right min-w-[120px]"
                      >
                        {w.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right min-w-[120px] bg-slate-50 font-bold">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Saldo Inicial */}
                  <TableRow>
                    <TableCell className="font-medium text-blue-700 sticky left-0 bg-white">
                      Saldo Inicial
                    </TableCell>
                    {data.weeks.map((w: any, i: number) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm text-blue-600"
                      >
                        {formatCurrency(
                          i === 0
                            ? data.openingBalance
                            : data.runningBalances[i - 1]
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-sm bg-slate-50 text-blue-600">
                      {formatCurrency(data.openingBalance)}
                    </TableCell>
                  </TableRow>

                  {/* Ingresos Confirmados */}
                  <TableRow>
                    <TableCell className="text-green-600 sticky left-0 bg-white">
                      (+) Ingresos confirmados
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm text-green-600 cursor-pointer hover:bg-green-50"
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.ingresosConfirmed > 0
                          ? formatCurrency(w.ingresosConfirmed)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-sm bg-slate-50 text-green-600 font-medium">
                      {formatCurrency(
                        data.weeks.reduce(
                          (s: number, w: any) => s + w.ingresosConfirmed,
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Ingresos Pendientes (proyectados) */}
                  <TableRow>
                    <TableCell className="text-green-400 italic sticky left-0 bg-white">
                      (+) Ingresos pendientes
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm text-green-400 italic cursor-pointer hover:bg-green-50"
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.ingresosPending > 0
                          ? formatCurrency(w.ingresosPending)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-sm bg-slate-50 text-green-400 italic">
                      {formatCurrency(
                        data.weeks.reduce(
                          (s: number, w: any) => s + w.ingresosPending,
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Total Ingresos */}
                  <TableRow className="bg-green-50">
                    <TableCell className="font-semibold text-green-700 sticky left-0 bg-green-50">
                      = Total Ingresos
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm font-medium text-green-700"
                      >
                        {w.totalIngresos > 0
                          ? formatCurrency(w.totalIngresos)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono font-bold bg-green-100 text-green-700">
                      {formatCurrency(data.totals.ingresos)}
                    </TableCell>
                  </TableRow>

                  {/* Egresos Confirmados */}
                  <TableRow>
                    <TableCell className="text-red-600 sticky left-0 bg-white">
                      (-) Egresos confirmados
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm text-red-600 cursor-pointer hover:bg-red-50"
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.egresoConfirmed > 0
                          ? formatCurrency(w.egresoConfirmed)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-sm bg-slate-50 text-red-600 font-medium">
                      {formatCurrency(
                        data.weeks.reduce(
                          (s: number, w: any) => s + w.egresoConfirmed,
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Egresos Pendientes (proyectados) */}
                  <TableRow>
                    <TableCell className="text-red-400 italic sticky left-0 bg-white">
                      (-) Egresos pendientes
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm text-red-400 italic cursor-pointer hover:bg-red-50"
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.egresosPending > 0
                          ? formatCurrency(w.egresosPending)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-sm bg-slate-50 text-red-400 italic">
                      {formatCurrency(
                        data.weeks.reduce(
                          (s: number, w: any) => s + w.egresosPending,
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Total Egresos */}
                  <TableRow className="bg-red-50">
                    <TableCell className="font-semibold text-red-700 sticky left-0 bg-red-50">
                      = Total Egresos
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm font-medium text-red-700"
                      >
                        {w.totalEgresos > 0
                          ? formatCurrency(w.totalEgresos)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono font-bold bg-red-100 text-red-700">
                      {formatCurrency(data.totals.egresos)}
                    </TableCell>
                  </TableRow>

                  {/* Neto */}
                  <TableRow className="bg-blue-50 border-t-2">
                    <TableCell className="font-bold text-blue-700 sticky left-0 bg-blue-50">
                      = Neto Semanal
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className={`text-right font-mono text-sm font-bold ${
                          w.neto >= 0 ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {w.neto !== 0 ? formatCurrency(w.neto) : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell
                      className={`text-right font-mono font-bold bg-blue-100 ${
                        data.totals.neto >= 0
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(data.totals.neto)}
                    </TableCell>
                  </TableRow>

                  {/* Saldo Final (running balance) */}
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold sticky left-0 bg-white">
                      Saldo Final
                    </TableCell>
                    {data.weeks.map((w: any, i: number) => (
                      <TableCell
                        key={w.weekIndex}
                        className={`text-right font-mono text-sm font-bold ${
                          data.runningBalances[i] >= 0
                            ? "text-blue-700"
                            : "text-red-600"
                        }`}
                      >
                        {formatCurrency(data.runningBalances[i])}
                      </TableCell>
                    ))}
                    <TableCell
                      className={`text-right font-mono font-bold bg-slate-50 ${
                        data.closingBalance >= 0
                          ? "text-blue-700"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(data.closingBalance)}
                    </TableCell>
                  </TableRow>

                  {/* Items count per week */}
                  <TableRow>
                    <TableCell className="text-gray-400 text-xs sticky left-0 bg-white">
                      Movimientos
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right text-xs text-gray-400 cursor-pointer hover:text-blue-600"
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.items.length > 0
                          ? `${w.items.length} items`
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-xs text-gray-400 bg-slate-50">
                      {data.totals.itemCount} total
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* PROJECTION & KPIs                      */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-2 gap-6">
            {/* Manual Projection Form */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">
                Proyección Manual — {MONTHS[month]} {year}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="projSales">Ventas proyectadas ($)</Label>
                    <Input
                      id="projSales"
                      type="number"
                      step="1"
                      value={projSales}
                      onChange={(e) => setProjSales(e.target.value)}
                      placeholder="Ej: 500000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="projRate">Tipo de cambio (USD)</Label>
                    <Input
                      id="projRate"
                      type="number"
                      step="0.01"
                      value={projRate}
                      onChange={(e) => setProjRate(e.target.value)}
                      placeholder="Ej: 1050"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="projNotes">Notas</Label>
                  <textarea
                    id="projNotes"
                    value={projNotes}
                    onChange={(e) => setProjNotes(e.target.value)}
                    placeholder="Observaciones sobre la proyección..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
                <Button
                  onClick={saveProjection}
                  disabled={projSaving}
                  size="sm"
                >
                  {projSaving ? "Guardando..." : "Guardar Proyección"}
                </Button>
              </div>
            </div>

            {/* KPIs derived */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Indicadores del Mes</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ingresos reales</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(realSales)}
                  </span>
                </div>
                {projectedSalesNum > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        Ventas proyectadas
                      </span>
                      <span className="font-mono font-medium">
                        {formatCurrency(projectedSalesNum)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Grado de avance</span>
                      <span
                        className={`font-mono font-bold ${
                          advancement >= 100
                            ? "text-green-600"
                            : advancement >= 70
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {advancement.toFixed(1)}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          advancement >= 100
                            ? "bg-green-500"
                            : advancement >= 70
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.min(advancement, 100)}%`,
                        }}
                      />
                    </div>
                  </>
                )}
                {exchangeRateNum > 0 && (
                  <>
                    <div className="flex justify-between text-sm mt-3 pt-3 border-t">
                      <span className="text-gray-500">
                        Tipo de cambio
                      </span>
                      <span className="font-mono font-medium">
                        ${exchangeRateNum.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        Neto en USD
                      </span>
                      <span className="font-mono font-medium">
                        USD{" "}
                        {(data.totals.neto / exchangeRateNum).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        Saldo final en USD
                      </span>
                      <span className="font-mono font-medium">
                        USD{" "}
                        {(data.closingBalance / exchangeRateNum).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm mt-3 pt-3 border-t">
                  <span className="text-gray-500">Total movimientos</span>
                  <span className="font-mono">{data.totals.itemCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Semanas</span>
                  <span className="font-mono">{data.weekCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* LEGEND                                 */}
          {/* ═══════════════════════════════════════ */}
          <div className="flex gap-4 text-xs text-gray-500 border rounded-lg p-3">
            <span>
              <span className="inline-block w-3 h-3 rounded bg-green-600 mr-1" />
              Confirmado (cobros/pagos registrados)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-green-300 mr-1" />
              Pendiente (por cobrar/pagar, proyectado)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-blue-600 mr-1" />
              Saldo acumulado
            </span>
            <span className="ml-auto italic">
              Click en valores para ver detalle semanal
            </span>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* WEEK DETAIL DIALOG                     */}
      {/* ═══════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalle — {detailData?.label} ({MONTHS[month]} {year})
            </DialogTitle>
            <DialogDescription>
              Días {detailData?.dateRange} | {detailData?.items?.length || 0}{" "}
              movimientos
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-8 text-center text-gray-400">Cargando...</div>
          ) : !detailData || detailData.items.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              Sin movimientos en esta semana
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded p-2">
                  <p className="text-xs text-gray-500">Ingresos</p>
                  <p className="font-bold text-green-600">
                    {formatCurrency(detailData.totals.ingresos)}
                  </p>
                </div>
                <div className="border rounded p-2">
                  <p className="text-xs text-gray-500">Egresos</p>
                  <p className="font-bold text-red-600">
                    {formatCurrency(detailData.totals.egresos)}
                  </p>
                </div>
              </div>

              {/* Items table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.items.map((item: any) => (
                    <TableRow
                      key={item.id}
                      className={item.isPending ? "opacity-60 italic" : ""}
                    >
                      <TableCell className="text-sm">
                        {formatDate(item.date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.direction === "ingreso"
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {item.direction === "ingreso"
                            ? "Ingreso"
                            : "Egreso"}
                        </Badge>
                        {item.isPending && (
                          <Badge
                            variant="outline"
                            className="text-xs ml-1 border-amber-300 text-amber-600"
                          >
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {item.concept}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-[150px] truncate">
                        {item.detail}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          item.direction === "ingreso"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {item.direction === "ingreso" ? "+" : "-"}
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
