"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ExternalLink, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

type RoundingMode = "none" | "up10" | "up50" | "up100";

const ROUNDING_LABELS: Record<RoundingMode, string> = {
  none: "Sin redondeo",
  up10: "Hacia arriba a $10",
  up50: "Hacia arriba a $50",
  up100: "Hacia arriba a $100",
};

type PricingItem = {
  priceListId: string;
  priceListName: string;
  isDefault: boolean;
  markupPct: number;
  unitCost: number;
  salePrice: number;
  salePriceWithIva: number | null;
  contributionMargin: number;
  marginPct: number;
  roundingMode?: RoundingMode;
  rounded?: boolean;
  rawSalePrice?: number;
  rawSalePriceWithIva?: number | null;
  markupPctEffective?: number;
};

interface ProductPricingTabProps {
  product: {
    id: string;
    unitCost: number;
    pricingByList: PricingItem[];
    account: {
      taxStatus: string;
      ivaRate: number;
    };
  };
  onUpdate: () => void;
}

export function ProductPricingTab({
  product,
  onUpdate,
}: ProductPricingTabProps) {
  const router = useRouter();
  const [markups, setMarkups] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    product.pricingByList.forEach((item) => {
      initial[item.priceListId] = String(item.markupPct);
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isRI = product.account.taxStatus === "responsable_inscripto";

  const handleMarkupChange = (priceListId: string, value: string) => {
    setMarkups((prev) => ({ ...prev, [priceListId]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = Object.entries(markups).map(([priceListId, markup]) => ({
        priceListId,
        markupPct: parseFloat(markup) || 0,
      }));

      await trpc.productos.updatePricing.mutate({
        productId: product.id,
        items,
      });

      toast.success("Precios actualizados");
      setDirty(false);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar precios");
    } finally {
      setSaving(false);
    }
  };

  const roundUp = (value: number, mode: RoundingMode) => {
    if (mode === "none" || !value) return value;
    const step = mode === "up10" ? 10 : mode === "up50" ? 50 : 100;
    return Math.ceil(value / step) * step;
  };

  // Live-calculate pricing from current markup inputs
  const liveCalcPricing = (markupPct: number, roundingMode: RoundingMode = "none") => {
    const rawSalePrice = product.unitCost * (1 + markupPct / 100);
    const rawSalePriceWithIva = isRI
      ? rawSalePrice * (1 + product.account.ivaRate / 100)
      : null;

    let salePrice = rawSalePrice;
    let salePriceWithIva = rawSalePriceWithIva;
    let rounded = false;
    let markupPctEffective = markupPct;

    if (roundingMode !== "none" && product.unitCost > 0) {
      const targetGross = isRI ? rawSalePriceWithIva ?? 0 : rawSalePrice;
      if (targetGross > 0) {
        const roundedGross = roundUp(targetGross, roundingMode);
        if (roundedGross !== targetGross) {
          rounded = true;
          if (isRI) {
            salePriceWithIva = roundedGross;
            salePrice = roundedGross / (1 + product.account.ivaRate / 100);
          } else {
            salePrice = roundedGross;
          }
          markupPctEffective =
            ((salePrice - product.unitCost) / product.unitCost) * 100;
        }
      }
    }

    const contributionMargin = salePrice - product.unitCost;
    const marginPct =
      salePrice > 0 ? (contributionMargin / salePrice) * 100 : 0;

    return {
      salePrice: Math.round(salePrice * 100) / 100,
      salePriceWithIva:
        salePriceWithIva !== null
          ? Math.round(salePriceWithIva * 100) / 100
          : null,
      rawSalePrice: Math.round(rawSalePrice * 100) / 100,
      rawSalePriceWithIva:
        rawSalePriceWithIva !== null
          ? Math.round(rawSalePriceWithIva * 100) / 100
          : null,
      contributionMargin: Math.round(contributionMargin * 100) / 100,
      marginPct: Math.round(marginPct * 100) / 100,
      markupPctEffective: Math.round(markupPctEffective * 100) / 100,
      rounded,
    };
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Listas de Precios</h3>
          <p className="text-sm text-gray-500">
            Costo unitario: {formatCurrency(product.unitCost)}
            {isRI && (
              <span className="ml-2 text-blue-600">
                (IVA {product.account.ivaRate}% se agrega al PV)
              </span>
            )}
          </p>
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        )}
      </div>

      {product.pricingByList.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-muted-foreground text-sm">
            No hay listas de precios configuradas todavía.
          </p>
          <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
            Primero creá una lista de precios (ej: &quot;Minorista&quot;, &quot;Mayorista&quot;) y después podrás definir el markup y precio de venta para cada producto.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/clasificaciones")}
            className="gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ir a Clasificaciones → Listas de Precios
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lista</TableHead>
              <TableHead className="text-center w-[120px]">Markup %</TableHead>
              <TableHead className="text-right">PV Neto</TableHead>
              {isRI && <TableHead className="text-right">PV con IVA</TableHead>}
              <TableHead className="text-right">CM ($)</TableHead>
              <TableHead className="text-right">Margen %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {product.pricingByList.map((item) => {
              const currentMarkup = parseFloat(
                markups[item.priceListId] ?? String(item.markupPct)
              );
              const roundingMode = item.roundingMode ?? "none";
              const live = liveCalcPricing(currentMarkup, roundingMode);

              return (
                <TableRow key={item.priceListId}>
                  <TableCell>
                    <span className="font-medium">{item.priceListName}</span>
                    {item.isDefault && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Default
                      </Badge>
                    )}
                    {roundingMode !== "none" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className="ml-2 text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20 cursor-help"
                            >
                              <Info className="w-3 h-3 mr-0.5" />
                              {ROUNDING_LABELS[roundingMode]}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              El PV se redondea automáticamente.
                              {live.rounded &&
                                ` Markup efectivo: ${live.markupPctEffective.toFixed(2)}%`}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-[100px] text-center mx-auto"
                      value={markups[item.priceListId] ?? String(item.markupPct)}
                      onChange={(e) =>
                        handleMarkupChange(item.priceListId, e.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <div className="flex flex-col items-end leading-tight">
                      <span>{formatCurrency(live.salePrice)}</span>
                      {live.rounded && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          {formatCurrency(live.rawSalePrice)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {isRI && (
                    <TableCell className="text-right font-mono">
                      {live.salePriceWithIva !== null ? (
                        <div className="flex flex-col items-end leading-tight">
                          <span>{formatCurrency(live.salePriceWithIva)}</span>
                          {live.rounded &&
                            live.rawSalePriceWithIva !== null && (
                              <span className="text-[10px] text-muted-foreground line-through">
                                {formatCurrency(live.rawSalePriceWithIva)}
                              </span>
                            )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-mono">
                    {formatCurrency(live.contributionMargin)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono font-medium ${
                        live.marginPct < 20
                          ? "text-red-500"
                          : live.marginPct < 30
                            ? "text-amber-500"
                            : "text-green-600"
                      }`}
                    >
                      {live.marginPct.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
