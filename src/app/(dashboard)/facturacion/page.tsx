"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Receipt, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceDialog } from "./components/invoice-dialog";
import { AfipConfigForm } from "./components/afip-config-form";
import { InvoiceDetail } from "./components/invoice-detail";
import { useAccountId } from "@/hooks/use-account-id";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Invoice = any;

export default function FacturacionPage() {
  const { accountId } = useAccountId();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<number | null>(null);

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadData = () => {
    if (!accountId) return;
    setLoading(true);
    Promise.all([
      trpc.facturacion.list.query({
        accountId,
        ...(typeFilter && { invoiceType: typeFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      }),
      trpc.facturacion.getSummary.query({ accountId }),
    ])
      .then(([invs, sum]) => {
        setInvoices(invs);
        setSummary(sum);
      })
      .catch(() => toast.error("Error cargando facturas"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, typeFilter]);

  const invoiceTypeBadge = (type: number) => {
    switch (type) {
      case 1:
        return (
          <Badge
            className="text-xs font-semibold"
            style={{ backgroundColor: "var(--info-muted)", color: "var(--info-muted-foreground)", border: "none" }}
          >
            A
          </Badge>
        );
      case 6:
        return (
          <Badge
            className="text-xs font-semibold"
            style={{ backgroundColor: "var(--success-muted)", color: "var(--success-muted-foreground)", border: "none" }}
          >
            B
          </Badge>
        );
      case 11:
        return (
          <Badge
            className="text-xs font-semibold"
            style={{ backgroundColor: "var(--warning-muted)", color: "var(--warning-muted-foreground)", border: "none" }}
          >
            C
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const pageActions = (
    <Button onClick={() => setShowCreate(true)} size="sm">
      + Nueva Factura
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        description="Comprobantes electrónicos AFIP"
        icon={Receipt}
        actions={pageActions}
      />

      <Tabs defaultValue="facturas">
        <TabsList className="mb-2">
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="config">Configuración AFIP</TabsTrigger>
        </TabsList>

        {/* ── TAB: Facturas ── */}
        <TabsContent value="facturas" className="space-y-4">
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                title="Total Facturado"
                value={formatCurrency(summary.totalFacturado)}
                variant="default"
              />
              <StatCard
                title="Neto Gravado"
                value={formatCurrency(summary.totalNeto)}
                variant="success"
              />
              <StatCard
                title="IVA"
                value={formatCurrency(summary.totalIva)}
                variant="muted"
              />
              <StatCard
                title="Comprobantes"
                value={String(summary.count)}
                subtitle={[
                  summary.countA > 0 ? `A: ${summary.countA}` : null,
                  summary.countB > 0 ? `B: ${summary.countB}` : null,
                  summary.countC > 0 ? `C: ${summary.countC}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                variant="info"
              />
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
            <Input
              placeholder="Buscar por cliente, documento o CAE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-8"
            />
            <div className="flex gap-1">
              <Button
                variant={typeFilter === null ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setTypeFilter(null)}
              >
                Todas
              </Button>
              <Button
                variant={typeFilter === 1 ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setTypeFilter(1)}
              >
                Fact. A
              </Button>
              <Button
                variant={typeFilter === 6 ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setTypeFilter(6)}
              >
                Fact. B
              </Button>
              <Button
                variant={typeFilter === 11 ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setTypeFilter(11)}
              >
                Fact. C
              </Button>
            </div>
          </div>

          {/* Invoice table */}
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              Cargando facturas...
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-border bg-card">
              <EmptyState
                icon={Receipt}
                title="No hay facturas emitidas"
                description="Configurá AFIP y emití tu primer comprobante electrónico."
                actionLabel="+ Nueva Factura"
                onAction={() => setShowCreate(true)}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-xs uppercase text-muted-foreground">Tipo</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Número</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Fecha</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Cliente</TableHead>
                    <TableHead className="text-right text-xs uppercase text-muted-foreground">Neto</TableHead>
                    <TableHead className="text-right text-xs uppercase text-muted-foreground">IVA</TableHead>
                    <TableHead className="text-right text-xs uppercase text-muted-foreground">Total</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">CAE</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Venta</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: Invoice) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setDetailId(inv.id)}
                    >
                      <TableCell>{invoiceTypeBadge(inv.invoiceType)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {inv.formattedNumber}
                      </TableCell>
                      <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                      <TableCell>
                        {inv.customerName || inv.docTipoName}
                        {inv.docNro !== "0" && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({inv.docNro})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatCurrency(inv.netAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {inv.ivaAmount > 0
                          ? formatCurrency(inv.ivaAmount)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatCurrency(inv.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {inv.cae ? (
                          <span
                            className="font-mono text-xs"
                            style={{ color: "var(--success-muted-foreground)" }}
                          >
                            {inv.cae}
                          </span>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: "var(--danger-muted-foreground)",
                              color: "var(--danger-muted-foreground)",
                            }}
                          >
                            Sin CAE
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {inv.sale ? (
                          <span
                            className="text-xs"
                            style={{ color: "var(--info-muted-foreground)" }}
                          >
                            {inv.sale.product.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Manual</span>
                        )}
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailId(inv.id)}>
                              Ver detalle
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Config AFIP ── */}
        <TabsContent value="config">
          <div className="rounded-xl border border-border bg-card p-5">
            <AfipConfigForm accountId={accountId ?? ""} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Invoice Dialog */}
      <InvoiceDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          loadData();
        }}
        accountId={accountId ?? ""}
      />

      {/* Invoice Detail */}
      {detailId && (
        <InvoiceDetail
          invoiceId={detailId}
          open={!!detailId}
          onOpenChange={(open) => {
            if (!open) setDetailId(null);
          }}
        />
      )}
    </div>
  );
}
