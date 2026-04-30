"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
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

interface PurchaseDetailProps {
  purchaseId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-700" },
  partial: { label: "Parcial", className: "bg-blue-100 text-blue-700" },
  paid: { label: "Pagado", className: "bg-green-100 text-green-700" },
  overdue: { label: "Vencido", className: "bg-red-100 text-red-700" },
};

const COST_TYPE_LABELS: Record<string, string> = {
  variable: "Variable",
  fijo: "Fijo",
  impuestos: "Impuestos",
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

type PurchaseData = {
  id: string;
  accountId: string;
  supplierId: string | null;
  productId: string | null;
  costCategoryId: string;
  invoiceDate: Date;
  description: string | null;
  unitCost: number;
  quantity: number;
  discountPct: number;
  ivaAmount: number;
  invoiceNumber: string | null;
  status: string;
  dueDate: Date | null;
  notes: string | null;
  createdAt: Date;
  supplier: { id: string; name: string } | null;
  product: { id: string; name: string; unit: string } | null;
  costCategory: { id: string; name: string; costType: string };
  account: { taxStatus: string; ivaRate: number };
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
  total: number;
  totalPaid: number;
  pendingAmount: number;
};

export function PurchaseDetail({
  purchaseId,
  onBack,
  onEdit,
  onRefresh,
}: PurchaseDetailProps) {
  const { accountId } = useAccountId();
  const [purchase, setPurchase] = useState<PurchaseData | null>(null);
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

  const loadPurchase = () => {
    setLoading(true);
    trpc.compras.getById
      .query({ id: purchaseId })
      .then((p) => setPurchase(p as any))
      .catch(() => toast.error("No se pudo cargar la compra"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPurchase();
  }, [purchaseId]);

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
    if (purchase) {
      setPaymentForm({
        paymentMethodId: "",
        amount: String(purchase.pendingAmount.toFixed(2)),
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
      await trpc.compras.addPayment.mutate({
        purchaseId,
        paymentMethodId: paymentForm.paymentMethodId,
        amount: parseFloat(paymentForm.amount),
        paymentDate: new Date(paymentForm.paymentDate),
        notes: paymentForm.notes || undefined,
      });
      toast.success("Pago registrado");
      setShowPaymentDialog(false);
      loadPurchase();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar pago");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRemovePayment = async (paymentId: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    try {
      await trpc.compras.removePayment.mutate({ paymentId });
      toast.success("Pago eliminado");
      loadPurchase();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar pago");
    }
  };

  if (loading || !purchase) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack}>
          &larr; Volver
        </Button>
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[purchase.status] || STATUS_CONFIG.pending;
  const conceptLabel =
    purchase.product?.name || purchase.description || "Sin concepto";

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
            &larr; Volver a Compras
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Compra #{purchase.id.slice(-6)}
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${cfg.className}`}
            >
              {cfg.label}
            </span>
          </h1>
          <div className="flex gap-4 text-sm text-gray-500 mt-1">
            <span>{formatDate(purchase.invoiceDate)}</span>
            <span>
              {COST_TYPE_LABELS[purchase.costCategory.costType] ||
                purchase.costCategory.costType}
            </span>
            <span>{purchase.costCategory.name}</span>
            {purchase.invoiceNumber && (
              <span>Fact. #{purchase.invoiceNumber}</span>
            )}
          </div>
        </div>
        <Button onClick={() => onEdit(purchase.id)}>Editar</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{formatCurrency(purchase.total)}</p>
          <p className="text-xs text-gray-400">
            Neto: {formatCurrency(purchase.subtotal)} + IVA:{" "}
            {formatCurrency(purchase.ivaAmount)}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Pagado</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(purchase.totalPaid)}
          </p>
          <p className="text-xs text-gray-400">
            Pendiente: {formatCurrency(purchase.pendingAmount)}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Concepto</p>
          <p className="text-lg font-bold truncate">{conceptLabel}</p>
          {purchase.product && (
            <p className="text-xs text-gray-400">
              {purchase.quantity} {purchase.product.unit}
            </p>
          )}
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Proveedor</p>
          <p className="text-lg font-bold truncate">
            {purchase.supplier?.name || "Sin proveedor"}
          </p>
          {purchase.dueDate && (
            <p className="text-xs text-gray-400">
              Vence: {formatDate(purchase.dueDate)}
            </p>
          )}
        </div>
      </div>

      {/* Purchase Detail Info */}
      <div className="border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Detalle de la Compra</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Producto:</span>{" "}
            <span className="font-medium">
              {purchase.product?.name || "N/A (gasto)"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Categoría:</span>{" "}
            <span className="font-medium">{purchase.costCategory.name}</span>
          </div>
          <div>
            <span className="text-gray-500">Proveedor:</span>{" "}
            <span className="font-medium">
              {purchase.supplier?.name || "Sin proveedor"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Tipo de Costo:</span>{" "}
            <span className="font-medium">
              {COST_TYPE_LABELS[purchase.costCategory.costType] ||
                purchase.costCategory.costType}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Cantidad:</span>{" "}
            <span className="font-medium">
              {purchase.quantity}
              {purchase.product && ` ${purchase.product.unit}`}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Costo Unitario:</span>{" "}
            <span className="font-medium font-mono">
              {formatCurrency(purchase.unitCost)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Descuento:</span>{" "}
            <span className="font-medium">{purchase.discountPct}%</span>
          </div>
          <div>
            <span className="text-gray-500">IVA:</span>{" "}
            <span className="font-medium font-mono">
              {formatCurrency(purchase.ivaAmount)}
            </span>
          </div>
          {purchase.description && (
            <div className="col-span-2">
              <span className="text-gray-500">Descripción:</span>{" "}
              <span className="font-medium">{purchase.description}</span>
            </div>
          )}
          {purchase.dueDate && (
            <div>
              <span className="text-gray-500">Vencimiento:</span>{" "}
              <span className="font-medium">
                {formatDate(purchase.dueDate)}
              </span>
            </div>
          )}
          {purchase.notes && (
            <div className="col-span-2">
              <span className="text-gray-500">Notas:</span>{" "}
              <span className="font-medium">{purchase.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Pagos ({purchase.payments.length})
          </h3>
          {purchase.status !== "paid" && (
            <Button size="sm" onClick={() => setShowPaymentDialog(true)}>
              + Agregar Pago
            </Button>
          )}
        </div>

        {purchase.payments.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No hay pagos registrados.
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
              {purchase.payments.map((p) => (
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
                      : "\u2014"}
                    {p.paymentMethod.accreditationDays > 0 && (
                      <span className="text-xs text-gray-400 ml-1">
                        (+{p.paymentMethod.accreditationDays}d)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-[150px] truncate">
                    {p.notes || "\u2014"}
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
        {purchase.payments.length > 0 && (
          <div className="mt-3 pt-3 border-t flex justify-between text-sm">
            <span className="text-gray-500">
              Total pagado: {formatCurrency(purchase.totalPaid)}
            </span>
            <span
              className={
                purchase.pendingAmount > 0
                  ? "text-amber-600 font-medium"
                  : "text-green-600 font-medium"
              }
            >
              Pendiente: {formatCurrency(purchase.pendingAmount)}
            </span>
          </div>
        )}
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Pago</DialogTitle>
            <DialogDescription>
              Pendiente: {formatCurrency(purchase.pendingAmount)}
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
                {paymentLoading ? "Guardando..." : "Registrar Pago"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
