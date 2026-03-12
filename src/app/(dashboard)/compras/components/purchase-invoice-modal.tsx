"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt } from "lucide-react";

interface PurchaseInvoiceModalProps {
  purchaseId: string | null;
  onClose: () => void;
}

type InvoiceData = {
  header: {
    invoiceNumber: string | null;
    invoiceDate: string;
    dueDate: string | null;
    supplier: { id: string; name: string } | null;
    status: string;
    notes: string | null;
  };
  items: Array<{
    id: string;
    concept: string;
    productUnit: string | null;
    costCategory: string;
    quantity: number;
    unitCost: number;
    discountPct: number;
    ivaAmount: number;
    subtotal: number;
    total: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
  }>;
  totals: {
    subtotal: number;
    iva: number;
    total: number;
    paid: number;
    pending: number;
  };
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagada",
  overdue: "Vencida",
};

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  pending: { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" },
  partial: { background: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe" },
  paid: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
  overdue: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PurchaseInvoiceModal({ purchaseId, onClose }: PurchaseInvoiceModalProps) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!purchaseId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/compras/invoice?purchaseId=${purchaseId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [purchaseId]);

  return (
    <Dialog open={!!purchaseId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            {data?.header.invoiceNumber
              ? `Factura ${data.header.invoiceNumber}`
              : "Detalle de Compra"}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && (
          <div className="space-y-5">
            {/* Encabezado */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm rounded-lg border bg-muted/30 p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proveedor:</span>
                <span className="font-medium">{data.header.supplier?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado:</span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={STATUS_STYLES[data.header.status] ?? {}}
                >
                  {STATUS_LABELS[data.header.status] ?? data.header.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha:</span>
                <span className="font-mono">{formatDate(data.header.invoiceDate)}</span>
              </div>
              {data.header.dueDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimiento:</span>
                  <span className="font-mono">{formatDate(data.header.dueDate)}</span>
                </div>
              )}
              {data.header.invoiceNumber && (
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">N° Factura:</span>
                  <span className="font-mono">{data.header.invoiceNumber}</span>
                </div>
              )}
              {data.header.notes && (
                <div className="col-span-2 text-muted-foreground italic text-xs pt-1 border-t">
                  {data.header.notes}
                </div>
              )}
            </div>

            {/* Ítems */}
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wide">
                Ítems
              </p>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Concepto</TableHead>
                      <TableHead className="text-xs">Categoría</TableHead>
                      <TableHead className="text-right text-xs">Cant.</TableHead>
                      <TableHead className="text-right text-xs">P. Unit.</TableHead>
                      <TableHead className="text-right text-xs">IVA</TableHead>
                      <TableHead className="text-right text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id} className="text-sm">
                        <TableCell className="font-medium">
                          {item.concept}
                          {item.productUnit && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({item.productUnit})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {item.costCategory}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.quantity}
                          {item.discountPct > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              -{item.discountPct}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.unitCost)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground text-xs">
                          {item.ivaAmount > 0 ? formatCurrency(item.ivaAmount) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(item.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totales */}
            <div className="flex justify-end">
              <div className="space-y-1.5 text-sm min-w-[220px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatCurrency(data.totals.subtotal)}</span>
                </div>
                {data.totals.iva > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA:</span>
                    <span className="font-mono">{formatCurrency(data.totals.iva)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1.5">
                  <span>Total:</span>
                  <span className="font-mono">{formatCurrency(data.totals.total)}</span>
                </div>
                {data.totals.paid > 0 && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>Pagado:</span>
                      <span className="font-mono">{formatCurrency(data.totals.paid)}</span>
                    </div>
                    {data.totals.pending > 0 && (
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Pendiente:</span>
                        <span className="font-mono">{formatCurrency(data.totals.pending)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Pagos */}
            {data.payments.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wide">
                  Pagos registrados
                </p>
                <div className="space-y-1.5">
                  {data.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-sm rounded-lg border bg-muted/30 px-3 py-2"
                    >
                      <span className="text-muted-foreground">{formatDate(p.paymentDate)}</span>
                      <span>{p.paymentMethod}</span>
                      <span className="font-mono font-semibold text-green-700">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
