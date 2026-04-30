"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAccountId } from "@/hooks/use-account-id";

interface SaleDetailProps {
  saleId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-700" },
  partial: { label: "Parcial", className: "bg-blue-100 text-blue-700" },
  paid: { label: "Cobrado", className: "bg-green-100 text-green-700" },
  overdue: { label: "Vencido", className: "bg-red-100 text-red-700" },
};

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

type PaymentMethod = { id: string; name: string; accreditationDays: number };

type SaleData = {
  id: string;
  accountId: string;
  productId: string;
  categoryId: string;
  saleDate: Date;
  origin: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  discountPct: number;
  invoiced: boolean;
  invoiceNumber: string | null;
  status: string;
  dueDate: Date | null;
  notes: string | null;
  createdAt: Date;
  product: { id: string; name: string; unit: string };
  category: { id: string; name: string };
  priceList: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  seller: { id: string; displayName: string | null } | null;
  account: { taxStatus: string; ivaRate: number; includeIvaInCost: boolean };
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: Date;
    accreditationDate: Date | null;
    notes: string | null;
    paymentMethod: {
      id: string;
      name: string;
      accreditationDays: number;
    };
  }>;
  subtotal: number;
  ivaAmount: number;
  total: number;
  variableCostTotal: number;
  contributionMargin: number;
  marginPct: number;
  totalPaid: number;
  pendingAmount: number;
};

