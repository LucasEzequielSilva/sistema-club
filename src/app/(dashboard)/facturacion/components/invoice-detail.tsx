"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface InvoiceDetailProps {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function InvoiceDetail({
  invoiceId,
  open,
  onOpenChange,
}: InvoiceDetailProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !invoiceId) return;
    setLoading(true);
    trpc.facturacion.getById
      .query({ id: invoiceId })
      .then((inv) => setInvoice(inv))
      .catch(() => toast.error("Error cargando factura"))
      .finally(() => setLoading(false));
  }, [open, invoiceId]);

  const invoiceTypeBadge = (type: number) => {
    switch (type) {
      case 1:
        return (
          <Badge className="bg-blue-100 text-blue-800 text-lg px-3 py-1">
            Factura A
          </Badge>
        );
      case 6:
        return (
          <Badge className="bg-green-100 text-green-800 text-lg px-3 py-1">
            Factura B
          </Badge>
        );
      case 11:
        return (
          <Badge className="bg-purple-100 text-purple-800 text-lg px-3 py-1">
            Factura C
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de Comprobante</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Cargando...</div>
        ) : !invoice ? (
          <div className="py-8 text-center text-gray-400">
            Factura no encontrada
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              {invoiceTypeBadge(invoice.invoiceType)}
              <div className="text-right">
                <div className="text-2xl font-mono font-bold">
                  {invoice.formattedNumber}
                </div>
                <div className="text-sm text-gray-400">
                  {formatDate(invoice.invoiceDate)}
                </div>
              </div>
            </div>

            {/* Emisor */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <div className="font-semibold mb-2">Emisor</div>
              <div className="text-gray-600">
                {invoice.account?.name || "---"}
              </div>
              <div className="text-gray-400 text-xs">
                {invoice.account?.taxStatus === "responsable_inscripto"
                  ? "Responsable Inscripto"
                  : "Monotributista"}
              </div>
            </div>

            {/* Cliente */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <div className="font-semibold mb-2">Cliente</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-500">Nombre:</span>
                <span>{invoice.customerName || "Consumidor Final"}</span>
                <span className="text-gray-500">Documento:</span>
                <span>
                  {invoice.docTipoName}
                  {invoice.docNro !== "0" && `: ${invoice.docNro}`}
                </span>
              </div>
            </div>

            {/* Amounts */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <div className="font-semibold mb-2">Importes</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-500">Neto Gravado:</span>
                <span className="font-mono text-right">
                  {formatCurrency(invoice.netAmount)}
                </span>
                {invoice.exemptAmount > 0 && (
                  <>
                    <span className="text-gray-500">Exento:</span>
                    <span className="font-mono text-right">
                      {formatCurrency(invoice.exemptAmount)}
                    </span>
                  </>
                )}
                {invoice.ivaAmount > 0 && (
                  <>
                    <span className="text-gray-500">IVA:</span>
                    <span className="font-mono text-right">
                      {formatCurrency(invoice.ivaAmount)}
                    </span>
                  </>
                )}
                {invoice.tributesAmount > 0 && (
                  <>
                    <span className="text-gray-500">Tributos:</span>
                    <span className="font-mono text-right">
                      {formatCurrency(invoice.tributesAmount)}
                    </span>
                  </>
                )}
                <span className="text-gray-600 font-semibold border-t pt-2">
                  Total:
                </span>
                <span className="font-mono text-right font-bold text-lg border-t pt-2">
                  {formatCurrency(invoice.totalAmount)}
                </span>
              </div>
            </div>

            {/* AFIP Data */}
            <div
              className={`rounded-lg p-4 text-sm ${
                invoice.cae
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="font-semibold mb-2">Datos AFIP</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-500">CAE:</span>
                <span className="font-mono font-bold">
                  {invoice.cae || "Sin CAE"}
                </span>
                <span className="text-gray-500">Vencimiento CAE:</span>
                <span className="font-mono">
                  {invoice.caeExpiration
                    ? formatDate(invoice.caeExpiration)
                    : "-"}
                </span>
                <span className="text-gray-500">Resultado:</span>
                <span>
                  {invoice.afipResult === "A" ? (
                    <Badge className="bg-green-100 text-green-800">
                      Aprobado
                    </Badge>
                  ) : invoice.afipResult === "R" ? (
                    <Badge className="bg-red-100 text-red-800">
                      Rechazado
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendiente</Badge>
                  )}
                </span>
                {invoice.afipObservations && (
                  <>
                    <span className="text-gray-500">Observaciones:</span>
                    <span className="text-orange-600">
                      {invoice.afipObservations}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Linked sale */}
            {invoice.sale && (
              <div className="bg-blue-50 rounded-lg p-4 text-sm">
                <div className="font-semibold mb-2">Venta Asociada</div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-gray-500">Producto:</span>
                  <span>{invoice.sale.product?.name}</span>
                  <span className="text-gray-500">Fecha venta:</span>
                  <span>{formatDate(invoice.sale.saleDate)}</span>
                  <span className="text-gray-500">Cliente:</span>
                  <span>
                    {invoice.sale.client?.name || "Sin cliente"}
                  </span>
                </div>
              </div>
            )}

            {/* Concepto */}
            <div className="text-xs text-gray-400 text-center">
              Concepto:{" "}
              {invoice.concepto === 1
                ? "Productos"
                : invoice.concepto === 2
                  ? "Servicios"
                  : "Productos y Servicios"}{" "}
              | Emitida: {formatDate(invoice.createdAt)}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
