"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { InvoiceDialog } from "./components/invoice-dialog";
import { AfipConfigForm } from "./components/afip-config-form";
import { InvoiceDetail } from "./components/invoice-detail";

const ACCOUNT_ID = "test-account-id";

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
    setLoading(true);
    Promise.all([
      trpc.facturacion.list.query({
        accountId: ACCOUNT_ID,
        ...(typeFilter && { invoiceType: typeFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      }),
      trpc.facturacion.getSummary.query({ accountId: ACCOUNT_ID }),
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
        return <Badge className="bg-blue-100 text-blue-800">A</Badge>;
      case 6:
        return <Badge className="bg-green-100 text-green-800">B</Badge>;
      case 11:
        return <Badge className="bg-purple-100 text-purple-800">C</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Facturacion Electronica</h1>
          <p className="text-sm text-gray-400 mt-1">
            Emision de comprobantes via AFIP
          </p>
        </div>
      </div>

      <Tabs defaultValue="facturas">
        <TabsList>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="config">Configuracion AFIP</TabsTrigger>
        </TabsList>

        {/* ── TAB: Facturas ── */}
        <TabsContent value="facturas" className="space-y-4">
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border p-4">
                <div className="text-xs text-gray-500 uppercase">
                  Total Facturado
                </div>
                <div className="text-xl font-bold mt-1">
                  {formatCurrency(summary.totalFacturado)}
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="text-xs text-gray-500 uppercase">
                  Neto Gravado
                </div>
                <div className="text-xl font-bold mt-1">
                  {formatCurrency(summary.totalNeto)}
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="text-xs text-gray-500 uppercase">IVA</div>
                <div className="text-xl font-bold mt-1">
                  {formatCurrency(summary.totalIva)}
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="text-xs text-gray-500 uppercase">
                  Comprobantes
                </div>
                <div className="text-xl font-bold mt-1">{summary.count}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {summary.countA > 0 && `A: ${summary.countA} `}
                  {summary.countB > 0 && `B: ${summary.countB} `}
                  {summary.countC > 0 && `C: ${summary.countC}`}
                </div>
              </div>
            </div>
          )}

          {/* Filters + New button */}
          <div className="flex items-center gap-3">
            <Input
              placeholder="Buscar por cliente, documento o CAE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex gap-1">
              <Button
                variant={typeFilter === null ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(null)}
              >
                Todas
              </Button>
              <Button
                variant={typeFilter === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(1)}
              >
                Fact. A
              </Button>
              <Button
                variant={typeFilter === 6 ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(6)}
              >
                Fact. B
              </Button>
              <Button
                variant={typeFilter === 11 ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(11)}
              >
                Fact. C
              </Button>
            </div>
            <div className="flex-1" />
            <Button onClick={() => setShowCreate(true)}>
              + Nueva Factura
            </Button>
          </div>

          {/* Invoice table */}
          {loading ? (
            <div className="py-12 text-center text-gray-400">
              Cargando facturas...
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              No hay facturas emitidas.
              <br />
              <span className="text-sm">
                Configura AFIP y emiti tu primer comprobante.
              </span>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Tipo</TableHead>
                    <TableHead>Numero</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>CAE</TableHead>
                    <TableHead>Venta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: Invoice) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-gray-50"
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
                          <span className="text-xs text-gray-400 ml-1">
                            ({inv.docNro})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(inv.netAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {inv.ivaAmount > 0
                          ? formatCurrency(inv.ivaAmount)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(inv.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {inv.cae ? (
                          <span className="font-mono text-xs text-green-700">
                            {inv.cae}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-red-500">
                            Sin CAE
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {inv.sale ? (
                          <span className="text-xs text-blue-600">
                            {inv.sale.product.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Manual</span>
                        )}
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
          <AfipConfigForm accountId={ACCOUNT_ID} />
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
        accountId={ACCOUNT_ID}
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