export function SaleDetail({ saleId, onBack, onEdit, onRefresh }: SaleDetailProps) {
  const { accountId } = useAccountId();
  const [sale, setSale] = useState<SaleData | null>(null);
  const [loading, setLoading] = useState(true);

  // Add payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethodId: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  const loadSale = () => {
    setLoading(true);
    trpc.ventas.getById
      .query({ id: saleId })
      .then((s) => setSale(s as any))
      .catch(() => toast.error("No se pudo cargar la venta"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSale();
  }, [saleId]);

  // Load payment methods when dialog opens
  useEffect(() => {
    if (!showPaymentDialog || !accountId) return;
    trpc.clasificaciones.listPaymentMethods
      .query()
      .then((methods: any[]) =>
        setPaymentMethods(
          methods
            .filter((m: any) => m.isActive)
            .map((m: any) => ({
              id: m.id,
              name: m.name,
              accreditationDays: m.accreditationDays,
            }))
        )
      )
      .catch(() => {});

    // Pre-fill amount with pending
    if (sale) {
      setPaymentForm({
        paymentMethodId: "",
        amount: String(sale.pendingAmount.toFixed(2)),
        paymentDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
    }
  }, [showPaymentDialog]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.paymentMethodId) {
      toast.error("Seleccioná un método de pago");
      return;
    }
    setPaymentLoading(true);
    try {
      await trpc.ventas.addPayment.mutate({
        saleId,
        paymentMethodId: paymentForm.paymentMethodId,
        amount: parseFloat(paymentForm.amount),
        paymentDate: new Date(paymentForm.paymentDate),
        notes: paymentForm.notes || undefined,
      });
      toast.success("Cobro registrado");
      setShowPaymentDialog(false);
      loadSale();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar cobro");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRemovePayment = async (paymentId: string) => {
    if (!confirm("¿Eliminar este cobro?")) return;
    try {
      await trpc.ventas.removePayment.mutate({ paymentId });
      toast.success("Cobro eliminado");
      loadSale();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar cobro");
    }
  };

  if (loading || !sale) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack}>
          &larr; Volver
        </Button>
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[sale.status] || STATUS_CONFIG.pending;
  const isRI = sale.account.taxStatus === "responsable_inscripto";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="mb-3"
          >
            &larr; Volver a Ventas
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Venta #{sale.id.slice(-6)}
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${cfg.className}`}
            >
              {cfg.label}
            </span>
          </h1>
          <div className="flex gap-4 text-sm text-gray-500 mt-1">
            <span>{formatDate(sale.saleDate)}</span>
            <span>{sale.origin === "mayorista" ? "Mayorista" : "Minorista"}</span>
            {sale.priceList && <span>Lista: {sale.priceList.name}</span>}
            {sale.invoiced && (
              <span>
                Facturada
                {sale.invoiceNumber && ` #${sale.invoiceNumber}`}
              </span>
            )}
          </div>
        </div>
        <Button onClick={() => onEdit(sale.id)}>Editar</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{formatCurrency(sale.total)}</p>
          {isRI && (
            <p className="text-xs text-gray-400">
              Neto: {formatCurrency(sale.subtotal)} + IVA:{" "}
              {formatCurrency(sale.ivaAmount)}
            </p>
          )}
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Cobrado</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(sale.totalPaid)}
          </p>
          <p className="text-xs text-gray-400">
            Pendiente: {formatCurrency(sale.pendingAmount)}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Contribución Marginal</p>
          <p
            className={`text-2xl font-bold ${
              sale.marginPct < 20
                ? "text-red-500"
                : sale.marginPct < 30
                  ? "text-amber-500"
                  : "text-green-600"
            }`}
          >
            {formatCurrency(sale.contributionMargin)}
          </p>
          <p className="text-xs text-gray-400">
            Margen: {sale.marginPct.toFixed(1)}%
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Costo Variable</p>
          <p className="text-2xl font-bold">
            {formatCurrency(sale.variableCostTotal)}
          </p>
          <p className="text-xs text-gray-400">
            {sale.quantity} x {formatCurrency(sale.unitCost)}
          </p>
        </div>
      </div>

      {/* Product & Client Info */}
      <div className="border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Detalle de la Venta</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Producto:</span>{" "}
            <span className="font-medium">{sale.product.name}</span>
          </div>
          <div>
            <span className="text-gray-500">Categoría:</span>{" "}
            <span className="font-medium">{sale.category.name}</span>
          </div>
          <div>
            <span className="text-gray-500">Cliente:</span>{" "}
            <span className="font-medium">
              {sale.client?.name || "Sin cliente"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Vendedor:</span>{" "}
            <span className="font-medium">
              {sale.seller?.displayName || "Sin vendedor"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Cantidad:</span>{" "}
            <span className="font-medium">
              {sale.quantity} {sale.product.unit}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Precio Unitario:</span>{" "}
            <span className="font-medium font-mono">
              {formatCurrency(sale.unitPrice)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Descuento:</span>{" "}
            <span className="font-medium">{sale.discountPct}%</span>
          </div>
          {sale.dueDate && (
            <div>
              <span className="text-gray-500">Vencimiento:</span>{" "}
              <span className="font-medium">{formatDate(sale.dueDate)}</span>
            </div>
          )}
          {sale.notes && (
            <div className="col-span-2">
              <span className="text-gray-500">Notas:</span>{" "}
              <span className="font-medium">{sale.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Cobros ({sale.payments.length})
          </h3>
          {sale.status !== "paid" && (
            <Button
              size="sm"
              onClick={() => setShowPaymentDialog(true)}
            >
              + Agregar Cobro
            </Button>
          )}
        </div>

        {sale.payments.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No hay cobros registrados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha Pago</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Acreditación</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">
                    {formatDate(p.paymentDate)}
                  </TableCell>
                  <TableCell>{p.paymentMethod.name}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {p.accreditationDate
                      ? formatDate(p.accreditationDate)
                      : "—"}
                    {p.paymentMethod.accreditationDays > 0 && (
                      <span className="text-xs text-gray-400 ml-1">
                        (+{p.paymentMethod.accreditationDays}d)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-[150px] truncate">
                    {p.notes || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 border-red-300 hover:bg-red-50"
                      onClick={() => handleRemovePayment(p.id)}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Payment summary */}
        {sale.payments.length > 0 && (
          <div className="mt-3 pt-3 border-t flex justify-between text-sm">
            <span className="text-gray-500">
              Total cobrado: {formatCurrency(sale.totalPaid)}
            </span>
            <span
              className={
                sale.pendingAmount > 0
                  ? "text-amber-600 font-medium"
                  : "text-green-600 font-medium"
              }
            >
              Pendiente: {formatCurrency(sale.pendingAmount)}
            </span>
          </div>
        )}
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Cobro</DialogTitle>
            <DialogDescription>
              Pendiente: {formatCurrency(sale.pendingAmount)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-4">
            <div>
              <Label>
                Método de Pago <span className="text-red-500">*</span>
              </Label>
              <Select
                value={paymentForm.paymentMethodId || "none"}
                onValueChange={(v) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentMethodId: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar...</SelectItem>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.accreditationDays > 0 &&
                        ` (+${m.accreditationDays}d)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="paymentAmount">Monto</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="paymentDate">Fecha</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      paymentDate: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="paymentNotes">Notas</Label>
              <Input
                id="paymentNotes"
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Opcional..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPaymentDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={paymentLoading}>
                {paymentLoading ? "Guardando..." : "Registrar Cobro"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
