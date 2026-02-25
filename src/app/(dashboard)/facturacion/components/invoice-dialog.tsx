"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
}

type UninvoicedSale = {
  id: string;
  saleDate: string | Date;
  productName: string;
  clientName: string | null;
  clientCuit: string | null;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  subtotal: number;
  origin: string;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

const DOC_TYPES = [
  { value: "99", label: "Consumidor Final (Sin identificar)" },
  { value: "80", label: "CUIT" },
  { value: "86", label: "CUIL" },
  { value: "96", label: "DNI" },
];

const INVOICE_TYPE_NAMES: Record<number, string> = {
  1: "Factura A",
  6: "Factura B",
  11: "Factura C",
};

export function InvoiceDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
}: InvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Mode: from sale or manual
  const [mode, setMode] = useState<"sale" | "manual">("sale");
  const [uninvoicedSales, setUninvoicedSales] = useState<UninvoicedSale[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");

  // Account info
  const [taxStatus, setTaxStatus] = useState("");
  const [ivaRate, setIvaRate] = useState(21);

  // Form fields
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [docTipo, setDocTipo] = useState("99"); // Sin identificar
  const [docNro, setDocNro] = useState("");
  const [customerName, setCustomerName] = useState("");

  // Amounts (auto-filled from sale or manual)
  const [netAmount, setNetAmount] = useState("0");
  const [ivaAmount, setIvaAmount] = useState("0");
  const [totalAmount, setTotalAmount] = useState("0");

  // Derived invoice type
  const [invoiceType, setInvoiceType] = useState(0);
  const [invoiceTypeName, setInvoiceTypeName] = useState("");

  // Load uninvoiced sales
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    Promise.all([
      trpc.facturacion.getUninvoicedSales.query({ accountId }),
      trpc.facturacion.getInvoiceTypeForAccount.query({
        accountId,
        docTipo: parseInt(docTipo),
      }),
    ])
      .then(([sales, typeInfo]) => {
        setUninvoicedSales(sales as UninvoicedSale[]);
        setInvoiceType(typeInfo.invoiceType);
        setInvoiceTypeName(typeInfo.invoiceTypeName);
        setTaxStatus(typeInfo.taxStatus);
        setIvaRate(typeInfo.ivaRate);
      })
      .catch(() => toast.error("Error cargando datos"))
      .finally(() => setLoading(false));
  }, [open, accountId, docTipo]);

  // Update invoice type when docTipo changes
  useEffect(() => {
    if (!open) return;
    trpc.facturacion.getInvoiceTypeForAccount
      .query({ accountId, docTipo: parseInt(docTipo) })
      .then((info) => {
        setInvoiceType(info.invoiceType);
        setInvoiceTypeName(info.invoiceTypeName);
      })
      .catch(() => {});
  }, [docTipo, accountId, open]);

  // When a sale is selected, auto-fill amounts
  useEffect(() => {
    if (!selectedSaleId) {
      if (mode === "sale") {
        setNetAmount("0");
        setIvaAmount("0");
        setTotalAmount("0");
        setCustomerName("");
        setDocNro("");
      }
      return;
    }

    const sale = uninvoicedSales.find((s) => s.id === selectedSaleId);
    if (!sale) return;

    const subtotal = sale.subtotal;

    // For RI accounts, IVA is calculated on subtotal
    const isRI = taxStatus === "responsable_inscripto";
    const iva = isRI ? Math.round(subtotal * (ivaRate / 100) * 100) / 100 : 0;
    const total = Math.round((subtotal + iva) * 100) / 100;

    setNetAmount(String(subtotal));
    setIvaAmount(String(iva));
    setTotalAmount(String(total));

    // Auto-fill customer info from sale
    if (sale.clientName) setCustomerName(sale.clientName);
    if (sale.clientCuit) {
      setDocTipo("80"); // CUIT
      setDocNro(sale.clientCuit);
    }
  }, [selectedSaleId, uninvoicedSales, taxStatus, ivaRate, mode]);

  // When amounts change manually, recalculate total
  useEffect(() => {
    if (mode === "manual") {
      const net = parseFloat(netAmount) || 0;
      const iva = parseFloat(ivaAmount) || 0;
      setTotalAmount(String(Math.round((net + iva) * 100) / 100));
    }
  }, [netAmount, ivaAmount, mode]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setMode("sale");
      setSelectedSaleId("");
      setInvoiceDate(new Date().toISOString().split("T")[0]);
      setDocTipo("99");
      setDocNro("");
      setCustomerName("");
      setNetAmount("0");
      setIvaAmount("0");
      setTotalAmount("0");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const total = parseFloat(totalAmount) || 0;
    if (total <= 0) {
      toast.error("El total debe ser mayor a 0");
      return;
    }

    if (parseInt(docTipo) !== 99 && !docNro) {
      toast.error("Ingresa el numero de documento del cliente");
      return;
    }

    setSubmitting(true);
    try {
      const result = await trpc.facturacion.create.mutate({
        accountId,
        saleId: mode === "sale" && selectedSaleId ? selectedSaleId : null,
        invoiceType,
        concepto: 1, // Products
        invoiceDate: new Date(invoiceDate),
        docTipo: parseInt(docTipo),
        docNro: docNro || "0",
        customerName: customerName || null,
        netAmount: parseFloat(netAmount) || 0,
        exemptAmount: 0,
        ivaAmount: parseFloat(ivaAmount) || 0,
        tributesAmount: 0,
        totalAmount: total,
      });

      toast.success(
        `${invoiceTypeName} ${result.formattedNumber} emitida - CAE: ${result.cae}`
      );
      onSuccess();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al emitir factura";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const net = parseFloat(netAmount) || 0;
  const iva = parseFloat(ivaAmount) || 0;
  const total = parseFloat(totalAmount) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emitir Comprobante</DialogTitle>
          <DialogDescription>
            Emiti una factura electronica a traves de AFIP
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Invoice type badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Tipo:</span>
              <Badge
                className={
                  invoiceType === 1
                    ? "bg-blue-100 text-blue-800"
                    : invoiceType === 6
                      ? "bg-green-100 text-green-800"
                      : "bg-purple-100 text-purple-800"
                }
              >
                {invoiceTypeName || "..."}
              </Badge>
              <span className="text-xs text-gray-400">
                (determinado por regimen y tipo de cliente)
              </span>
            </div>

            {/* Mode selector */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "sale" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode("sale");
                  setNetAmount("0");
                  setIvaAmount("0");
                  setTotalAmount("0");
                }}
              >
                Desde una Venta
              </Button>
              <Button
                type="button"
                variant={mode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode("manual");
                  setSelectedSaleId("");
                }}
              >
                Manual
              </Button>
            </div>

            {/* Sale selector */}
            {mode === "sale" && (
              <div>
                <Label>Venta sin facturar</Label>
                <Select
                  value={selectedSaleId || "none"}
                  onValueChange={(v) =>
                    setSelectedSaleId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar venta..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleccionar...</SelectItem>
                    {uninvoicedSales.map((sale) => (
                      <SelectItem key={sale.id} value={sale.id}>
                        {sale.productName} - {formatCurrency(sale.subtotal)} (
                        {new Date(sale.saleDate).toLocaleDateString("es-AR")})
                        {sale.clientName ? ` - ${sale.clientName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {uninvoicedSales.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    No hay ventas sin facturar
                  </p>
                )}
              </div>
            )}

            {/* Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoiceDate">
                  Fecha de Emision <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Customer */}
            <div className="space-y-3">
              <div className="font-semibold text-sm">Datos del Cliente</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Documento</Label>
                  <Select value={docTipo} onValueChange={setDocTipo}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((dt) => (
                        <SelectItem key={dt.value} value={dt.value}>
                          {dt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {docTipo !== "99" && (
                  <div>
                    <Label htmlFor="docNro">
                      Numero de Documento{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="docNro"
                      value={docNro}
                      onChange={(e) => setDocNro(e.target.value)}
                      placeholder={
                        docTipo === "80"
                          ? "20409378472"
                          : docTipo === "96"
                            ? "12345678"
                            : ""
                      }
                    />
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="customerName">
                  Nombre / Razon Social
                </Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Amounts */}
            <div className="space-y-3">
              <div className="font-semibold text-sm">Importes</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="netAmount">Neto Gravado</Label>
                  <Input
                    id="netAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={netAmount}
                    onChange={(e) => setNetAmount(e.target.value)}
                    disabled={mode === "sale" && !!selectedSaleId}
                  />
                </div>
                <div>
                  <Label htmlFor="ivaAmount">IVA</Label>
                  <Input
                    id="ivaAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={ivaAmount}
                    onChange={(e) => setIvaAmount(e.target.value)}
                    disabled={mode === "sale" && !!selectedSaleId}
                  />
                </div>
                <div>
                  <Label htmlFor="totalAmount">Total</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={totalAmount}
                    className="font-bold"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2">
              <div className="font-semibold">Resumen del Comprobante</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-gray-500">Tipo:</span>
                <span className="font-medium">
                  {INVOICE_TYPE_NAMES[invoiceType] || "..."}
                </span>
                <span className="text-gray-500">Neto:</span>
                <span className="font-mono">{formatCurrency(net)}</span>
                {iva > 0 && (
                  <>
                    <span className="text-gray-500">IVA:</span>
                    <span className="font-mono">{formatCurrency(iva)}</span>
                  </>
                )}
                <span className="text-gray-500 font-semibold">Total:</span>
                <span className="font-mono font-bold">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || total <= 0}>
                {submitting ? "Emitiendo..." : "Emitir Comprobante"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
