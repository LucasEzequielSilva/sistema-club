"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Target, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";

const ACCOUNT_ID = "test-account-id";

function formatCurrency(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatUSD(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(1) + "%";
}

function formatVariation(
  value: number | null | undefined,
  unit: string
) {
  if (value === null || value === undefined) return "—";
  const sign = value >= 0 ? "+" : "";
  if (unit === "$") return `${sign}${formatCurrency(value)}`;
  if (unit === "%") return `${sign}${value.toFixed(1)}pp`;
  if (unit === "USD") return `${sign}${formatUSD(value)}`;
  return `${sign}${value}`;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function CuadroResumenPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Editable projection fields
  const [projSales, setProjSales] = useState("");
  const [projRate, setProjRate] = useState("");
  const [projNotes, setProjNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await trpc.cuadroResumen.getScorecard.query({
        accountId: ACCOUNT_ID,
        year,
        month,
      });
      setData(result);

      // Populate form
      setProjSales(result.projection.projectedSales?.toString() || "");
      setProjRate(result.projection.exchangeRate?.toString() || "");
      setProjNotes(result.projection.notes || "");
    } catch {
      toast.error("Error al cargar cuadro resumen");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const saveProjection = async () => {
    setSaving(true);
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
      loadData(); // Reload to recalculate
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  // Format value based on unit
  function formatValue(value: number | null | undefined, unit: string) {
    if (unit === "$") return formatCurrency(value);
    if (unit === "%") return formatPct(value);
    if (unit === "USD") return formatUSD(value);
    return value?.toString() ?? "—";
  }

  // Variation color via CSS var
  function variationStyle(value: number | null | undefined): React.CSSProperties {
    if (value === null || value === undefined) return { color: "var(--muted-foreground)" };
    return {
      color: value >= 0 ? "var(--success-muted-foreground)" : "var(--danger-muted-foreground)",
    };
  }

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
          onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }}
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
        title="Cuadro KPIs"
        description="Proyectado vs real del mes"
        icon={Target}
        actions={monthNavActions}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : !data ? (
        <div className="text-center py-16 text-muted-foreground">Sin datos</div>
      ) : (
        <>
          {/* ═══════════════════════════════════════ */}
          {/* ADVANCEMENT BAR                        */}
          {/* ═══════════════════════════════════════ */}
          {data.kpis.advancement !== null && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-foreground">Grado de Avance</h3>
                <span
                  className="text-2xl font-bold"
                  style={{
                    color: data.kpis.advancement >= 100
                      ? "var(--success-muted-foreground)"
                      : data.kpis.advancement >= 70
                        ? "var(--warning-muted-foreground)"
                        : "var(--danger-muted-foreground)",
                  }}
                >
                  {data.kpis.advancement.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-4">
                <div
                  className="h-4 rounded-full transition-all"
                  style={{
                    width: `${Math.min(data.kpis.advancement, 100)}%`,
                    backgroundColor: data.kpis.advancement >= 100
                      ? "var(--success-muted-foreground)"
                      : data.kpis.advancement >= 70
                        ? "var(--warning-muted-foreground)"
                        : "var(--danger-muted-foreground)",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {formatCurrency(data.scorecard.ventas.real)} de{" "}
                {formatCurrency(data.scorecard.ventas.projected)} proyectados
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* MAIN SCORECARD TABLE (BR #13)          */}
          {/* ═══════════════════════════════════════ */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 bg-muted/30 border-b border-border">
              <h3 className="font-semibold text-foreground">
                Cuadro de Resultados — {MONTHS[month]} {year}
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px] text-xs uppercase text-muted-foreground">Concepto</TableHead>
                  <TableHead className="text-right min-w-[140px] text-xs uppercase text-muted-foreground">
                    Proyectado
                  </TableHead>
                  <TableHead className="text-right min-w-[140px] text-xs uppercase text-muted-foreground">
                    Real
                  </TableHead>
                  <TableHead className="text-right min-w-[140px] text-xs uppercase text-muted-foreground">
                    Variación
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Ventas */}
                <TableRow className="hover:bg-muted/40">
                  <TableCell className="font-medium">Ventas</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatValue(data.scorecard.ventas.projected, "$")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-foreground">
                    {formatValue(data.scorecard.ventas.real, "$")}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono font-medium"
                    style={variationStyle(data.scorecard.ventas.variation)}
                  >
                    {data.scorecard.ventas.variation !== null
                      ? `${data.scorecard.ventas.variation >= 0 ? "+" : ""}${data.scorecard.ventas.variation.toFixed(1)}%`
                      : "—"}
                  </TableCell>
                </TableRow>

                {/* Rentabilidad */}
                <TableRow className="hover:bg-muted/40">
                  <TableCell className="font-medium">
                    Rentabilidad (CM%)
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatValue(data.scorecard.rentabilidad.projected, "%")}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono font-semibold"
                    style={{
                      color: data.scorecard.rentabilidad.real >= 30
                        ? "var(--success-muted-foreground)"
                        : data.scorecard.rentabilidad.real >= 20
                          ? "var(--warning-muted-foreground)"
                          : "var(--danger-muted-foreground)",
                    }}
                  >
                    {formatValue(data.scorecard.rentabilidad.real, "%")}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono font-medium"
                    style={variationStyle(data.scorecard.rentabilidad.variation)}
                  >
                    {formatVariation(data.scorecard.rentabilidad.variation, "%")}
                  </TableCell>
                </TableRow>

                {/* Utilidad */}
                <TableRow className="bg-muted/30 hover:bg-muted/50">
                  <TableCell className="font-bold">
                    Utilidad (CM - CF)
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatValue(data.scorecard.utilidad.projected, "$")}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono font-bold"
                    style={{
                      color: data.scorecard.utilidad.real >= 0
                        ? "var(--success-muted-foreground)"
                        : "var(--danger-muted-foreground)",
                    }}
                  >
                    {formatValue(data.scorecard.utilidad.real, "$")}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono font-medium"
                    style={variationStyle(data.scorecard.utilidad.variation)}
                  >
                    {formatVariation(data.scorecard.utilidad.variation, "$")}
                  </TableCell>
                </TableRow>

                {/* Utilidad USD */}
                <TableRow className="hover:bg-muted/40">
                  <TableCell className="font-medium text-muted-foreground">
                    Utilidad en USD
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatValue(data.scorecard.utilidadUSD.projected, "USD")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-foreground">
                    {formatValue(data.scorecard.utilidadUSD.real, "USD")}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono font-medium"
                    style={variationStyle(data.scorecard.utilidadUSD.variation)}
                  >
                    {formatVariation(data.scorecard.utilidadUSD.variation, "USD")}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* ADDITIONAL KPIs (BR #13 bottom)        */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-5 gap-3">
            <StatCard
              title="Ticket Promedio"
              value={formatCurrency(data.kpis.ticketPromedio)}
              variant="default"
            />
            <StatCard
              title="CM Promedio"
              value={formatPct(data.kpis.cmPromedio)}
              variant={
                data.kpis.cmPromedio >= 30
                  ? "success"
                  : data.kpis.cmPromedio >= 20
                    ? "warning"
                    : "danger"
              }
            />
            <StatCard
              title="Cantidad Ventas"
              value={String(data.kpis.cantidadVentas)}
              variant="default"
            />
            <StatCard
              title="% Cobrado"
              value={formatPct(data.kpis.pctCobrado)}
              variant={
                data.kpis.pctCobrado >= 90
                  ? "success"
                  : data.kpis.pctCobrado >= 70
                    ? "warning"
                    : "danger"
              }
            />
            <StatCard
              title="Monto Pendiente"
              value={formatCurrency(data.kpis.montoPendiente)}
              variant={data.kpis.montoPendiente > 0 ? "warning" : "success"}
            />
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* CONTEXT TOTALS                         */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Ventas Netas (s/IVA)</p>
              <p className="font-mono font-semibold text-foreground mt-1">
                {formatCurrency(data.totals.subtotal)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">CM Total</p>
              <p
                className="font-mono font-semibold mt-1"
                style={{ color: "var(--success-muted-foreground)" }}
              >
                {formatCurrency(data.totals.cm)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Total Cobrado</p>
              <p
                className="font-mono font-semibold mt-1"
                style={{ color: "var(--info-muted-foreground)" }}
              >
                {formatCurrency(data.totals.cobrado)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Costos Fijos del Mes</p>
              <p
                className="font-mono font-semibold mt-1"
                style={{ color: "var(--danger-muted-foreground)" }}
              >
                {formatCurrency(data.totals.costosFijos)}
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* PROJECTION FORM                        */}
          {/* ═══════════════════════════════════════ */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-4 text-foreground">
              Editar Proyección — {MONTHS[month]} {year}
            </h3>
            <div className="grid grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="projSales">Ventas Proyectadas ($)</Label>
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
                <Label htmlFor="projRate">Tipo de Cambio (USD)</Label>
                <Input
                  id="projRate"
                  type="number"
                  step="0.01"
                  value={projRate}
                  onChange={(e) => setProjRate(e.target.value)}
                  placeholder="Ej: 1050"
                />
              </div>
              <div>
                <Label htmlFor="projNotes">Notas</Label>
                <Input
                  id="projNotes"
                  value={projNotes}
                  onChange={(e) => setProjNotes(e.target.value)}
                  placeholder="Observaciones..."
                />
              </div>
              <Button onClick={saveProjection} disabled={saving}>
                {saving ? "Guardando..." : "Guardar Proyección"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
