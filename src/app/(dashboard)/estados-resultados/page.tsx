"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number) {
  return n.toFixed(1) + "%";
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type TabId = "financiero" | "anual";

export default function EstadosResultadosPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tab, setTab] = useState<TabId>("financiero");
  const [loading, setLoading] = useState(true);

  // Data
  const [financialData, setFinancialData] = useState<any>(null);
  const [annualData, setAnnualData] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "financiero") {
        const result = await trpc.estadosResultados.financialStatement.query({
          accountId: ACCOUNT_ID,
          year,
          month,
        });
        setFinancialData(result);
      } else {
        const result = await trpc.estadosResultados.annualGrid.query({
          accountId: ACCOUNT_ID,
          year,
        });
        setAnnualData(result);
      }
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [tab, year, month]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const TABS: { id: TabId; label: string }[] = [
    { id: "financiero", label: "Estado Financiero" },
    { id: "anual", label: "Vista Anual" },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Estados de Resultados</h1>
        <p className="text-gray-500 mt-1">
          Análisis financiero (efectivo) y comparativa anual
        </p>
      </div>

      {/* Period + Tabs */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
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

        <div className="flex gap-2 items-center">
          {tab === "financiero" && (
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
          )}
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
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : (
        <>
          {/* ═══════════════════════════════════════ */}
          {/* TAB: ESTADO FINANCIERO                 */}
          {/* ═══════════════════════════════════════ */}
          {tab === "financiero" && financialData && (
            <div className="space-y-6">
              {/* Waterfall */}
              <div className="border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Estado Financiero — {financialData.month} {financialData.year}
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Basado en fechas de acreditación (no de transacción)
                </p>

                <div className="space-y-0">
                  <div className="flex justify-between py-3 border-b bg-green-50 px-4 rounded">
                    <span className="font-medium text-green-700">
                      (+) Cobranzas acreditadas
                    </span>
                    <span className="font-mono font-bold text-green-700 text-lg">
                      {formatCurrency(financialData.totalCobranzas)}
                    </span>
                  </div>

                  <div className="flex justify-between py-3 border-b bg-red-50 px-4 rounded">
                    <span className="font-medium text-red-700">
                      (-) Pagos acreditados
                    </span>
                    <span className="font-mono font-bold text-red-700 text-lg">
                      {formatCurrency(financialData.totalPagos)}
                    </span>
                  </div>

                  <div
                    className={`flex justify-between py-4 px-4 rounded-lg mt-2 ${
                      financialData.superavit >= 0
                        ? "bg-green-100"
                        : "bg-red-100"
                    }`}
                  >
                    <span className="font-bold text-lg">
                      = {financialData.superavit >= 0 ? "Superávit" : "Déficit"}
                    </span>
                    <span
                      className={`font-mono font-bold text-xl ${
                        financialData.superavit >= 0
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {formatCurrency(financialData.superavit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Breakdown by method */}
              <div className="grid grid-cols-2 gap-4">
                {/* Cobranzas by method */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 text-green-700">
                    Cobranzas por Método ({financialData.countCobranzas})
                  </h4>
                  {financialData.cobranzasByMethod.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">
                      Sin cobranzas en el período
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {financialData.cobranzasByMethod.map((m: any) => (
                        <div
                          key={m.name}
                          className="flex justify-between text-sm"
                        >
                          <span>
                            {m.name}{" "}
                            <span className="text-gray-400">({m.count})</span>
                          </span>
                          <span className="font-mono font-medium">
                            {formatCurrency(m.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagos by method */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 text-red-700">
                    Pagos por Método ({financialData.countPagos})
                  </h4>
                  {financialData.pagosByMethod.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">
                      Sin pagos en el período
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {financialData.pagosByMethod.map((m: any) => (
                        <div
                          key={m.name}
                          className="flex justify-between text-sm"
                        >
                          <span>
                            {m.name}{" "}
                            <span className="text-gray-400">({m.count})</span>
                          </span>
                          <span className="font-mono font-medium">
                            {formatCurrency(m.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* TAB: VISTA ANUAL (12 months grid)      */}
          {/* ═══════════════════════════════════════ */}
          {tab === "anual" && annualData && (
            <div className="space-y-6">
              {/* Annual Totals */}
              <div className="grid grid-cols-4 gap-3">
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Ventas Anuales</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(annualData.totals.economic.ventas)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Resultado Neto</p>
                  <p
                    className={`text-lg font-bold ${
                      annualData.totals.economic.neto >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(annualData.totals.economic.neto)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Superávit Financiero</p>
                  <p
                    className={`text-lg font-bold ${
                      annualData.totals.financial.superavit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(annualData.totals.financial.superavit)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500">Margen CM Anual</p>
                  <p
                    className={`text-lg font-bold ${
                      annualData.totals.economic.margenCM < 20
                        ? "text-red-500"
                        : annualData.totals.economic.margenCM < 30
                          ? "text-amber-500"
                          : "text-green-600"
                    }`}
                  >
                    {formatPct(annualData.totals.economic.margenCM)}
                  </p>
                </div>
              </div>

              {/* Economic Grid */}
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b">
                  <h3 className="font-semibold">Estado Económico — {annualData.year}</h3>
                  <p className="text-xs text-gray-400">Por fecha de transacción</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white z-10 min-w-[140px]">
                          Concepto
                        </TableHead>
                        {annualData.months.map((m: any) => (
                          <TableHead
                            key={m.month}
                            className="text-right min-w-[90px]"
                          >
                            {m.name}
                          </TableHead>
                        ))}
                        <TableHead className="text-right min-w-[100px] bg-slate-50 font-bold">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Ventas */}
                      <TableRow>
                        <TableCell className="font-medium sticky left-0 bg-white">
                          Ventas
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className="text-right font-mono text-sm"
                          >
                            {m.economic.ventas > 0
                              ? formatCurrency(m.economic.ventas)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono font-bold bg-slate-50">
                          {formatCurrency(annualData.totals.economic.ventas)}
                        </TableCell>
                      </TableRow>

                      {/* Costos Variables */}
                      <TableRow>
                        <TableCell className="text-gray-500 sticky left-0 bg-white">
                          (-) C. Variables
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className="text-right font-mono text-sm text-red-500"
                          >
                            {m.economic.costosVariables > 0
                              ? formatCurrency(m.economic.costosVariables)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono font-bold bg-slate-50 text-red-500">
                          {formatCurrency(annualData.totals.economic.costosVariables)}
                        </TableCell>
                      </TableRow>

                      {/* CM */}
                      <TableRow className="bg-green-50">
                        <TableCell className="font-semibold text-green-700 sticky left-0 bg-green-50">
                          = CM
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className="text-right font-mono text-sm font-medium text-green-700"
                          >
                            {m.economic.cm !== 0
                              ? formatCurrency(m.economic.cm)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono font-bold bg-green-100 text-green-700">
                          {formatCurrency(annualData.totals.economic.cm)}
                        </TableCell>
                      </TableRow>

                      {/* Costos Fijos */}
                      <TableRow>
                        <TableCell className="text-gray-500 sticky left-0 bg-white">
                          (-) C. Fijos
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className="text-right font-mono text-sm text-red-500"
                          >
                            {m.economic.costosFijos > 0
                              ? formatCurrency(m.economic.costosFijos)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono font-bold bg-slate-50 text-red-500">
                          {formatCurrency(annualData.totals.economic.costosFijos)}
                        </TableCell>
                      </TableRow>

                      {/* EBITDA */}
                      <TableRow className="bg-blue-50">
                        <TableCell className="font-semibold text-blue-700 sticky left-0 bg-blue-50">
                          = EBITDA
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className={`text-right font-mono text-sm font-medium ${
                              m.economic.ebitda >= 0
                                ? "text-blue-700"
                                : "text-red-600"
                            }`}
                          >
                            {m.economic.ebitda !== 0
                              ? formatCurrency(m.economic.ebitda)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell
                          className={`text-right font-mono font-bold bg-blue-100 ${
                            annualData.totals.economic.ebitda >= 0
                              ? "text-blue-700"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(annualData.totals.economic.ebitda)}
                        </TableCell>
                      </TableRow>

                      {/* Impuestos */}
                      <TableRow>
                        <TableCell className="text-gray-500 sticky left-0 bg-white">
                          (-) Impuestos
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className="text-right font-mono text-sm text-red-500"
                          >
                            {m.economic.impuestos > 0
                              ? formatCurrency(m.economic.impuestos)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono font-bold bg-slate-50 text-red-500">
                          {formatCurrency(annualData.totals.economic.impuestos)}
                        </TableCell>
                      </TableRow>

                      {/* Resultado Neto */}
                      <TableRow className="border-t-2">
                        <TableCell className="font-bold sticky left-0 bg-white">
                          = Neto
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className={`text-right font-mono text-sm font-bold ${
                              m.economic.neto >= 0
                                ? "text-green-700"
                                : "text-red-600"
                            }`}
                          >
                            {m.economic.neto !== 0
                              ? formatCurrency(m.economic.neto)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell
                          className={`text-right font-mono font-bold bg-slate-50 ${
                            annualData.totals.economic.neto >= 0
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(annualData.totals.economic.neto)}
                        </TableCell>
                      </TableRow>

                      {/* Margin % */}
                      <TableRow>
                        <TableCell className="text-gray-400 text-xs sticky left-0 bg-white">
                          Margen CM %
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className={`text-right font-mono text-xs ${
                              m.economic.margenCM < 20
                                ? "text-red-500"
                                : m.economic.margenCM < 30
                                  ? "text-amber-500"
                                  : "text-green-600"
                            }`}
                          >
                            {m.economic.ventas > 0
                              ? formatPct(m.economic.margenCM)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono text-xs font-bold bg-slate-50">
                          {formatPct(annualData.totals.economic.margenCM)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Financial Grid */}
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b">
                  <h3 className="font-semibold">
                    Estado Financiero — {annualData.year}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Por fecha de acreditación
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white z-10 min-w-[140px]">
                          Concepto
                        </TableHead>
                        {annualData.months.map((m: any) => (
                          <TableHead
                            key={m.month}
                            className="text-right min-w-[90px]"
                          >
                            {m.name}
                          </TableHead>
                        ))}
                        <TableHead className="text-right min-w-[100px] bg-slate-50 font-bold">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Cobranzas */}
                      <TableRow>
                        <TableCell className="font-medium text-green-700 sticky left-0 bg-white">
                          (+) Cobranzas
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className="text-right font-mono text-sm text-green-600"
                          >
                            {m.financial.cobranzas > 0
                              ? formatCurrency(m.financial.cobranzas)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono font-bold bg-slate-50 text-green-700">
                          {formatCurrency(annualData.totals.financial.cobranzas)}
                        </TableCell>
                      </TableRow>

                      {/* Pagos */}
                      <TableRow>
                        <TableCell className="font-medium text-red-700 sticky left-0 bg-white">
                          (-) Pagos
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className="text-right font-mono text-sm text-red-500"
                          >
                            {m.financial.pagos > 0
                              ? formatCurrency(m.financial.pagos)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono font-bold bg-slate-50 text-red-500">
                          {formatCurrency(annualData.totals.financial.pagos)}
                        </TableCell>
                      </TableRow>

                      {/* Superávit */}
                      <TableRow className="border-t-2">
                        <TableCell className="font-bold sticky left-0 bg-white">
                          = Resultado
                        </TableCell>
                        {annualData.months.map((m: any) => (
                          <TableCell
                            key={m.month}
                            className={`text-right font-mono text-sm font-bold ${
                              m.financial.superavit >= 0
                                ? "text-green-700"
                                : "text-red-600"
                            }`}
                          >
                            {m.financial.superavit !== 0
                              ? formatCurrency(m.financial.superavit)
                              : "\u2014"}
                          </TableCell>
                        ))}
                        <TableCell
                          className={`text-right font-mono font-bold bg-slate-50 ${
                            annualData.totals.financial.superavit >= 0
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(annualData.totals.financial.superavit)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
