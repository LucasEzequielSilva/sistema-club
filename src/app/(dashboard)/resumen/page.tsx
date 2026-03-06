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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BarChart3, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";

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
  const [activeTab, setActiveTab] = useState<TabId>("ingresos");
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

  const PRESETS = [
    { id: "this-month", label: "Este Mes" },
    { id: "last-month", label: "Mes Ant." },
    { id: "this-quarter", label: "Trimestre" },
    { id: "this-year", label: "Año" },
  ];

  const periodActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Desde</span>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[145px] h-8 text-sm"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Hasta</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[145px] h-8 text-sm"
        />
      </div>
      <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            className="px-2.5 py-1 text-xs font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-background"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Resumen"
        description="Estado de ingresos, egresos y resultado económico"
        icon={BarChart3}
        actions={periodActions}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <TabsList className="mb-2">
          <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
          <TabsTrigger value="egresos">Egresos</TabsTrigger>
          <TabsTrigger value="economico">Estado Económico</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* ═══════════════════════════════════════ */}
            {/* TAB: INGRESOS                          */}
            {/* ═══════════════════════════════════════ */}
            <TabsContent value="ingresos" className="space-y-6">
              {!incomeData ? (
                <EmptyState
                  icon={BarChart3}
                  title="Sin datos de ingresos"
                  description="No hay ventas registradas para el período seleccionado."
                />
              ) : (
                <>
                  {/* Totals */}
                  <div className="grid grid-cols-5 gap-3">
                    <StatCard
                      title="Ventas Totales"
                      value={formatCurrency(incomeData.totals.totalSales)}
                      subtitle={`${incomeData.totals.countSales} ventas`}
                      variant="default"
                    />
                    <StatCard
                      title="Contribución Marginal"
                      value={formatCurrency(incomeData.totals.totalCM)}
                      subtitle={`Margen: ${formatPct(incomeData.totals.marginPct)}`}
                      variant="success"
                    />
                    <StatCard
                      title="Cobrado"
                      value={formatCurrency(incomeData.totals.totalPaid)}
                      variant="success"
                    />
                    <StatCard
                      title="Pendiente"
                      value={formatCurrency(incomeData.totals.totalPending)}
                      variant="warning"
                    />
                    <StatCard
                      title="Ticket Promedio"
                      value={formatCurrency(incomeData.totals.avgTicket)}
                      variant="default"
                    />
                  </div>

                  {/* By Origin */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h3 className="font-semibold mb-3 text-foreground">Minorista</h3>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Total</p>
                          <p className="font-mono font-semibold text-foreground">
                            {formatCurrency(incomeData.byOrigin.minorista.total)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">CM</p>
                          <p className="font-mono font-semibold text-foreground">
                            {formatCurrency(incomeData.byOrigin.minorista.cm)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Ventas</p>
                          <p className="font-mono font-semibold text-foreground">
                            {incomeData.byOrigin.minorista.count}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h3 className="font-semibold mb-3 text-foreground">Mayorista</h3>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Total</p>
                          <p className="font-mono font-semibold text-foreground">
                            {formatCurrency(incomeData.byOrigin.mayorista.total)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">CM</p>
                          <p className="font-mono font-semibold text-foreground">
                            {formatCurrency(incomeData.byOrigin.mayorista.cm)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Ventas</p>
                          <p className="font-mono font-semibold text-foreground">
                            {incomeData.byOrigin.mayorista.count}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* By Category */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold mb-3 text-foreground">Ventas por Categoría</h3>
                    {incomeData.byCategory.length === 0 ? (
                      <EmptyState
                        icon={BarChart3}
                        title="Sin datos de categorías"
                        description="No hay ventas por categoría en este período."
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs uppercase text-muted-foreground">Categoría</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">Total</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">CM</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">% del Total</TableHead>
                            <TableHead className="text-center text-xs uppercase text-muted-foreground">Ventas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {incomeData.byCategory.map((c: any) => (
                            <TableRow key={c.id} className="hover:bg-muted/40">
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-foreground">
                                {formatCurrency(c.total)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-foreground">
                                {formatCurrency(c.cm)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary/60 rounded-full"
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
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold mb-3 text-foreground">Mix de Ventas (por Producto)</h3>
                    {incomeData.byProduct.length === 0 ? (
                      <EmptyState
                        icon={BarChart3}
                        title="Sin datos de productos"
                        description="No hay ventas por producto en este período."
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs uppercase text-muted-foreground">Producto</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">Total</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">Cantidad</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">CM</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">Margen %</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">% del Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {incomeData.byProduct.map((p: any) => (
                            <TableRow key={p.id} className="hover:bg-muted/40">
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-foreground">
                                {formatCurrency(p.total)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {p.quantity}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-foreground">
                                {formatCurrency(p.cm)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className="font-mono text-sm"
                                  style={{
                                    color: p.marginPct < 20
                                      ? "var(--danger-muted-foreground)"
                                      : p.marginPct < 30
                                        ? "var(--warning-muted-foreground)"
                                        : "var(--success-muted-foreground)",
                                  }}
                                >
                                  {formatPct(p.marginPct)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary/60 rounded-full"
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
                </>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════ */}
            {/* TAB: EGRESOS                           */}
            {/* ═══════════════════════════════════════ */}
            <TabsContent value="egresos" className="space-y-6">
              {!expenseData ? (
                <EmptyState
                  icon={BarChart3}
                  title="Sin datos de egresos"
                  description="No hay compras o gastos registrados para el período seleccionado."
                />
              ) : (
                <>
                  {/* Totals */}
                  <div className="grid grid-cols-5 gap-3">
                    <StatCard
                      title="Egresos Totales"
                      value={formatCurrency(expenseData.totals.totalPurchases)}
                      subtitle={`${expenseData.totals.countPurchases} registros`}
                      variant="default"
                    />
                    <StatCard
                      title="Costos Variables"
                      value={formatCurrency(expenseData.totals.variable)}
                      variant="info"
                    />
                    <StatCard
                      title="Costos Fijos"
                      value={formatCurrency(expenseData.totals.fijo)}
                      variant="muted"
                    />
                    <StatCard
                      title="Impuestos"
                      value={formatCurrency(expenseData.totals.impuestos)}
                      variant="danger"
                    />
                    <StatCard
                      title="Pendiente de Pago"
                      value={formatCurrency(expenseData.totals.totalPending)}
                      variant="warning"
                    />
                  </div>

                  {/* By Cost Category */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold mb-3 text-foreground">Egresos por Categoría</h3>
                    {expenseData.byCategory.length === 0 ? (
                      <EmptyState
                        icon={BarChart3}
                        title="Sin datos de categorías"
                        description="No hay egresos por categoría en este período."
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs uppercase text-muted-foreground">Categoría</TableHead>
                            <TableHead className="text-xs uppercase text-muted-foreground">Tipo</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">Total</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">% del Total</TableHead>
                            <TableHead className="text-center text-xs uppercase text-muted-foreground">Registros</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expenseData.byCategory.map((c: any) => {
                            const typeColor =
                              c.costType === "variable"
                                ? "bg-[var(--info-muted)] text-[var(--info-muted-foreground)]"
                                : c.costType === "fijo"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-[var(--warning-muted)] text-[var(--warning-muted-foreground)]";
                            const typeLabel =
                              c.costType === "variable"
                                ? "Variable"
                                : c.costType === "fijo"
                                  ? "Fijo"
                                  : "Impuesto";
                            return (
                              <TableRow key={c.id} className="hover:bg-muted/40">
                                <TableCell className="font-medium">{c.name}</TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}
                                  >
                                    {typeLabel}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold text-foreground">
                                  {formatCurrency(c.total)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-primary/60 rounded-full"
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
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold mb-3 text-foreground">Egresos por Proveedor</h3>
                    {expenseData.bySupplier.length === 0 ? (
                      <EmptyState
                        icon={BarChart3}
                        title="Sin datos de proveedores"
                        description="No hay egresos por proveedor en este período."
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs uppercase text-muted-foreground">Proveedor</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">Total</TableHead>
                            <TableHead className="text-right text-xs uppercase text-muted-foreground">% del Total</TableHead>
                            <TableHead className="text-center text-xs uppercase text-muted-foreground">Registros</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expenseData.bySupplier.map((s: any) => (
                            <TableRow key={s.id} className="hover:bg-muted/40">
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-foreground">
                                {formatCurrency(s.total)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary/60 rounded-full"
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
                </>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════ */}
            {/* TAB: ESTADO ECONÓMICO                  */}
            {/* ═══════════════════════════════════════ */}
            <TabsContent value="economico" className="space-y-6">
              {!economicData ? (
                <EmptyState
                  icon={BarChart3}
                  title="Sin datos económicos"
                  description="No hay información económica para el período seleccionado."
                />
              ) : (
                <>
                  {/* Economic Waterfall */}
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="text-base font-semibold mb-5 text-foreground">Estado de Resultados Económico</h3>
                    <div className="space-y-0">
                      {/* Ventas */}
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="font-medium text-foreground">Ventas Netas</span>
                        <span className="font-mono font-bold text-lg text-foreground">
                          {formatCurrency(economicData.ventas)}
                        </span>
                      </div>

                      {/* Costos Variables */}
                      <div className="flex justify-between py-3 border-b border-border pl-4">
                        <span className="text-muted-foreground">(-) Costos Variables</span>
                        <span
                          className="font-mono"
                          style={{ color: "var(--danger-muted-foreground)" }}
                        >
                          {formatCurrency(economicData.costosVariables)}
                        </span>
                      </div>

                      {/* CM */}
                      <div
                        className="flex justify-between py-3 border-b border-border px-4 rounded-lg"
                        style={{ backgroundColor: "var(--success-muted)" }}
                      >
                        <span className="font-semibold" style={{ color: "var(--success-muted-foreground)" }}>
                          = Contribución Marginal
                        </span>
                        <span
                          className="font-mono font-bold text-lg"
                          style={{ color: "var(--success-muted-foreground)" }}
                        >
                          {formatCurrency(economicData.contributionMargin)}
                        </span>
                      </div>

                      {/* Costos Fijos */}
                      <div className="flex justify-between py-3 border-b border-border pl-4">
                        <span className="text-muted-foreground">(-) Costos Fijos</span>
                        <span className="font-mono text-muted-foreground">
                          {formatCurrency(economicData.costosFijos)}
                        </span>
                      </div>

                      {/* EBITDA */}
                      <div
                        className="flex justify-between py-3 border-b border-border px-4 rounded-lg"
                        style={{
                          backgroundColor: economicData.resultadoBruto >= 0
                            ? "var(--info-muted)"
                            : "var(--danger-muted)",
                        }}
                      >
                        <span
                          className="font-semibold"
                          style={{
                            color: economicData.resultadoBruto >= 0
                              ? "var(--info-muted-foreground)"
                              : "var(--danger-muted-foreground)",
                          }}
                        >
                          = Resultado Bruto (EBITDA)
                        </span>
                        <span
                          className="font-mono font-bold text-lg"
                          style={{
                            color: economicData.resultadoBruto >= 0
                              ? "var(--info-muted-foreground)"
                              : "var(--danger-muted-foreground)",
                          }}
                        >
                          {formatCurrency(economicData.resultadoBruto)}
                        </span>
                      </div>

                      {/* Impuestos */}
                      <div className="flex justify-between py-3 border-b border-border pl-4">
                        <span className="text-muted-foreground">(-) Impuestos</span>
                        <span
                          className="font-mono"
                          style={{ color: "var(--warning-muted-foreground)" }}
                        >
                          {formatCurrency(economicData.impuestos)}
                        </span>
                      </div>

                      {/* Resultado Neto */}
                      <div
                        className="flex justify-between py-4 px-4 rounded-xl mt-2"
                        style={{
                          backgroundColor: economicData.resultadoNeto >= 0
                            ? "var(--success-muted)"
                            : "var(--danger-muted)",
                        }}
                      >
                        <span className="font-bold text-lg text-foreground">= Resultado Neto</span>
                        <span
                          className="font-mono font-bold text-xl"
                          style={{
                            color: economicData.resultadoNeto >= 0
                              ? "var(--success-muted-foreground)"
                              : "var(--danger-muted-foreground)",
                          }}
                        >
                          {formatCurrency(economicData.resultadoNeto)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <StatCard
                      title="Índice de Variabilidad"
                      value={formatPct(economicData.metrics.indiceVariabilidad)}
                      subtitle="Costo Variable / Ventas"
                      variant="default"
                    />
                    <StatCard
                      title="Margen de Contribución"
                      value={formatPct(economicData.metrics.margenCM)}
                      subtitle="CM / Ventas"
                      variant={
                        economicData.metrics.margenCM >= 30
                          ? "success"
                          : economicData.metrics.margenCM >= 20
                            ? "warning"
                            : "danger"
                      }
                    />
                    <StatCard
                      title="Incidencia Costos Fijos"
                      value={formatPct(economicData.metrics.incidenciaCF)}
                      subtitle="CF / Ventas"
                      variant="default"
                    />
                  </div>

                  {/* Summary footer */}
                  <div className="text-xs text-muted-foreground border-t border-border pt-3">
                    Período: {dateFrom} al {dateTo} |{" "}
                    {economicData.countSales} ventas |{" "}
                    {economicData.countPurchases} compras/gastos |{" "}
                    Usa fecha de transacción (no de cobro/pago)
                  </div>
                </>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
