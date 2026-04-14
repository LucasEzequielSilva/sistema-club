"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import {
  Search,
  ShoppingBag,
  CheckCircle2,
  Printer,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Package,
  Loader2,
  Trash2,
} from "lucide-react";
import { useAccountId } from "@/hooks/use-account-id";

// ============================================================
// Types
// ============================================================

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  unit: string;
  categoryId: string;
  category: { id: string; name: string };
  currentStock: number;
  isLowStock: boolean;
  unitCost: number;
  defaultPricing: {
    salePrice: number;
    marginPct: number;
  } | null;
};

type PriceList = { id: string; name: string; isDefault: boolean };
type PaymentMethod = { id: string; name: string; accreditationDays: number };
type PaymentChannel = {
  id: string;
  name: string;
  paymentMethodId: string | null;
  paymentAccountId: string;
  accreditationDays: number;
  isDefault: boolean;
  isActive: boolean;
  paymentAccount?: { id: string; name: string };
};

type PricingInfo = {
  unitCost: number;
  markupPct: number;
  salePrice: number;
  categoryId: string;
};

type LastSale = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paymentMethodName: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    subtotal: number;
  }>;
};

type CartItem = {
  id: string;
  product: Product;
  pricing: PricingInfo;
  quantity: number;
  discountPct: number;
  unitPrice: number;
  subtotal: number;
  variableCostTotal: number;
  contributionMargin: number;
  marginPct: number;
};

