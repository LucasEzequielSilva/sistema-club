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

  // Variation color
  function variationColor(value: number | null | undefined) {
    if (value === null || value === undefined) return "text-gray-400";
    return value >= 0 ? "text-green-600" : "text-red-600";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Cuadro Resumen</h1>
        <p className="text-gray-500 mt-1">
          KPIs mensuales — Proyectado vs Real
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
              if (month === 0) { setMonth(11); setYear(year - 1); }
              else setMonth(month - 1);
            }}
          >
            &larr; Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (month === 11) { setMonth(0); setYear(year + 1); }
              else setMonth(month + 1);
            }}
          >
            Siguiente &rarr;
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400">Sin datos</div>
      ) : (
        <>
          {/* ═══════════════════════════════════════ */}
          {/* ADVANCEMENT BAR                        */}
          {/* ═══════════════════════════════════════ */}
          {data.kpis.advancement !== null && (
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Grado de Avance</h3>
                <span
                  className={`text-2xl font-bold ${
                    data.kpis.advancement >= 100
                      ? "text-green-600"
                      : data.kpis.advancement >= 70
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {data.kpis.advancement.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${
                    data.kpis.advancement >= 100
                      ? "bg-green-500"
                      : data.kpis.advancement >= 70
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(data.kpis.advancement, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {formatCurrency(data.scorecard.ventas.real)} de{" "}
                {formatCurrency(data.scorecard.ventas.projected)} proyectados
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* MAIN SCORECARD TABLE (BR #13)          */}
          {/* ═══════════════════════════════════════ */}
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b">
              <h3 className="font-semibold">
                Cuadro de Resultados — {MONTHS[month]} {year}
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Concepto</TableHead>
                  <TableHead className="text-right min-w-[140px]">
                    Proyectado
                  </TableHead>
                  <TableHead className="text-right min-w-[140px]">
                    Real
                  </TableHead>
                  <TableHead className="text-right min-w-[140px]">
                    Variación
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Ventas */}
                <TableRow>
                  <TableCell className="font-medium">Ventas</TableCell>
                  <TableCell className="text-right font-mono text-gray-500">
                    {formatValue(data.scorecard.ventas.projected, "$")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatValue(data.scorecard.ventas.real, "$")}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-medium ${variationColor(
                      data.scorecard.ventas.variation
                    )}`}
                  >
                    {data.scorecard.ventas.variation !== null
                      ? `${data.scorecard.ventas.variation >= 0 ? "+" : ""}${data.scorecard.ventas.variation.toFixed(1)}%`
                      : "—"}
                  </TableCell>
                </TableRow>

                {/* Rentabilidad */}
                <TableRow>
                  <TableCell className="font-medium">
                    Rentabilidad (CM%)
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-500">
                    {formatValue(data.scorecard.rentabilidad.projected, "%")}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-semibold ${
                      data.scorecard.rentabilidad.real >= 30
                        ? "text-green-600"
                        : data.scorecard.rentabilidad.real >= 20
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {formatValue(data.scorecard.rentabilidad.real, "%")}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-medium ${variationColor(
                      data.scorecard.rentabilidad.variation
                    )}`}
                  >
                    {formatVariation(data.scorecard.rentabilidad.variation, "%")}
                  </TableCell>
                </TableRow>

                {/* Utilidad */}
                <TableRow className="bg-slate-50">
                  <TableCell className="font-bold">
                    Utilidad (CM - CF)
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-500">
                    {formatValue(data.scorecard.utilidad.projected, "$")}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-bold ${
                      data.scorecard.utilidad.real >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {formatValue(data.scorecard.utilidad.real, "$")}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-medium ${variationColor(
                      data.scorecard.utilidad.variation
                    )}`}
                  >
                    {formatVariation(data.scorecard.utilidad.variation, "$")}
                  </TableCell>
                </TableRow>

                {/* Utilidad USD */}
                <TableRow>
                  <TableCell className="font-medium text-gray-600">
                    Utilidad en USD
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-500">
                    {formatValue(data.scorecard.utilidadUSD.projected, "USD")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatValue(data.scorecard.utilidadUSD.real, "USD")}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-medium ${variationColor(
                      data.scorecard.utilidadUSD.variation
                    )}`}
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
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Ticket Promedio</p>
              <p className="text-xl font-bold">
                {formatCurrency(data.kpis.ticketPromedio)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">CM Promedio</p>
              <p
                className={`text-xl font-bold ${
                  data.kpis.cmPromedio >= 30
                    ? "text-green-600"
                    : data.kpis.cmPromedio >= 20
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {formatPct(data.kpis.cmPromedio)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Cantidad Ventas</p>
              <p className="text-xl font-bold">{data.kpis.cantidadVentas}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">% Cobrado</p>
              <p
                className={`text-xl font-bold ${
                  data.kpis.pctCobrado >= 90
                    ? "text-green-600"
                    : data.kpis.pctCobrado >= 70
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {formatPct(data.kpis.pctCobrado)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">Monto Pendiente</p>
              <p
                className={`text-xl font-bold ${
                  data.kpis.montoPendiente > 0
                    ? "text-amber-600"
                    : "text-green-600"
                }`}
              >
                {formatCurrency(data.kpis.montoPendiente)}
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* CONTEXT TOTALS                         */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 bg-slate-50">
              <p className="text-xs text-gray-500">Ventas Netas (s/IVA)</p>
              <p className="font-mono font-medium">
                {formatCurrency(data.totals.subtotal)}
              </p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <p className="text-xs text-gray-500">CM Total</p>
              <p className="font-mono font-medium text-green-600">
                {formatCurrency(data.totals.cm)}
              </p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <p className="text-xs text-gray-500">Total Cobrado</p>
              <p className="font-mono font-medium text-blue-600">
                {formatCurrency(data.totals.cobrado)}
              </p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <p className="text-xs text-gray-500">Costos Fijos del Mes</p>
              <p className="font-mono font-medium text-red-600">
                {formatCurrency(data.totals.costosFijos)}
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* PROJECTION FORM                        */}
          {/* ═══════════════════════════════════════ */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">
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
