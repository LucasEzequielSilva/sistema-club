"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingCart } from "lucide-react";

interface ProductPurchasesTabProps {
  productId: string;
}

type Purchase = {
  id: string;
  invoiceDate: string;
  invoiceNumber: string | null;
  quantity: number;
  unitCost: number;
  discountPct: number;
  ivaAmount: number;
  status: string;
  notes: string | null;
  supplier: { id: string; name: string } | null;
  costCategory: { id: string; name: string };
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagada",
  overdue: "Vencida",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  partial: "secondary",
  paid: "default",
  overdue: "destructive",
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

export function ProductPurchasesTab({ productId }: ProductPurchasesTabProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/productos/purchases?productId=${productId}`)
      .then((r) => r.json())
      .then((data) => setPurchases(Array.isArray(data) ? data : []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <ShoppingCart className="w-10 h-10 opacity-20" />
        <p className="text-sm">No hay compras registradas para este producto.</p>
        <p className="text-xs opacity-60">
          Cuando registres una compra con este producto, aparecerá aquí.
        </p>
      </div>
    );
  }

  // Calcular totales
  const totalQty = purchases.reduce((s, p) => s + p.quantity, 0);
  const totalGastado = purchases.reduce((s, p) => {
    const subtotal = p.unitCost * p.quantity * (1 - p.discountPct / 100);
    return s + subtotal + p.ivaAmount;
  }, 0);
  const costoPromedio =
    totalQty > 0
      ? purchases.reduce((s, p) => s + p.unitCost * p.quantity, 0) / totalQty
      : 0;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">Total compras</p>
          <p className="text-xl font-bold">{purchases.length}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">Costo promedio</p>
          <p className="text-xl font-bold">{formatCurrency(costoPromedio)}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">Total invertido</p>
          <p className="text-xl font-bold">{formatCurrency(totalGastado)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase text-muted-foreground">Fecha</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Proveedor</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">N° Factura</TableHead>
              <TableHead className="text-right text-xs uppercase text-muted-foreground">Cant.</TableHead>
              <TableHead className="text-right text-xs uppercase text-muted-foreground">Precio unit.</TableHead>
              <TableHead className="text-right text-xs uppercase text-muted-foreground">IVA</TableHead>
              <TableHead className="text-right text-xs uppercase text-muted-foreground">Subtotal</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((p) => {
              const subtotal =
                p.unitCost * p.quantity * (1 - p.discountPct / 100) + p.ivaAmount;
              return (
                <TableRow key={p.id} className="text-sm hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">
                    {formatDate(p.invoiceDate)}
                  </TableCell>
                  <TableCell>
                    {p.supplier?.name ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.invoiceNumber ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {p.quantity}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(p.unitCost)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground text-xs">
                    {p.ivaAmount > 0 ? formatCurrency(p.ivaAmount) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(subtotal)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[p.status] ?? "outline"} className="text-xs">
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