// ============================================================
// Helpers
// ============================================================

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatQuantity(value: number, unit: string) {
  return unit === "unidad" ? String(Math.round(value)) : value.toFixed(1);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesSearch(product: Product, rawSearch: string): boolean {
  const query = normalizeText(rawSearch);
  if (!query) return true;
  const tokens = query.split(/\s+/).filter(Boolean);
  const haystack = normalizeText(
    [product.name, product.barcode ?? "", product.sku ?? "", product.category?.name ?? ""].join(" ")
  );
  return tokens.every((t) => haystack.includes(t));
}

// ============================================================
// POS Page
// ============================================================

export default function PosPage() {
  const { accountId } = useAccountId();
  // ── Lookups ──
  const [products, setProducts] = useState<Product[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // ── Search ──
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Form state ──
  const [selectedPriceListId, setSelectedPriceListId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentChannelId, setPaymentChannelId] = useState("");
  const [origin, setOrigin] = useState<"minorista" | "mayorista">("minorista");
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── State ──
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<LastSale | null>(null);
  const [salesCount, setSalesCount] = useState(0);
  const [salesTotalToday, setSalesTotalToday] = useState(0);
  const [isRI, setIsRI] = useState(false);
  const [ivaRate, setIvaRate] = useState(21);
  const [recentProducts, setRecentProducts] = useState<{ id: string; name: string }[]>([]);
  const [lastSaleConfig, setLastSaleConfig] = useState<{
    productId: string;
    quantity: string;
    paymentMethodId: string;
    paymentChannelId: string;
  } | null>(null);

  // ── Load lookups on mount ──
  useEffect(() => {
    if (!accountId) return;
    setLoadingLookups(true);
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((acc) => {
        if (!acc) return;
        setIsRI(acc.taxStatus === "responsable_inscripto");
        setIvaRate(Number(acc.ivaRate ?? 21));
      })
      .catch(() => null);

    trpc.clasificaciones.bootstrapPaymentRouting
      .mutate({ accountId })
      .catch(() => null)
      .then(() =>
        Promise.all([
          trpc.productos.list.query({ accountId, isActive: true }),
          trpc.productos.getPriceLists.query({ accountId }),
          trpc.clasificaciones.listPaymentMethods.query({
            accountId,
          }),
          trpc.clasificaciones.listPaymentChannels.query({
            accountId,
            isActive: true,
          }),
        ])
      )
      .then(([prods, lists, methods, channels]) => {
        setProducts(prods);
        setPriceLists(lists);

        // Set default price list
        const defaultList = lists.find((l) => l.isDefault);
        if (defaultList) {
          setSelectedPriceListId(defaultList.id);
          // Set origin based on default list name
          if (defaultList.name.toLowerCase().includes("mayor")) {
            setOrigin("mayorista");
          }
        } else if (lists.length > 0) {
          setSelectedPriceListId(lists[0].id);
        }

        const activeMethods = methods
          .filter((m) => m.isActive)
          .map((m) => ({
            id: m.id,
            name: m.name,
            accreditationDays: m.accreditationDays,
          }));
        setPaymentMethods(activeMethods);
        setPaymentChannels(channels as PaymentChannel[]);

        // Default to "Efectivo" if available
        const efectivo = activeMethods.find(
          (m) => m.name.toLowerCase() === "efectivo"
        );
        if (efectivo) setPaymentMethodId(efectivo.id);
        else if (activeMethods.length > 0)
          setPaymentMethodId(activeMethods[0].id);
      })
      .catch(() => toast.error("Error cargando datos iniciales"))
      .finally(() => setLoadingLookups(false));
  }, [accountId]);

  useEffect(() => {
    if (!paymentMethodId) {
      setPaymentChannelId("");
      return;
    }

    const methodChannels = paymentChannels.filter(
      (ch) => !ch.paymentMethodId || ch.paymentMethodId === paymentMethodId
    );

    if (methodChannels.length === 0) {
      setPaymentChannelId("");
      return;
    }

    const currentIsValid = methodChannels.some((ch) => ch.id === paymentChannelId);
    if (currentIsValid) return;

    const next = methodChannels.find((ch) => ch.isDefault) ?? methodChannels[0];
    setPaymentChannelId(next?.id ?? "");
  }, [paymentMethodId, paymentChannels, paymentChannelId]);

  // ── Product search with debounce ──
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(() => {
      const term = normalizeText(searchTerm);
      const results = products.filter((p) => matchesSearch(p, term));

      // Si hay match EXACTO de código de barras o SKU, priorizarlo en dropdown
      const exactMatch = results.find(
        (p) =>
          normalizeText(p.barcode ?? "") === term ||
          normalizeText(p.sku ?? "") === term
      );
      if (exactMatch) {
        setFilteredProducts([exactMatch]);
        setShowDropdown(true);
        setHighlightedIndex(0);
        return;
      }

      setFilteredProducts(results.slice(0, 10));
      setShowDropdown(results.length > 0);
      setHighlightedIndex(-1);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchTerm, products]);

  // ── Update origin when price list changes ──
  useEffect(() => {
    const list = priceLists.find((l) => l.id === selectedPriceListId);
    if (list) {
      if (list.name.toLowerCase().includes("mayor")) {
        setOrigin("mayorista");
      } else {
        setOrigin("minorista");
      }
    }
  }, [selectedPriceListId, priceLists]);

  // ── Keyboard navigation in dropdown ──
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      if (!showDropdown) return;
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredProducts.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      if (!showDropdown) return;
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredProducts.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();

      // 1. Hay ítem resaltado con flechas → agregarlo al carrito
      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
        void addProductToCart(filteredProducts[highlightedIndex]);
        return;
      }

      // 2. Dropdown visible con resultados → agregar el primero
      //    (scanner mandó Enter rápido antes de que el usuario navegue)
      if (showDropdown && filteredProducts.length > 0) {
        void addProductToCart(filteredProducts[0]);
        return;
      }

      // 3. Debounce aún en vuelo (scanner muy rápido) → correr búsqueda sincrónicamente
      if (searchTerm.trim()) {
        const term = normalizeText(searchTerm);
        const results = products.filter((p) => matchesSearch(p, term));
        if (results.length === 1) {
          void addProductToCart(results[0]);
        } else if (results.length > 1) {
          setFilteredProducts(results.slice(0, 10));
          setShowDropdown(true);
          setHighlightedIndex(0);
        }
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // ── Click outside to close dropdown ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const cartTotal = cart.reduce((sum, it) => sum + it.subtotal, 0);
  const cartTotalWithIva = isRI ? cartTotal * (1 + ivaRate / 100) : cartTotal;
  const cartCostTotal = cart.reduce((sum, it) => sum + it.variableCostTotal, 0);
  const cartContribution = cart.reduce((sum, it) => sum + it.contributionMargin, 0);
  const cartMarginPct = cartTotal > 0 ? (cartContribution / cartTotal) * 100 : 0;
  const methodChannels = paymentChannels.filter(
    (ch) => !ch.paymentMethodId || ch.paymentMethodId === paymentMethodId
  );
  const toGross = useCallback(
    (net: number) => (isRI ? net * (1 + ivaRate / 100) : net),
    [isRI, ivaRate]
  );

  // ── Reset form ──
  const resetForm = useCallback(() => {
    setSearchTerm("");
    setFilteredProducts([]);
    setShowDropdown(false);
    setHighlightedIndex(-1);
    setCart([]);
    setLastSale(null);

    // Focus back to search
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  const addProductToCart = useCallback(
    async (product: Product, qtyOverride?: number) => {
      if (!selectedPriceListId || !accountId) return;

      try {
        const fetchedPricing = await trpc.ventas.getProductPrice.query({
          productId: product.id,
          priceListId: selectedPriceListId,
          accountId,
        });

        const q = qtyOverride ?? 1;
        const d = 0;
        const up = fetchedPricing.salePrice;
        const uc = fetchedPricing.unitCost;
        const st = up * q * (1 - d / 100);
        const costTotal = uc * q;
        const cm = st - costTotal;
        const mc = st > 0 ? (cm / st) * 100 : 0;

        const newItem: CartItem = {
          id: `${product.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
          product,
          pricing: fetchedPricing,
          quantity: q,
          discountPct: d,
          unitPrice: up,
          subtotal: st,
          variableCostTotal: costTotal,
          contributionMargin: cm,
          marginPct: mc,
        };

        setCart((prev) => [...prev, newItem]);
        setRecentProducts((prev) => {
          const soldProduct = { id: product.id, name: product.name };
          const filtered = prev.filter((p) => p.id !== soldProduct.id);
          return [soldProduct, ...filtered].slice(0, 5);
        });

        setSearchTerm("");
        setFilteredProducts([]);
        setShowDropdown(false);
        setHighlightedIndex(-1);
        setTimeout(() => searchInputRef.current?.focus(), 10);

        if (product.currentStock <= 0) {
          toast.warning(`NO TENÉS STOCK de ${product.name}`, {
            description:
              "La venta no se bloquea, pero revisá reposición en Egresos o Mercadería.",
          });
        } else {
          toast.success("Artículo agregado al carrito");
        }
      } catch {
        toast.error("No se pudo agregar el producto al carrito");
      }
    },
    [selectedPriceListId, accountId]
  );

  const recalcCartItem = useCallback((it: CartItem, newQty: number): CartItem => {
    const min = it.product.unit === "unidad" ? 1 : 0.1;
    const qRaw = Math.max(min, newQty);
    const q =
      it.product.unit === "unidad"
        ? Math.max(1, Math.round(qRaw))
        : Math.round(qRaw * 10) / 10;
    const subtotalValue = it.unitPrice * q * (1 - it.discountPct / 100);
    const variableCostValue = it.pricing.unitCost * q;
    const cmValue = subtotalValue - variableCostValue;
    const mcValue = subtotalValue > 0 ? (cmValue / subtotalValue) * 100 : 0;
    return {
      ...it,
      quantity: q,
      subtotal: subtotalValue,
      variableCostTotal: variableCostValue,
      contributionMargin: cmValue,
      marginPct: mcValue,
    };
  }, []);

  // ── Submit sale ──
  const handleConfirm = useCallback(async () => {
    if (cart.length === 0) {
      toast.error("Agregá al menos un artículo al carrito");
      return;
    }
    if (!paymentMethodId) {
      toast.error("Selecciona un medio de pago");
      return;
    }

    setSubmitting(true);
    try {
      let firstSale: { id?: string } | null = null;
      const batchSaleDate = new Date();
      const ticketId = `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const sale = await trpc.ventas.create.mutate({
          accountId: accountId ?? "",
          productId: item.product.id,
          categoryId: item.pricing.categoryId,
          priceListId: selectedPriceListId || null,
          saleDate: batchSaleDate,
          origin,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discountPct: item.discountPct,
          invoiced: false,
          notes: `[POS_TICKET:${ticketId}]`,
          payments: [
            {
              paymentMethodId,
              paymentChannelId: paymentChannelId || null,
              amount: toGross(item.subtotal),
              paymentDate: batchSaleDate,
            },
          ],
        });

        if (!firstSale) firstSale = sale;
      }

      const methodName =
        paymentMethods.find((m) => m.id === paymentMethodId)?.name ?? "";

      const totalSaleAmount = cart.reduce((sum, it) => sum + toGross(it.subtotal), 0);
      const firstItem = cart[0];
      const saleItems = cart.map((it) => ({
        name: it.product.name,
        quantity: it.quantity,
        unit: it.product.unit,
        unitPrice: toGross(it.unitPrice),
        subtotal: toGross(it.subtotal),
      }));

      setLastSale({
        id: firstSale?.id ?? "",
        productName:
          cart.length === 1
            ? firstItem.product.name
            : `${firstItem.product.name} + ${cart.length - 1} ítem(s)`,
        quantity: firstItem.quantity,
        unitPrice: toGross(firstItem.unitPrice),
        total: totalSaleAmount,
        paymentMethodName: methodName,
        items: saleItems,
      });

      setSalesCount((prev) => prev + 1);
      setSalesTotalToday((prev) => prev + totalSaleAmount);

      // Track recent products (max 5, LIFO, no duplicates)
      setRecentProducts((prev) => {
        const next = [...prev];
        for (const it of cart) {
          const rp = { id: it.product.id, name: it.product.name };
          const filtered = next.filter((p) => p.id !== rp.id);
          next.splice(0, next.length, ...[rp, ...filtered].slice(0, 5));
        }
        return next.slice(0, 5);
      });

      // Save last sale config for "Repetir venta"
      setLastSaleConfig({
        productId: firstItem.product.id,
        quantity: String(firstItem.quantity),
        paymentMethodId,
        paymentChannelId,
      });

      // Update stock in local products list
      setProducts((prev) =>
        prev.map((p) => {
          const soldQty = cart
            .filter((it) => it.product.id === p.id)
            .reduce((sum, it) => sum + it.quantity, 0);
          return soldQty > 0 ? { ...p, currentStock: p.currentStock - soldQty } : p;
        })
      );

      const metodoPago =
        paymentMethods.find((m) => m.id === paymentMethodId)?.name ?? "";

      toast.success(
        `Venta registrada · ${formatCurrency(totalSaleAmount)}`,
        {
          description: `${cart.length} artículo(s) · ${metodoPago}`,
          duration: 4000,
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al registrar la venta";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [cart, paymentMethodId, paymentChannelId, selectedPriceListId, origin, paymentMethods, accountId, toGross]);

  // ── Ctrl+Enter shortcut to confirm sale ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirm]);

  // ── Print receipt ──
  const handlePrint = () => {
    if (!lastSale) return;

    const itemsHtml = lastSale.items
      .map(
        (it) => `
          <div style="margin: 4px 0;">
            <div class="row">
              <span class="bold">${it.name}</span>
              <span>${formatCurrency(it.subtotal)}</span>
            </div>
            <div class="row" style="font-size:11px; color:#555;">
              <span>${formatQuantity(it.quantity, it.unit)} ${it.unit} x ${formatCurrency(it.unitPrice)}</span>
              <span></span>
            </div>
          </div>
        `
      )
      .join("");

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Comprobante de Venta</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #000;
            background: #fff;
            width: 72mm;
            padding: 8px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .large { font-size: 18px; font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .row .label { color: #555; }
          .total-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 14px; font-weight: bold; }
          .footer { text-align: center; font-size: 10px; color: #555; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size:14px; margin-bottom:4px;">COMPROBANTE DE VENTA</div>
        <div class="center" style="margin-bottom:2px; font-size:11px; color:#555;">${formatDate(new Date())}</div>
        <div class="divider"></div>

        <div class="bold" style="margin-bottom:4px;">Detalle del ticket</div>
        ${itemsHtml}

        <div class="divider"></div>

        <div class="total-row">
          <span>TOTAL</span>
          <span>${formatCurrency(lastSale.total)}</span>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span class="label">Medio de pago:</span>
          <span>${lastSale.paymentMethodName}</span>
        </div>

        <div class="footer">
          <div>¡Gracias por su compra!</div>
        </div>
      </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) {
      toast.error("El navegador bloqueó la ventana de impresión. Permití popups para este sitio.");
      return;
    }
    win.document.write(printContent);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  // ── Loading state ──
  if (loadingLookups) {
    return (
      <div className="space-y-6">
        <PageHeader title="Punto de Venta" description="Venta rápida" icon={ShoppingBag} />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ── Success state (after sale) ──
  if (lastSale) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <PageHeader title="Punto de Venta" description="Venta rápida" icon={ShoppingBag} />
        <div className="flex items-center justify-center py-6">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-400 bg-card rounded-2xl border border-border shadow-sm p-10 max-w-lg w-full text-center space-y-6">
          <div className="flex justify-center">
            <span className={salesCount === 1 ? "first-sale-of-day" : ""}>
              <CheckCircle2
                className="w-16 h-16 animate-in zoom-in-50 duration-500"
                style={{ color: "var(--success)" }}
              />
            </span>
          </div>
          <div className="space-y-1">
            {salesCount === 1 ? (
              <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                🎉 ¡Primera venta del día!
              </p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">
                Venta #{salesCount} del día
              </p>
            )}
            <div className="text-4xl font-bold" style={{ color: "var(--primary)" }}>
              {formatCurrency(lastSale.total)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Venta registrada correctamente
            </p>
          </div>

          <div className="bg-muted/50 rounded-xl border border-border p-5 text-left space-y-2.5 text-sm">
            <div className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">
              Detalle del carrito
            </div>
            <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
              {lastSale.items.map((it, idx) => (
                <div key={`${it.name}-${idx}`} className="rounded-md border border-border/60 bg-background/60 p-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium truncate">{it.name}</span>
                    <span className="font-mono font-semibold">{formatCurrency(it.subtotal)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {formatQuantity(it.quantity, it.unit)} {it.unit} x {formatCurrency(it.unitPrice)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-border pt-2.5 mt-1">
              <span className="font-semibold text-foreground">Total:</span>
              <span className="font-mono font-bold text-lg text-foreground">
                {formatCurrency(lastSale.total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Medio de pago:</span>
              <span>{lastSale.paymentMethodName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hora:</span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatDate(new Date())}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            {lastSaleConfig && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  const config = lastSaleConfig;
                  resetForm();
                  setPaymentMethodId(config.paymentMethodId);
                  setPaymentChannelId(config.paymentChannelId || "");
                  const product = products.find((p) => p.id === config.productId);
                  if (product) {
                    await addProductToCart(product, Number(config.quantity) || 1);
                  }
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Repetir
              </Button>
            )}
            <Button className="flex-2 px-8" onClick={resetForm}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Nueva Venta
            </Button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // ── Main POS UI ──
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Punto de Venta"
        description="Venta rápida"
        icon={ShoppingBag}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-sm text-muted-foreground border border-border">
              <span className="font-medium text-foreground">{salesCount}</span>
              ventas hoy
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-sm text-muted-foreground border border-border">
              <span className="font-medium" style={{ color: "var(--success)" }}>{formatCurrency(salesTotalToday)}</span>
              total
            </span>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Badge>
          </div>
        }
      />

      {/* Two-panel grid */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_384px] gap-4 items-start">
        {/* Left panel — product search + selection */}
        <div className="bg-muted/30 rounded-xl border border-border p-5 space-y-5">
            {/* Price list selector */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1.5 block">
                  Lista de Precios
                </Label>
                <Select
                  value={selectedPriceListId}
                  onValueChange={setSelectedPriceListId}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Seleccionar lista..." />
                  </SelectTrigger>
                  <SelectContent>
                    {priceLists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                        {l.isDefault ? " (Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge
                variant={origin === "minorista" ? "default" : "secondary"}
                className="mb-1 text-xs"
              >
                {origin === "minorista" ? "Minorista" : "Mayorista"}
              </Badge>
            </div>

            {/* Quick picks — productos recientes */}
            {recentProducts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                  Recientes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recentProducts.map((rp) => {
                    const product = products.find((p) => p.id === rp.id);
                    return (
                      <button
                        key={rp.id}
                        onClick={() => product && void addProductToCart(product)}
                        className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted hover:bg-accent text-foreground transition-colors cursor-pointer"
                      >
                        {rp.name.length > 22 ? rp.name.slice(0, 22) + "…" : rp.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Product search */}
            <div className="relative">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1.5 block">
                Buscar Producto
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Nombre o código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => {
                    if (filteredProducts.length > 0 && searchTerm.trim()) {
                      setShowDropdown(true);
                    }
                  }}
                  className="h-11 text-sm pl-9 bg-background"
                  autoFocus
                />
              </div>

              {/* Dropdown results */}
              {showDropdown && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto"
                >
                  {filteredProducts.map((product, idx) => (
                    <button
                      key={product.id}
                      type="button"
                      className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/60 transition-colors ${
                        idx === highlightedIndex ? "bg-muted/60" : ""
                      } ${idx > 0 ? "border-t border-border" : ""}`}
                      onClick={() => void addProductToCart(product)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      <div>
                        <div className="font-medium text-sm">{product.name}</div>
                        <div className="text-xs text-muted-foreground space-x-2 mt-0.5">
                          {product.barcode && <span>Cod: {product.barcode}</span>}
                          <span>{product.category.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-medium">
                          {product.defaultPricing
                            ? formatCurrency(toGross(product.defaultPricing.salePrice))
                            : "--"}
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${
                            product.isLowStock
                              ? "text-red-500 font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          Stock: {product.currentStock} {product.unit}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border px-3 py-2">
              Enter agrega el producto resaltado. Click en un resultado también lo agrega directo.
            </div>

            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Buscá o escaneá para agregar al carrito</p>
            </div>
        </div>

        {/* Right panel — totals + payment + confirm */}
        <div className="md:sticky md:top-6">
          <div className="bg-card rounded-xl border border-border flex flex-col md:max-h-[calc(100vh-9rem)]">
            {/* Totals */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">Resumen</h2>

              {cart.length > 0 ? (
                <div className="space-y-3">
                  {/* Items */}
                  <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                    {cart.map((it) => (
                      <div key={it.id} className="rounded-lg border border-border p-2.5 bg-muted/30">
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{it.product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatQuantity(it.quantity, it.product.unit)} {it.product.unit} x {formatCurrency(toGross(it.unitPrice))}
                              {it.discountPct > 0 ? ` · desc ${it.discountPct}%` : ""}
                            </p>
                            <div className="mt-2 inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  const step = it.product.unit === "unidad" ? 1 : 0.1;
                                  setCart((prev) =>
                                    prev.map((x) =>
                                      x.id === it.id ? recalcCartItem(x, x.quantity - step) : x
                                    )
                                  );
                                }}
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                step={it.product.unit === "unidad" ? "1" : "0.1"}
                                min={it.product.unit === "unidad" ? "1" : "0.1"}
                                value={formatQuantity(it.quantity, it.product.unit)}
                                onChange={(e) => {
                                  const parsed = parseFloat(e.target.value);
                                  if (Number.isNaN(parsed)) return;
                                  setCart((prev) =>
                                    prev.map((x) =>
                                      x.id === it.id ? recalcCartItem(x, parsed) : x
                                    )
                                  );
                                }}
                                className="h-7 w-20 text-center text-xs font-mono"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  const step = it.product.unit === "unidad" ? 1 : 0.1;
                                  setCart((prev) =>
                                    prev.map((x) =>
                                      x.id === it.id ? recalcCartItem(x, x.quantity + step) : x
                                    )
                                  );
                                }}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm font-semibold">{formatCurrency(toGross(it.subtotal))}</p>
                            <button
                              type="button"
                              className="text-[11px] text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                              onClick={() => setCart((prev) => prev.filter((x) => x.id !== it.id))}
                            >
                              <Trash2 className="w-3 h-3" /> Quitar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total highlight */}
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-medium text-muted-foreground">Total</span>
                      <span className="text-3xl font-bold text-foreground font-mono">
                        {formatCurrency(cartTotalWithIva)}
                      </span>
                    </div>
                  </div>

                  {/* Margin info */}
                  <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-sm border border-border/50">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      <TrendingUp className="w-3 h-3" />
                      Rentabilidad
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Costo variable</span>
                      <span className="font-mono text-sm">
                        {formatCurrency(cartCostTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margen contrib.</span>
                      <span
                        className={`font-mono font-medium text-sm ${
                          cartMarginPct < 20
                            ? "text-red-500"
                            : cartMarginPct < 30
                              ? "text-amber-500"
                              : "text-green-600"
                        }`}
                      >
                        {formatCurrency(cartContribution)} ({cartMarginPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {/* Payment method */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                      Medio de Pago
                    </Label>
                    <Select
                      value={paymentMethodId}
                      onValueChange={(value) => {
                        setPaymentMethodId(value);
                        setPaymentChannelId("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                            {m.accreditationDays > 0
                              ? ` (${m.accreditationDays}d)`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {methodChannels.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                        Canal / Cuenta
                      </Label>
                      <Select
                        value={paymentChannelId || "none"}
                        onValueChange={(v) => setPaymentChannelId(v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar canal..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Canal automático</SelectItem>
                          {methodChannels.map((ch) => (
                            <SelectItem key={ch.id} value={ch.id}>
                              {ch.name}
                              {ch.paymentAccount?.name ? ` · ${ch.paymentAccount.name}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground text-sm py-12 text-center gap-2">
                  <ShoppingBag className="w-8 h-8 text-muted-foreground/40" />
                  <span>Agregá productos al carrito para confirmar la venta</span>
                </div>
              )}
            </div>

            {/* Confirm button */}
            <div className="p-4 border-t border-border">
              <Button
                className="w-full h-12 text-base font-semibold"
                disabled={cart.length === 0 || submitting}
                onClick={handleConfirm}
              >
                {submitting ? (
                  "Procesando..."
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5 mr-2" />
                    Confirmar Venta
                    {cart.length > 0 && (
                      <span className="ml-2 opacity-75 text-sm font-normal">
                        {formatCurrency(cartTotalWithIva)}
                      </span>
                    )}
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">Ctrl</kbd>
                {" + "}
                <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">↵</kbd>
                {" para confirmar rápido"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
