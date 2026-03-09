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
import { Waves, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { useAccountId } from "@/hooks/use-account-id";

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
  const { accountId } = useAccountId();
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
    if (!accountId) return;
    setLoading(true);
    try {
      const result = await trpc.cashflow.getWeeklyProjection.query({
        accountId,
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
  }, [year, month, accountId]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const openWeekDetail = async (weekIndex: number) => {
    if (!accountId) return;
    setDetailWeek(weekIndex);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const result = await trpc.cashflow.getWeekDetail.query({
        accountId,
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
    if (!accountId) return;
    setProjSaving(true);
    try {
      await trpc.cashflow.upsertProjection.mutate({
        accountId,
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

  const monthNavActions = (
    <div className="flex items-center gap-2">
      <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
        <SelectTrigger className="w-[130px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => (
            <SelectItem key={i} value={String(i)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
        <SelectTrigger className="w-[95px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            if (month === 0) { setMonth(11); setYear(year - 1); }
            else setMonth(month - 1);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3"
          onClick={() => {
            const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
            if (!isCurrentMonth) { setMonth(now.getMonth()); setYear(now.getFullYear()); }
          }}
        >
          Hoy
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            if (month === 11) { setMonth(0); setYear(year + 1); }
            else setMonth(month + 1);
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Cashflow"
        description="Proyección semanal de caja y KPIs"
        icon={Waves}
        actions={monthNavActions}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : !data ? (
        <div className="text-center py-16 text-muted-foreground">
          No hay datos disponibles
        </div>
      ) : (
        <>
          {/* ═══════════════════════════════════════ */}
          {/* SUMMARY CARDS                          */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-5 gap-3">
            <StatCard
              title="Saldo Inicial"
              value={formatCurrency(data.openingBalance)}
              variant="default"
            />
            <StatCard
              title="Total Ingresos"
              value={formatCurrency(data.totals.ingresos)}
              variant="success"
            />
            <StatCard
              title="Total Egresos"
              value={formatCurrency(data.totals.egresos)}
              variant="danger"
            />
            <StatCard
              title="Neto del Mes"
              value={formatCurrency(data.totals.neto)}
              variant={data.totals.neto >= 0 ? "success" : "danger"}
            />
            <StatCard
              title="Saldo Final Proyectado"
              value={formatCurrency(data.closingBalance)}
              variant={data.closingBalance >= 0 ? "success" : "danger"}
            />
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* WEEKLY GRID                            */}
          {/* ═══════════════════════════════════════ */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 bg-muted/30 border-b border-border">
              <h3 className="font-semibold text-foreground">
                Flujo Semanal — {MONTHS[month]} {year}
              </h3>
              <p className="text-xs text-muted-foreground">
                Click en una semana para ver detalle de movimientos
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[160px] text-xs uppercase text-muted-foreground">
                      Concepto
                    </TableHead>
                    {data.weeks.map((w: any) => (
                      <TableHead
                        key={w.weekIndex}
                        className="text-right min-w-[120px] text-xs uppercase text-muted-foreground"
                      >
                        {w.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right min-w-[120px] bg-muted/30 font-bold text-xs uppercase text-muted-foreground">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Saldo Inicial */}
                  <TableRow className="hover:bg-muted/40">
                    <TableCell
                      className="font-medium sticky left-0 bg-card"
                      style={{ color: "var(--info-muted-foreground)" }}
                    >
                      Saldo Inicial
                    </TableCell>
                    {data.weeks.map((w: any, i: number) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm"
                        style={{ color: "var(--info-muted-foreground)" }}
                      >
                        {formatCurrency(
                          i === 0
                            ? data.openingBalance
                            : data.runningBalances[i - 1]
                        )}
                      </TableCell>
                    ))}
                    <TableCell
                      className="text-right font-mono text-sm bg-muted/30"
                      style={{ color: "var(--info-muted-foreground)" }}
                    >
                      {formatCurrency(data.openingBalance)}
                    </TableCell>
                  </TableRow>

                  {/* Ingresos Confirmados */}
                  <TableRow className="hover:bg-muted/40">
                    <TableCell
                      className="sticky left-0 bg-card"
                      style={{ color: "var(--success-muted-foreground)" }}
                    >
                      (+) Ingresos confirmados
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm cursor-pointer hover:bg-muted/60"
                        style={{ color: "var(--success-muted-foreground)" }}
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.ingresosConfirmed > 0
                          ? formatCurrency(w.ingresosConfirmed)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell
                      className="text-right font-mono text-sm bg-muted/30 font-medium"
                      style={{ color: "var(--success-muted-foreground)" }}
                    >
                      {formatCurrency(
                        data.weeks.reduce(
                          (s: number, w: any) => s + w.ingresosConfirmed,
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Ingresos Pendientes (proyectados) */}
                  <TableRow className="hover:bg-muted/40">
                    <TableCell className="text-muted-foreground italic sticky left-0 bg-card">
                      (+) Ingresos pendientes
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm text-muted-foreground italic cursor-pointer hover:bg-muted/60"
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.ingresosPending > 0
                          ? formatCurrency(w.ingresosPending)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-sm bg-muted/30 text-muted-foreground italic">
                      {formatCurrency(
                        data.weeks.reduce(
                          (s: number, w: any) => s + w.ingresosPending,
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Total Ingresos */}
                  <TableRow style={{ backgroundColor: "var(--success-muted)" }}>
                    <TableCell
                      className="font-semibold sticky left-0"
                      style={{ backgroundColor: "var(--success-muted)", color: "var(--success-muted-foreground)" }}
                    >
                      = Total Ingresos
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm font-medium"
                        style={{ color: "var(--success-muted-foreground)" }}
                      >
                        {w.totalIngresos > 0
                          ? formatCurrency(w.totalIngresos)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell
                      className="text-right font-mono font-bold"
                      style={{ color: "var(--success-muted-foreground)" }}
                    >
                      {formatCurrency(data.totals.ingresos)}
                    </TableCell>
                  </TableRow>

                  {/* Egresos Confirmados */}
                  <TableRow className="hover:bg-muted/40">
                    <TableCell
                      className="sticky left-0 bg-card"
                      style={{ color: "var(--danger-muted-foreground)" }}
                    >
                      (-) Egresos confirmados
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm cursor-pointer hover:bg-muted/60"
                        style={{ color: "var(--danger-muted-foreground)" }}
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.egresoConfirmed > 0
                          ? formatCurrency(w.egresoConfirmed)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell
                      className="text-right font-mono text-sm bg-muted/30 font-medium"
                      style={{ color: "var(--danger-muted-foreground)" }}
                    >
                      {formatCurrency(
                        data.weeks.reduce(
                          (s: number, w: any) => s + w.egresoConfirmed,
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Egresos Pendientes (proyectados) */}
                  <TableRow className="hover:bg-muted/40">
                    <TableCell className="text-muted-foreground italic sticky left-0 bg-card">
                      (-) Egresos pendientes
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm text-muted-foreground italic cursor-pointer hover:bg-muted/60"
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.egresosPending > 0
                          ? formatCurrency(w.egresosPending)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-sm bg-muted/30 text-muted-foreground italic">
                      {formatCurrency(
                        data.weeks.reduce(
                          (s: number, w: any) => s + w.egresosPending,
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Total Egresos */}
                  <TableRow style={{ backgroundColor: "var(--danger-muted)" }}>
                    <TableCell
                      className="font-semibold sticky left-0"
                      style={{ backgroundColor: "var(--danger-muted)", color: "var(--danger-muted-foreground)" }}
                    >
                      = Total Egresos
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm font-medium"
                        style={{ color: "var(--danger-muted-foreground)" }}
                      >
                        {w.totalEgresos > 0
                          ? formatCurrency(w.totalEgresos)
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell
                      className="text-right font-mono font-bold"
                      style={{ color: "var(--danger-muted-foreground)" }}
                    >
                      {formatCurrency(data.totals.egresos)}
                    </TableCell>
                  </TableRow>

                  {/* Neto */}
                  <TableRow className="border-t-2" style={{ backgroundColor: "var(--info-muted)" }}>
                    <TableCell
                      className="font-bold sticky left-0"
                      style={{ backgroundColor: "var(--info-muted)", color: "var(--info-muted-foreground)" }}
                    >
                      = Neto Semanal
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm font-bold"
                        style={{
                          color: w.neto >= 0
                            ? "var(--success-muted-foreground)"
                            : "var(--danger-muted-foreground)",
                        }}
                      >
                        {w.neto !== 0 ? formatCurrency(w.neto) : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell
                      className="text-right font-mono font-bold"
                      style={{
                        color: data.totals.neto >= 0
                          ? "var(--success-muted-foreground)"
                          : "var(--danger-muted-foreground)",
                      }}
                    >
                      {formatCurrency(data.totals.neto)}
                    </TableCell>
                  </TableRow>

                  {/* Saldo Final (running balance) */}
                  <TableRow className="border-t-2 hover:bg-muted/40">
                    <TableCell className="font-bold sticky left-0 bg-card">
                      Saldo Final
                    </TableCell>
                    {data.weeks.map((w: any, i: number) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right font-mono text-sm font-bold"
                        style={{
                          color: data.runningBalances[i] >= 0
                            ? "var(--info-muted-foreground)"
                            : "var(--danger-muted-foreground)",
                        }}
                      >
                        {formatCurrency(data.runningBalances[i])}
                      </TableCell>
                    ))}
                    <TableCell
                      className="text-right font-mono font-bold bg-muted/30"
                      style={{
                        color: data.closingBalance >= 0
                          ? "var(--info-muted-foreground)"
                          : "var(--danger-muted-foreground)",
                      }}
                    >
                      {formatCurrency(data.closingBalance)}
                    </TableCell>
                  </TableRow>

                  {/* Items count per week */}
                  <TableRow className="hover:bg-muted/40">
                    <TableCell className="text-muted-foreground text-xs sticky left-0 bg-card">
                      Movimientos
                    </TableCell>
                    {data.weeks.map((w: any) => (
                      <TableCell
                        key={w.weekIndex}
                        className="text-right text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => openWeekDetail(w.weekIndex)}
                      >
                        {w.items.length > 0
                          ? `${w.items.length} items`
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-xs text-muted-foreground bg-muted/30">
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
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-4 text-foreground">
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
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-4 text-foreground">Indicadores del Mes</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ingresos reales</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(realSales)}
                  </span>
                </div>
                {projectedSalesNum > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Ventas proyectadas
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatCurrency(projectedSalesNum)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Grado de avance</span>
                      <span
                        className="font-mono font-bold"
                        style={{
                          color: advancement >= 100
                            ? "var(--success-muted-foreground)"
                            : advancement >= 70
                              ? "var(--warning-muted-foreground)"
                              : "var(--danger-muted-foreground)",
                        }}
                      >
                        {advancement.toFixed(1)}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(advancement, 100)}%`,
                          backgroundColor: advancement >= 100
                            ? "var(--success-muted-foreground)"
                            : advancement >= 70
                              ? "var(--warning-muted-foreground)"
                              : "var(--danger-muted-foreground)",
                        }}
                      />
                    </div>
                  </>
                )}
                {exchangeRateNum > 0 && (
                  <>
                    <div className="flex justify-between text-sm mt-3 pt-3 border-t border-border">
                      <span className="text-muted-foreground">
                        Tipo de cambio
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        ${exchangeRateNum.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Neto en USD
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        USD{" "}
                        {(data.totals.neto / exchangeRateNum).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Saldo final en USD
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        USD{" "}
                        {(data.closingBalance / exchangeRateNum).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm mt-3 pt-3 border-t border-border">
                  <span className="text-muted-foreground">Total movimientos</span>
                  <span className="font-mono">{data.totals.itemCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Semanas</span>
                  <span className="font-mono">{data.weekCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* LEGEND                                 */}
          {/* ═══════════════════════════════════════ */}
          <div className="flex gap-4 text-xs text-muted-foreground border border-border rounded-lg p-3 bg-muted/30">
            <span>
              <span
                className="inline-block w-3 h-3 rounded mr-1"
                style={{ backgroundColor: "var(--success-muted-foreground)" }}
              />
              Confirmado (cobros/pagos registrados)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded bg-muted-foreground/40 mr-1" />
              Pendiente (por cobrar/pagar, proyectado)
            </span>
            <span>
              <span
                className="inline-block w-3 h-3 rounded mr-1"
                style={{ backgroundColor: "var(--info-muted-foreground)" }}
              />
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
            <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : !detailData || detailData.items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Sin movimientos en esta semana
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Ingresos</p>
                  <p
                    className="font-bold"
                    style={{ color: "var(--success-muted-foreground)" }}
                  >
                    {formatCurrency(detailData.totals.ingresos)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Egresos</p>
                  <p
                    className="font-bold"
                    style={{ color: "var(--danger-muted-foreground)" }}
                  >
                    {formatCurrency(detailData.totals.egresos)}
                  </p>
                </div>
              </div>

              {/* Items table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase text-muted-foreground">Fecha</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Tipo</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Concepto</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Detalle</TableHead>
                    <TableHead className="text-right text-xs uppercase text-muted-foreground">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.items.map((item: any) => (
                    <TableRow
                      key={item.id}
                      className={`hover:bg-muted/40 ${item.isPending ? "opacity-60 italic" : ""}`}
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
                            className="text-xs ml-1"
                            style={{
                              borderColor: "var(--warning-muted-foreground)",
                              color: "var(--warning-muted-foreground)",
                            }}
                          >
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {item.concept}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {item.detail}
                      </TableCell>
                      <TableCell
                        className="text-right font-mono font-semibold text-foreground"
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
