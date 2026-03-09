"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductPricingTab } from "./product-pricing-tab";
import { ProductStockTab } from "./product-stock-tab";
import { toast } from "sonner";

interface ProductDetailProps {
  productId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  onRefresh: () => void;
}

const UNIT_LABELS: Record<string, string> = {
  unidad: "Unidad",
  kg: "Kg",
  litro: "Litro",
  metro: "Metro",
  par: "Par",
};

const ORIGIN_LABELS: Record<string, string> = {
  comprado: "Comprado",
  fabricado: "Fabricado",
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

type ProductDetail = {
  id: string;
  accountId: string;
  categoryId: string;
  supplierId: string | null;
  name: string;
  barcode: string | null;
  sku: string | null;
  unit: string;
  origin: string;
  initialStock: number;
  minStock: number;
  acquisitionCost: number;
  rawMaterialCost: number;
  laborCost: number;
  packagingCost: number;
  isActive: boolean;
  lastCostUpdate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string };
  supplier: { id: string; name: string } | null;
  account: {
    id: string;
    taxStatus: string;
    ivaRate: number;
    includeIvaInCost: boolean;
  };
  unitCost: number;
  currentStock: number;
  isLowStock: boolean;
  valuedStock: number;
  pricingByList: Array<{
    priceListId: string;
    priceListName: string;
    isDefault: boolean;
    markupPct: number;
    unitCost: number;
    salePrice: number;
    salePriceWithIva: number | null;
    contributionMargin: number;
    marginPct: number;
  }>;
  stockMovements: Array<{
    id: string;
    movementType: string;
    quantity: number;
    unitCost: number | null;
    movementDate: Date;
    notes: string | null;
    referenceType: string | null;
  }>;
  _count: { sales: number; purchases: number; stockMovements: number };
};

export function ProductDetail({
  productId,
  onBack,
  onEdit,
  onRefresh,
}: ProductDetailProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProduct = () => {
    setLoading(true);
    trpc.productos.getById
      .query({ id: productId })
      .then((p) => setProduct(p as any))
      .catch(() => toast.error("No se pudo cargar el producto"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProduct();
  }, [productId]);

  if (loading || !product) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack}>
          &larr; Volver
        </Button>
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Button variant="outline" size="sm" onClick={onBack} className="mb-3">
            &larr; Volver a Productos
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {product.name}
            {!product.isActive && (
              <Badge variant="secondary">Inactivo</Badge>
            )}
            {product.isLowStock && (
              <Badge variant="destructive">Stock bajo</Badge>
            )}
          </h1>
          <div className="flex gap-4 text-sm text-gray-500 mt-1">
            <span>Categoría: {product.category.name}</span>
            {product.supplier && (
              <span>Proveedor: {product.supplier.name}</span>
            )}
            <span>{ORIGIN_LABELS[product.origin] || product.origin}</span>
            <span>{UNIT_LABELS[product.unit] || product.unit}</span>
            {product.sku && <span>SKU: {product.sku}</span>}
            {product.barcode && <span>Barcode: {product.barcode}</span>}
          </div>
        </div>
        <Button onClick={() => onEdit(product.id)}>Editar</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Costo Unitario</p>
          <p className="text-2xl font-bold">
            {formatCurrency(product.unitCost)}
          </p>
          {product.lastCostUpdate && (
            <p className="text-xs text-gray-400 mt-1">
              Actualizado: {formatDate(product.lastCostUpdate)}
            </p>
          )}
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Stock Actual</p>
          <p
            className={`text-2xl font-bold ${product.isLowStock ? "text-red-500" : ""}`}
          >
            {product.currentStock}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Mínimo: {product.minStock}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Stock Valuado</p>
          <p className="text-2xl font-bold">
            {formatCurrency(product.valuedStock)}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Transacciones</p>
          <p className="text-lg">
            <span className="font-bold">{product._count.sales}</span> ventas /{" "}
            <span className="font-bold">{product._count.purchases}</span>{" "}
            compras
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="pricing">Costos y Precios</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-4">
          <div className="border rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">Detalles del Producto</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Nombre:</span>{" "}
                <span className="font-medium">{product.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Categoría:</span>{" "}
                <span className="font-medium">{product.category.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Proveedor:</span>{" "}
                <span className="font-medium">
                  {product.supplier?.name || "Sin proveedor"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Origen:</span>{" "}
                <span className="font-medium">
                  {ORIGIN_LABELS[product.origin] || product.origin}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Unidad:</span>{" "}
                <span className="font-medium">
                  {UNIT_LABELS[product.unit] || product.unit}
                </span>
              </div>
              <div>
                <span className="text-gray-500">SKU:</span>{" "}
                <span className="font-medium">{product.sku || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500">Código de barras:</span>{" "}
                <span className="font-medium">{product.barcode || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500">Estado:</span>{" "}
                <span className="font-medium">
                  {product.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Creado:</span>{" "}
                <span className="font-medium">
                  {formatDate(product.createdAt)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Actualizado:</span>{" "}
                <span className="font-medium">
                  {formatDate(product.updatedAt)}
                </span>
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">
                Desglose de Costo Unitario
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm max-w-md">
                <span className="text-gray-500">Adquisición:</span>
                <span className="font-mono text-right">
                  {formatCurrency(product.acquisitionCost)}
                </span>
                <span className="text-gray-500">Materia Prima:</span>
                <span className="font-mono text-right">
                  {formatCurrency(product.rawMaterialCost)}
                </span>
                <span className="text-gray-500">Mano de Obra:</span>
                <span className="font-mono text-right">
                  {formatCurrency(product.laborCost)}
                </span>
                <span className="text-gray-500">Packaging:</span>
                <span className="font-mono text-right">
                  {formatCurrency(product.packagingCost)}
                </span>
                <span className="font-bold border-t pt-1">Total:</span>
                <span className="font-mono font-bold text-right border-t pt-1">
                  {formatCurrency(product.unitCost)}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="mt-4">
          <ProductPricingTab
            product={product}
            onUpdate={() => {
              loadProduct();
              onRefresh();
            }}
          />
        </TabsContent>

        {/* Stock Tab */}
        <TabsContent value="stock" className="mt-4">
          <ProductStockTab product={product} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
