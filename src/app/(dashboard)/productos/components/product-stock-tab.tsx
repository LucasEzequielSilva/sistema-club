"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const MOVEMENT_LABELS: Record<string, string> = {
  initial: "Stock inicial",
  purchase: "Compra",
  sale: "Venta",
  merchandise_entry: "Ingreso mercadería",
  adjustment: "Ajuste",
};

const MOVEMENT_COLORS: Record<string, string> = {
  initial: "bg-blue-100 text-blue-700",
  purchase: "bg-green-100 text-green-700",
  sale: "bg-red-100 text-red-700",
  merchandise_entry: "bg-purple-100 text-purple-700",
  adjustment: "bg-amber-100 text-amber-700",
};

interface ProductStockTabProps {
  product: {
    initialStock: number;
    minStock: number;
    currentStock: number;
    isLowStock: boolean;
    valuedStock: number;
    unitCost: number;
    stockMovements: Array<{
      id: string;
      movementType: string;
      quantity: number;
      unitCost: number | null;
      movementDate: Date;
      notes: string | null;
      referenceType: string | null;
    }>;
  };
}

export function ProductStockTab({ product }: ProductStockTabProps) {
  return (
    <div className="space-y-6">
      {/* Stock Summary */}
      <div className="border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Resumen de Stock</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Stock Actual</p>
            <p
              className={`text-2xl font-bold ${product.isLowStock ? "text-red-500" : ""}`}
            >
              {product.currentStock}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Stock Inicial</p>
            <p className="text-2xl font-bold">{product.initialStock}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Stock Mínimo</p>
            <p className="text-2xl font-bold">{product.minStock}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Stock Valuado</p>
            <p className="text-2xl font-bold">
              {formatCurrency(product.valuedStock)}
            </p>
            <p className="text-xs text-gray-400">
              {product.currentStock} x {formatCurrency(product.unitCost)}
            </p>
          </div>
        </div>

        {product.isLowStock && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            El stock actual ({product.currentStock}) está por debajo del mínimo
            ({product.minStock}).
          </div>
        )}
      </div>

      {/* Stock Movements */}
      <div className="border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">
          Movimientos de Stock
          <span className="text-sm font-normal text-gray-500 ml-2">
            (últimos 50)
          </span>
        </h3>

        {product.stockMovements.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No hay movimientos de stock registrados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo Unit.</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.stockMovements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">
                    {formatDate(m.movementDate)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        MOVEMENT_COLORS[m.movementType] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {MOVEMENT_LABELS[m.movementType] || m.movementType}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span
                      className={
                        m.quantity > 0 ? "text-green-600" : "text-red-500"
                      }
                    >
                      {m.quantity > 0 ? "+" : ""}
                      {m.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {m.unitCost !== null ? formatCurrency(m.unitCost) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
                    {m.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
