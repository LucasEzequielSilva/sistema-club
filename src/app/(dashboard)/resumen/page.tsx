"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatPct(n: number) {
  return n.toFixed(1) + "%";
}

// Default: current month
function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

type TabId = "ingresos" | "egresos" | "economico";

// Quick period presets
function getPreset(preset: string) {
  const now = new Date();
  switch (preset) {
    case "this-month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
    }
    case "last-month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
    }
    case "this-quarter": {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const from = new Date(now.getFullYear(), qStart, 1);
      const to = new Date(now.getFullYear(), qStart + 3, 0);
      return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
    }
    case "this-year": {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), 11, 31);
      return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
    }
    default:
      return getMonthRange();
  }
}

export default function ResumenPage() {
  const defaultRange = getMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [tab, setTab] = useState<TabId>("ingresos");
  const [loading, setLoading] = useState(true);

  // Data
  const [incomeData, setIncomeData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [economicData, setEconomicData] = useState<any>(null);

  const loadData = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    try {
      const params = {
        accountId: ACCOUNT_ID,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo + "T23:59:59"),
      };

      const [income, expense, economic] = await Promise.all([
        trpc.resumen.incomeSummary.query(params),
        trpc.resumen.expenseSummary.query(params),
        trpc.resumen.economicStatement.query(params),
      ]);

      setIncomeData(income);
      setExpenseData(expense);
      setEconomicData(economic);
    } catch {
      toast.error("Error al cargar el resumen");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const applyPreset = (preset: string) => {
    const range = getPreset(preset);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: "ingresos", label: "Ingresos" },
    { id: "egresos", label: "Egresos" },
    { id: "economico", label: "Estado Económico" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Resumen</h1>
        <p className="text-gray-500 mt-1">
          Análisis de ingresos, egresos y resultado económico
        </p>
      </div>

      {/* Period Selector */}
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
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => applyPreset("this-month")}>
            Este Mes
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("last-month")}>
            Mes Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("this-quarter")}>
            Trimestre
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("this-year")}>
            Año
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : (
        <>
          {/* ═══════════════════════════════════════ */}
          {/* TAB: INGRESOS                          */}
          {/* ═══════════════════════════════════════ */}
          {tab === "ingresos" && incomeData && (
            <div className="space-y-6">
              {/* Totals */}
              <div className="grid grid-cols-5 gap-3">
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Ventas Totales</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(incomeData.totals.totalSales)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {incomeData.totals.countSales} ventas
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Contribución Marginal</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(incomeData.totals.totalCM)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Margen: {formatPct(incomeData.totals.marginPct)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Cobrado</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(incomeData.totals.totalPaid)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Pendiente</p>
                  <p className="text-lg font-bold text-amber-600">
                    {formatCurrency(incomeData.totals.totalPending)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Ticket Promedio</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(incomeData.totals.avgTicket)}
                  </p>
                </div>
              </div>

              {/* By Origin */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Minorista</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="font-mono font-medium">
                        {formatCurrency(incomeData.byOrigin.minorista.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">CM</p>
                      <p className="font-mono font-medium text-green-600">
                        {formatCurrency(incomeData.byOrigin.minorista.cm)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Ventas</p>
                      <p className="font-mono font-medium">
                        {incomeData.byOrigin.minorista.count}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Mayorista</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="font-mono font-medium">
                        {formatCurrency(incomeData.byOrigin.mayorista.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">CM</p>
                      <p className="font-mono font-medium text-green-600">
                        {formatCurrency(incomeData.byOrigin.mayorista.cm)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Ventas</p>
                      <p className="font-mono font-medium">
                        {incomeData.byOrigin.mayorista.count}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* By Category */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Ventas por Categoría</h3>
                {incomeData.byCategory.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">Sin datos para el período</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">CM</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                        <TableHead className="text-center">Ventas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeData.byCategory.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(c.total)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatCurrency(c.cm)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(c.pct, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-sm">{formatPct(c.pct)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono">{c.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Sales Mix (by product) */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Mix de Ventas (por Producto)</h3>
                {incomeData.byProduct.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">Sin datos para el período</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">CM</TableHead>
                        <TableHead className="text-right">Margen %</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeData.byProduct.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(p.total)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {p.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatCurrency(p.cm)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`font-mono text-sm ${
                                p.marginPct < 20
                                  ? "text-red-500"
                                  : p.marginPct < 30
                                    ? "text-amber-500"
                                    : "text-green-600"
                              }`}
                            >
                              {formatPct(p.marginPct)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(p.pct, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-sm">{formatPct(p.pct)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* TAB: EGRESOS                           */}
          {/* ═══════════════════════════════════════ */}
          {tab === "egresos" && expenseData && (
            <div className="space-y-6">
              {/* Totals */}
              <div className="grid grid-cols-5 gap-3">
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Egresos Totales</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(expenseData.totals.totalPurchases)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {expenseData.totals.countPurchases} registros
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Costos Variables</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(expenseData.totals.variable)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Costos Fijos</p>
                  <p className="text-lg font-bold text-purple-600">
                    {formatCurrency(expenseData.totals.fijo)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Impuestos</p>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(expenseData.totals.impuestos)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Pendiente de Pago</p>
                  <p className="text-lg font-bold text-amber-600">
                    {formatCurrency(expenseData.totals.totalPending)}
                  </p>
                </div>
              </div>

              {/* By Cost Category */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Egresos por Categoría</h3>
                {expenseData.byCategory.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">Sin datos para el período</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                        <TableHead className="text-center">Registros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseData.byCategory.map((c: any) => {
                        const typeColor =
                          c.costType === "variable"
                            ? "bg-blue-100 text-blue-700"
                            : c.costType === "fijo"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-red-100 text-red-700";
                        const typeLabel =
                          c.costType === "variable"
                            ? "Variable"
                            : c.costType === "fijo"
                              ? "Fijo"
                              : "Impuesto";
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}
                              >
                                {typeLabel}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(c.total)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${Math.min(c.pct, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-sm">{formatPct(c.pct)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono">{c.count}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* By Supplier */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Egresos por Proveedor</h3>
                {expenseData.bySupplier.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">Sin datos para el período</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                        <TableHead className="text-center">Registros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseData.bySupplier.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(s.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(s.pct, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-sm">{formatPct(s.pct)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono">{s.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* TAB: ESTADO ECONÓMICO                  */}
          {/* ═══════════════════════════════════════ */}
          {tab === "economico" && economicData && (
            <div className="space-y-6">
              {/* Statement */}
              <div className="border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Estado de Resultados Económico</h3>
                <div className="space-y-0">
                  {/* Ventas */}
                  <div className="flex justify-between py-3 border-b">
                    <span className="font-medium">Ventas Netas</span>
                    <span className="font-mono font-bold text-lg">
                      {formatCurrency(economicData.ventas)}
                    </span>
                  </div>

                  {/* Costos Variables */}
                  <div className="flex justify-between py-3 border-b pl-4 text-gray-600">
                    <span>(-) Costos Variables</span>
                    <span className="font-mono text-red-500">
                      {formatCurrency(economicData.costosVariables)}
                    </span>
                  </div>

                  {/* CM */}
                  <div className="flex justify-between py-3 border-b bg-green-50 px-4 rounded">
                    <span className="font-semibold text-green-700">
                      = Contribución Marginal
                    </span>
                    <span className="font-mono font-bold text-green-700 text-lg">
                      {formatCurrency(economicData.contributionMargin)}
                    </span>
                  </div>

                  {/* Costos Fijos */}
                  <div className="flex justify-between py-3 border-b pl-4 text-gray-600">
                    <span>(-) Costos Fijos</span>
                    <span className="font-mono text-red-500">
                      {formatCurrency(economicData.costosFijos)}
                    </span>
                  </div>

                  {/* Resultado Bruto */}
                  <div className="flex justify-between py-3 border-b bg-blue-50 px-4 rounded">
                    <span className="font-semibold text-blue-700">
                      = Resultado Bruto (EBITDA)
                    </span>
                    <span
                      className={`font-mono font-bold text-lg ${
                        economicData.resultadoBruto >= 0
                          ? "text-blue-700"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(economicData.resultadoBruto)}
                    </span>
                  </div>

                  {/* Impuestos */}
                  <div className="flex justify-between py-3 border-b pl-4 text-gray-600">
                    <span>(-) Impuestos</span>
                    <span className="font-mono text-red-500">
                      {formatCurrency(economicData.impuestos)}
                    </span>
                  </div>

                  {/* Resultado Neto */}
                  <div
                    className={`flex justify-between py-4 px-4 rounded-lg mt-2 ${
                      economicData.resultadoNeto >= 0
                        ? "bg-green-100"
                        : "bg-red-100"
                    }`}
                  >
                    <span className="font-bold text-lg">= Resultado Neto</span>
                    <span
                      className={`font-mono font-bold text-xl ${
                        economicData.resultadoNeto >= 0
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {formatCurrency(economicData.resultadoNeto)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-gray-500">Índice de Variabilidad</p>
                  <p className="text-2xl font-bold font-mono">
                    {formatPct(economicData.metrics.indiceVariabilidad)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Costo Variable / Ventas
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-gray-500">Margen de Contribución</p>
                  <p
                    className={`text-2xl font-bold font-mono ${
                      economicData.metrics.margenCM < 20
                        ? "text-red-500"
                        : economicData.metrics.margenCM < 30
                          ? "text-amber-500"
                          : "text-green-600"
                    }`}
                  >
                    {formatPct(economicData.metrics.margenCM)}
                  </p>
                  <p className="text-xs text-gray-400">CM / Ventas</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-gray-500">Incidencia Costos Fijos</p>
                  <p className="text-2xl font-bold font-mono">
                    {formatPct(economicData.metrics.incidenciaCF)}
                  </p>
                  <p className="text-xs text-gray-400">CF / Ventas</p>
                </div>
              </div>

              {/* Summary footer */}
              <div className="text-xs text-gray-400 border-t pt-3">
                Período: {dateFrom} al {dateTo} |{" "}
                {economicData.countSales} ventas |{" "}
                {economicData.countPurchases} compras/gastos |{" "}
                Usa fecha de transacción (no de cobro/pago)
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
