"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";

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

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const periodSelector = (
    <div className="flex gap-2 items-center">
      {tab === "financiero" && (
        <Select
          value={String(month)}
          onValueChange={(v) => setMonth(Number(v))}
        >
          <SelectTrigger className="w-[140px] h-8">
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
        <SelectTrigger className="w-[100px] h-8">
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
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Estados de Resultados"
        description="Estado financiero mensual y anual"
        icon={FileText}
        actions={periodSelector}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList className="mb-2">
          <TabsTrigger value="financiero">Estado Financiero</TabsTrigger>
          <TabsTrigger value="anual">Vista Anual</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* ═══════════════════════════════════════ */}
            {/* TAB: ESTADO FINANCIERO                 */}
            {/* ═══════════════════════════════════════ */}
            <TabsContent value="financiero" className="space-y-6">
              {financialData && (
                <>
                  {/* Waterfall */}
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="text-base font-semibold mb-1 text-foreground">
                      Estado Financiero — {financialData.month} {financialData.year}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-5">
                      Basado en fechas de acreditación (no de transacción)
                    </p>

                    <div className="space-y-0">
                      <div
                        className="flex justify-between py-3 border-b border-border px-4 rounded-lg"
                        style={{ backgroundColor: "var(--success-muted)" }}
                      >
                        <span
                          className="font-medium"
                          style={{ color: "var(--success-muted-foreground)" }}
                        >
                          (+) Cobranzas acreditadas
                        </span>
                        <span
                          className="font-mono font-bold text-lg"
                          style={{ color: "var(--success-muted-foreground)" }}
                        >
                          {formatCurrency(financialData.totalCobranzas)}
                        </span>
                      </div>

                      <div
                        className="flex justify-between py-3 border-b border-border px-4 rounded-lg"
                        style={{ backgroundColor: "var(--danger-muted)" }}
                      >
                        <span
                          className="font-medium"
                          style={{ color: "var(--danger-muted-foreground)" }}
                        >
                          (-) Pagos acreditados
                        </span>
                        <span
                          className="font-mono font-bold text-lg"
                          style={{ color: "var(--danger-muted-foreground)" }}
                        >
                          {formatCurrency(financialData.totalPagos)}
                        </span>
                      </div>

                      <div
                        className="flex justify-between py-4 px-4 rounded-xl mt-2"
                        style={{
                          backgroundColor: financialData.superavit >= 0
                            ? "var(--success-muted)"
                            : "var(--danger-muted)",
                        }}
                      >
                        <span className="font-bold text-lg text-foreground">
                          = {financialData.superavit >= 0 ? "Superávit" : "Déficit"}
                        </span>
                        <span
                          className="font-mono font-bold text-xl"
                          style={{
                            color: financialData.superavit >= 0
                              ? "var(--success-muted-foreground)"
                              : "var(--danger-muted-foreground)",
                          }}
                        >
                          {formatCurrency(financialData.superavit)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Breakdown by method */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Cobranzas by method */}
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h4
                        className="font-semibold mb-3"
                        style={{ color: "var(--success-muted-foreground)" }}
                      >
                        Cobranzas por Método ({financialData.countCobranzas})
                      </h4>
                      {financialData.cobranzasByMethod.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">
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
                                <span className="text-muted-foreground">({m.count})</span>
                              </span>
                              <span className="font-mono font-semibold text-foreground">
                                {formatCurrency(m.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pagos by method */}
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h4
                        className="font-semibold mb-3"
                        style={{ color: "var(--danger-muted-foreground)" }}
                      >
                        Pagos por Método ({financialData.countPagos})
                      </h4>
                      {financialData.pagosByMethod.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">
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
                                <span className="text-muted-foreground">({m.count})</span>
                              </span>
                              <span className="font-mono font-semibold text-foreground">
                                {formatCurrency(m.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════ */}
            {/* TAB: VISTA ANUAL (12 months grid)      */}
            {/* ═══════════════════════════════════════ */}
            <TabsContent value="anual" className="space-y-6">
              {annualData && (
                <>
                  {/* Annual Totals */}
                  <div className="grid grid-cols-4 gap-3">
                    <StatCard
                      title="Ventas Anuales"
                      value={formatCurrency(annualData.totals.economic.ventas)}
                      variant="default"
                    />
                    <StatCard
                      title="Resultado Neto"
                      value={formatCurrency(annualData.totals.economic.neto)}
                      variant={annualData.totals.economic.neto >= 0 ? "success" : "danger"}
                    />
                    <StatCard
                      title="Superávit Financiero"
                      value={formatCurrency(annualData.totals.financial.superavit)}
                      variant={annualData.totals.financial.superavit >= 0 ? "success" : "danger"}
                    />
                    <StatCard
                      title="Margen CM Anual"
                      value={formatPct(annualData.totals.economic.margenCM)}
                      variant={
                        annualData.totals.economic.margenCM >= 30
                          ? "success"
                          : annualData.totals.economic.margenCM >= 20
                            ? "warning"
                            : "danger"
                      }
                    />
                  </div>

                  {/* Economic Grid */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 py-3 bg-muted/30 border-b border-border">
                      <h3 className="font-semibold text-foreground">Estado Económico — {annualData.year}</h3>
                      <p className="text-xs text-muted-foreground">Por fecha de transacción</p>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-card z-10 min-w-[140px] text-xs uppercase text-muted-foreground">
                              Concepto
                            </TableHead>
                            {annualData.months.map((m: any) => (
                              <TableHead
                                key={m.month}
                                className="text-right min-w-[90px] text-xs uppercase text-muted-foreground"
                              >
                                {m.name}
                              </TableHead>
                            ))}
                            <TableHead className="text-right min-w-[100px] bg-muted/30 font-bold text-xs uppercase text-muted-foreground">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Ventas */}
                          <TableRow className="hover:bg-muted/40">
                            <TableCell className="font-medium sticky left-0 bg-card">
                              Ventas
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm font-semibold text-foreground"
                              >
                                {m.economic.ventas > 0
                                  ? formatCurrency(m.economic.ventas)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-mono font-bold bg-muted/30 text-foreground">
                              {formatCurrency(annualData.totals.economic.ventas)}
                            </TableCell>
                          </TableRow>

                          {/* Costos Variables */}
                          <TableRow className="hover:bg-muted/40">
                            <TableCell className="text-muted-foreground sticky left-0 bg-card">
                              (-) C. Variables
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm"
                                style={{ color: m.economic.costosVariables > 0 ? "var(--danger-muted-foreground)" : undefined }}
                              >
                                {m.economic.costosVariables > 0
                                  ? formatCurrency(m.economic.costosVariables)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell
                              className="text-right font-mono font-bold bg-muted/30"
                              style={{ color: "var(--danger-muted-foreground)" }}
                            >
                              {formatCurrency(annualData.totals.economic.costosVariables)}
                            </TableCell>
                          </TableRow>

                          {/* CM */}
                          <TableRow style={{ backgroundColor: "var(--success-muted)" }}>
                            <TableCell
                              className="font-semibold sticky left-0"
                              style={{ backgroundColor: "var(--success-muted)", color: "var(--success-muted-foreground)" }}
                            >
                              = CM
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm font-medium"
                                style={{ color: "var(--success-muted-foreground)" }}
                              >
                                {m.economic.cm !== 0
                                  ? formatCurrency(m.economic.cm)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell
                              className="text-right font-mono font-bold"
                              style={{ color: "var(--success-muted-foreground)" }}
                            >
                              {formatCurrency(annualData.totals.economic.cm)}
                            </TableCell>
                          </TableRow>

                          {/* Costos Fijos */}
                          <TableRow className="hover:bg-muted/40">
                            <TableCell className="text-muted-foreground sticky left-0 bg-card">
                              (-) C. Fijos
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm text-muted-foreground"
                              >
                                {m.economic.costosFijos > 0
                                  ? formatCurrency(m.economic.costosFijos)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-mono font-bold bg-muted/30 text-muted-foreground">
                              {formatCurrency(annualData.totals.economic.costosFijos)}
                            </TableCell>
                          </TableRow>

                          {/* EBITDA */}
                          <TableRow style={{ backgroundColor: "var(--info-muted)" }}>
                            <TableCell
                              className="font-semibold sticky left-0"
                              style={{ backgroundColor: "var(--info-muted)", color: "var(--info-muted-foreground)" }}
                            >
                              = EBITDA
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm font-medium"
                                style={{
                                  color: m.economic.ebitda >= 0
                                    ? "var(--info-muted-foreground)"
                                    : "var(--danger-muted-foreground)",
                                }}
                              >
                                {m.economic.ebitda !== 0
                                  ? formatCurrency(m.economic.ebitda)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell
                              className="text-right font-mono font-bold"
                              style={{
                                color: annualData.totals.economic.ebitda >= 0
                                  ? "var(--info-muted-foreground)"
                                  : "var(--danger-muted-foreground)",
                              }}
                            >
                              {formatCurrency(annualData.totals.economic.ebitda)}
                            </TableCell>
                          </TableRow>

                          {/* Impuestos */}
                          <TableRow className="hover:bg-muted/40">
                            <TableCell className="text-muted-foreground sticky left-0 bg-card">
                              (-) Impuestos
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm"
                                style={{ color: m.economic.impuestos > 0 ? "var(--warning-muted-foreground)" : undefined }}
                              >
                                {m.economic.impuestos > 0
                                  ? formatCurrency(m.economic.impuestos)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell
                              className="text-right font-mono font-bold bg-muted/30"
                              style={{ color: "var(--warning-muted-foreground)" }}
                            >
                              {formatCurrency(annualData.totals.economic.impuestos)}
                            </TableCell>
                          </TableRow>

                          {/* Resultado Neto */}
                          <TableRow className="border-t-2">
                            <TableCell className="font-bold sticky left-0 bg-card">
                              = Neto
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm font-bold"
                                style={{
                                  color: m.economic.neto >= 0
                                    ? "var(--success-muted-foreground)"
                                    : "var(--danger-muted-foreground)",
                                }}
                              >
                                {m.economic.neto !== 0
                                  ? formatCurrency(m.economic.neto)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell
                              className="text-right font-mono font-bold bg-muted/30"
                              style={{
                                color: annualData.totals.economic.neto >= 0
                                  ? "var(--success-muted-foreground)"
                                  : "var(--danger-muted-foreground)",
                              }}
                            >
                              {formatCurrency(annualData.totals.economic.neto)}
                            </TableCell>
                          </TableRow>

                          {/* Margin % */}
                          <TableRow className="hover:bg-muted/40">
                            <TableCell className="text-muted-foreground text-xs sticky left-0 bg-card">
                              Margen CM %
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-xs"
                                style={{
                                  color: m.economic.margenCM < 20
                                    ? "var(--danger-muted-foreground)"
                                    : m.economic.margenCM < 30
                                      ? "var(--warning-muted-foreground)"
                                      : "var(--success-muted-foreground)",
                                }}
                              >
                                {m.economic.ventas > 0
                                  ? formatPct(m.economic.margenCM)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-mono text-xs font-bold bg-muted/30">
                              {formatPct(annualData.totals.economic.margenCM)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Financial Grid */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 py-3 bg-muted/30 border-b border-border">
                      <h3 className="font-semibold text-foreground">
                        Estado Financiero — {annualData.year}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Por fecha de acreditación
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-card z-10 min-w-[140px] text-xs uppercase text-muted-foreground">
                              Concepto
                            </TableHead>
                            {annualData.months.map((m: any) => (
                              <TableHead
                                key={m.month}
                                className="text-right min-w-[90px] text-xs uppercase text-muted-foreground"
                              >
                                {m.name}
                              </TableHead>
                            ))}
                            <TableHead className="text-right min-w-[100px] bg-muted/30 font-bold text-xs uppercase text-muted-foreground">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Cobranzas */}
                          <TableRow className="hover:bg-muted/40">
                            <TableCell
                              className="font-medium sticky left-0 bg-card"
                              style={{ color: "var(--success-muted-foreground)" }}
                            >
                              (+) Cobranzas
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm"
                                style={{ color: m.financial.cobranzas > 0 ? "var(--success-muted-foreground)" : undefined }}
                              >
                                {m.financial.cobranzas > 0
                                  ? formatCurrency(m.financial.cobranzas)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell
                              className="text-right font-mono font-bold bg-muted/30"
                              style={{ color: "var(--success-muted-foreground)" }}
                            >
                              {formatCurrency(annualData.totals.financial.cobranzas)}
                            </TableCell>
                          </TableRow>

                          {/* Pagos */}
                          <TableRow className="hover:bg-muted/40">
                            <TableCell
                              className="font-medium sticky left-0 bg-card"
                              style={{ color: "var(--danger-muted-foreground)" }}
                            >
                              (-) Pagos
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm"
                                style={{ color: m.financial.pagos > 0 ? "var(--danger-muted-foreground)" : undefined }}
                              >
                                {m.financial.pagos > 0
                                  ? formatCurrency(m.financial.pagos)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell
                              className="text-right font-mono font-bold bg-muted/30"
                              style={{ color: "var(--danger-muted-foreground)" }}
                            >
                              {formatCurrency(annualData.totals.financial.pagos)}
                            </TableCell>
                          </TableRow>

                          {/* Superávit */}
                          <TableRow className="border-t-2 hover:bg-muted/40">
                            <TableCell className="font-bold sticky left-0 bg-card">
                              = Resultado
                            </TableCell>
                            {annualData.months.map((m: any) => (
                              <TableCell
                                key={m.month}
                                className="text-right font-mono text-sm font-bold"
                                style={{
                                  color: m.financial.superavit >= 0
                                    ? "var(--success-muted-foreground)"
                                    : "var(--danger-muted-foreground)",
                                }}
                              >
                                {m.financial.superavit !== 0
                                  ? formatCurrency(m.financial.superavit)
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell
                              className="text-right font-mono font-bold bg-muted/30"
                              style={{
                                color: annualData.totals.financial.superavit >= 0
                                  ? "var(--success-muted-foreground)"
                                  : "var(--danger-muted-foreground)",
                              }}
                            >
                              {formatCurrency(annualData.totals.financial.superavit)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
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
