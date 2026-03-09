"use client";

/**
 * Wizard de onboarding — pantalla completa, sin salida hasta completar.
 * Ruta: /onboarding (fuera del dashboard layout — sin sidebar).
 * El middleware redirige aquí a cualquier usuario autenticado sin cookie sc_onboarding_done.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Store,
  Tag,
  Building2,
  Package,
  CreditCard,
  ArrowRight,
  Check,
  Trophy,
  Loader2,
  Plus,
  X,
  ShoppingBag,
} from "lucide-react";
import { useAccountId } from "@/hooks/use-account-id";

// ── Rubros y sus categorías sugeridas ────────────────────────────────────────
const RUBROS = [
  { id: "colchoneria", label: "Colchonería",    emoji: "🛏️" },
  { id: "ropa",        label: "Indumentaria",   emoji: "👕" },
  { id: "ferreteria",  label: "Ferretería",     emoji: "🔧" },
  { id: "alimentos",   label: "Alimentos",      emoji: "🍞" },
  { id: "electronica", label: "Electrónica",    emoji: "📱" },
  { id: "muebles",     label: "Muebles / Deco", emoji: "🪑" },
  { id: "servicios",   label: "Servicios",      emoji: "🛠️" },
  { id: "otro",        label: "Otro rubro",     emoji: "📦" },
] as const;

type RubroId = typeof RUBROS[number]["id"];

const CATS_BY_RUBRO: Record<RubroId, string[]> = {
  colchoneria:  ["Colchones", "Sommiers", "Almohadas", "Cubresommiers", "Bauleras", "Blanquería", "Accesorios", "Varios"],
  ropa:         ["Remeras", "Pantalones", "Calzado", "Ropa interior", "Camperas", "Accesorios", "Varios"],
  ferreteria:   ["Herramientas", "Electricidad", "Plomería", "Pinturas", "Fijaciones", "Seguridad", "Varios"],
  alimentos:    ["Panadería", "Fiambrería", "Bebidas", "Lácteos", "Frutas y verduras", "Secos", "Varios"],
  electronica:  ["Celulares", "Computación", "Accesorios", "Audio y video", "Repuestos", "Varios"],
  muebles:      ["Living", "Dormitorio", "Comedor", "Oficina", "Iluminación", "Decoración", "Varios"],
  servicios:    ["Mano de obra", "Instalación", "Mantenimiento", "Consultoría", "Otros servicios"],
  otro:         ["Productos", "Servicios", "Materia prima", "Varios"],
};

// ── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  "#f97316", "#fb923c", "#fdba74",
  "#374151", "#6b7280", "#d1d5db",
  "#1f2937", "#f3f4f6",
];

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[9998]" aria-hidden>
      {Array.from({ length: 36 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${((i * 2.8 + (i % 7) * 3) % 98) + 1}%`,
            top: `-${8 + (i % 6) * 4}px`,
            width: `${[6, 8, 7, 5, 9][i % 5]}px`,
            height: `${[6, 8, 7, 5, 9][i % 5]}px`,
            borderRadius: i % 3 === 0 ? "50%" : "2px",
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animation: `confettiFall ${1.6 + (i % 4) * 0.35}s ease-in ${(i % 6) * 0.12}s forwards`,
            transform: `rotate(${i * 41}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ── Progress bar (steps 1-5) ─────────────────────────────────────────────────
const STEP_LABELS = ["Rubro", "Categorías", "Proveedor", "Producto", "Cobros"];

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 md:w-14 transition-colors duration-500",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                  done
                    ? "bg-primary text-white"
                    : active
                    ? "bg-primary text-white ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground border border-border"
                )}
              >
                {done ? <Check className="w-3 h-3" /> : num}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium hidden md:block",
                  active ? "text-foreground" : "text-muted-foreground/50"
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Step 0: Welcome ───────────────────────────────────────────────────────────
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-8">
      {/* Animated icon */}
      <div className="relative inline-flex items-center justify-center">
        <div
          className="absolute w-20 h-20 rounded-3xl bg-primary/15 animate-ping"
          style={{ animationDuration: "2.8s" }}
        />
        <div className="relative w-16 h-16 rounded-2xl bg-primary shadow-xl shadow-primary/30 flex items-center justify-center">
          <Store className="w-8 h-8 text-white" />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">
          Sistema Club
        </p>
        <h1 className="text-3xl font-bold text-foreground">¡Hola! 👋</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Vamos a dejar tu negocio listo para vender.
          <br />
          <span className="font-semibold text-foreground">
            5 pasos · menos de 5 minutos.
          </span>
        </p>
      </div>

      {/* Preview de pasos */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Tag, label: "Categorizás", sub: "tu mercadería" },
          { icon: Building2, label: "Registrás", sub: "tu proveedor" },
          { icon: Package, label: "Cargás", sub: "tu catálogo" },
          { icon: CreditCard, label: "Configurás", sub: "cómo cobrás" },
        ].map(({ icon: Icon, label, sub }) => (
          <div
            key={label}
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <Button
        className="w-full h-12 text-base font-semibold gap-2 shadow-lg shadow-primary/20"
        onClick={onNext}
      >
        ¡Empezar configuración!
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ── Step 1: Rubro ─────────────────────────────────────────────────────────────
function StepRubro({ onNext }: { onNext: (rubro: RubroId) => void }) {
  const [selected, setSelected] = useState<RubroId | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          ¿A qué se dedica tu negocio?
        </h2>
        <p className="text-muted-foreground text-sm mt-1.5">
          Así te sugerimos las categorías más útiles para tu rubro.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {RUBROS.map(({ id, label, emoji }) => {
          const isSelected = selected === id;
          return (
            <button
              key={id}
              onClick={() => setSelected(id as RubroId)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150",
                isSelected
                  ? "bg-primary/8 border-primary/40 ring-1 ring-primary/20"
                  : "bg-card border-border hover:border-primary/30"
              )}
            >
              <span className="text-xl shrink-0">{emoji}</span>
              <span className={cn(
                "text-sm font-medium leading-tight",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}>
                {label}
              </span>
              {isSelected && (
                <div className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Button
        className="w-full h-11 font-semibold gap-2"
        onClick={() => selected && onNext(selected)}
        disabled={!selected}
      >
        Continuar
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ── Step 2: Categorías ────────────────────────────────────────────────────────
function StepCategories({ rubro, onNext }: { rubro: RubroId; onNext: (id: string) => void }) {
  const { accountId } = useAccountId();
  const suggestedCats = CATS_BY_RUBRO[rubro];
  const [selected, setSelected] = useState<string[]>([suggestedCats[0]]);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);

  const toggle = (cat: string) => {
    setSelected((s) =>
      s.includes(cat) ? s.filter((c) => c !== cat) : [...s, cat]
    );
  };

  const addCustom = () => {
    const v = custom.trim();
    if (v && !selected.includes(v)) setSelected((s) => [...s, v]);
    setCustom("");
  };

  const customAdded = selected.filter((s) => !suggestedCats.includes(s));

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        selected.map((name) =>
          trpc.clasificaciones.createProductCategory.mutate({
            accountId: accountId ?? "",
            name,
          })
        )
      );
      onNext((results[0] as any).id);
    } catch (e: any) {
      toast.error(e.message || "Error al crear categorías. Intentá de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          ¿Cómo organizás tu mercadería?
        </h2>
        <p className="text-muted-foreground text-sm mt-1.5">
          Seleccioná las categorías que usás. Podés agregar más después.
        </p>
      </div>

      {/* Chips sugeridos */}
      <div className="flex flex-wrap gap-2">
        {suggestedCats.map((cat) => {
          const isSelected = selected.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all duration-150",
                isSelected
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              )}
            >
              {isSelected && <Check className="w-3 h-3 shrink-0" />}
              {cat}
            </button>
          );
        })}
      </div>

      {/* Agregar categoría custom */}
      <div className="flex gap-2">
        <Input
          placeholder="Otra categoría..."
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={addCustom}
          disabled={!custom.trim()}
          className="shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Custom chips agregados */}
      {customAdded.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customAdded.map((cat) => (
            <span
              key={cat}
              className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium"
            >
              {cat}
              <button
                onClick={() => toggle(cat)}
                className="hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Button
        className="w-full h-11 font-semibold gap-2"
        onClick={handleSubmit}
        disabled={selected.length === 0 || loading}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Continuar
        {!loading && <ArrowRight className="w-4 h-4" />}
      </Button>
    </div>
  );
}

// ── Step 2: Proveedor ─────────────────────────────────────────────────────────
function StepSupplier({ onNext }: { onNext: () => void }) {
  const { accountId } = useAccountId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await trpc.proveedores.create.mutate({
        accountId: accountId ?? "",
        name: name.trim(),
        phone: phone.trim() || "",
      });
      onNext();
    } catch (e: any) {
      toast.error(e.message || "Error al agregar proveedor");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          ¿A quién le comprás?
        </h2>
        <p className="text-muted-foreground text-sm mt-1.5">
          Tu proveedor principal. Podés agregar más en Catálogos.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Nombre del proveedor{" "}
            <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="Ej: Fábrica Norte S.A."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && handleSubmit()}
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Teléfono{" "}
            <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <Input
            placeholder="Ej: +54 388 456-7890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Button
          className="w-full h-11 font-semibold gap-2"
          onClick={handleSubmit}
          disabled={!name.trim() || loading}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Agregar proveedor
          {!loading && <ArrowRight className="w-4 h-4" />}
        </Button>
        <button
          onClick={onNext}
          className="w-full text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2"
        >
          No tengo proveedor todavía →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Producto ──────────────────────────────────────────────────────────
function StepProduct({
  categoryId,
  onNext,
}: {
  categoryId: string | null;
  onNext: () => void;
}) {
  const { accountId } = useAccountId();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (!categoryId) {
      toast.error("No se encontró la categoría. Recargá la página.");
      return;
    }
    setLoading(true);
    try {
      await trpc.productos.create.mutate({
        accountId: accountId ?? "",
        name: name.trim(),
        categoryId,
        unit: "unidad",
        origin: "comprado",
        initialStock: 0,
        minStock: 0,
        acquisitionCost: parseFloat(price) || 0,
        rawMaterialCost: 0,
        laborCost: 0,
        packagingCost: 0,
      });
      onNext();
    } catch (e: any) {
      toast.error(e.message || "Error al agregar producto");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Cargá tu primer producto
        </h2>
        <p className="text-muted-foreground text-sm mt-1.5">
          Ya vas a poder venderlo desde el Punto de Venta.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Nombre del producto <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="Ej: Colchón 2 plazas con resortes"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && handleSubmit()}
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Precio de costo{" "}
            <span className="text-muted-foreground font-normal">
              (configurás precios de venta en Catálogos)
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
              $
            </span>
            <Input
              type="number"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="pl-7"
            />
          </div>
        </div>
      </div>

      <Button
        className="w-full h-11 font-semibold gap-2"
        onClick={handleSubmit}
        disabled={!name.trim() || loading}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Agregar producto
        {!loading && <ArrowRight className="w-4 h-4" />}
      </Button>
    </div>
  );
}

// ── Step 4: Métodos de pago ───────────────────────────────────────────────────
const PAYMENT_OPTIONS = [
  { name: "Efectivo", emoji: "💵", days: 0, sub: "Pago en el momento" },
  { name: "Transferencia", emoji: "🔄", days: 0, sub: "Acredita al instante" },
  { name: "Débito", emoji: "💳", days: 1, sub: "Acredita en 1 día" },
  { name: "Crédito", emoji: "💳", days: 7, sub: "Acredita en 7 días" },
  { name: "MercadoPago", emoji: "📱", days: 2, sub: "Acredita en 2 días" },
];

function StepPayments({ onNext }: { onNext: () => void }) {
  const { accountId } = useAccountId();
  const [selected, setSelected] = useState<string[]>(["Efectivo", "Transferencia"]);
  const [loading, setLoading] = useState(false);

  const toggle = (name: string) => {
    setSelected((s) =>
      s.includes(name) ? s.filter((n) => n !== name) : [...s, name]
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const existing = await trpc.clasificaciones.listPaymentMethods.query({
        accountId: accountId ?? "",
      });
      const existingNames = (existing as any[]).map((m) =>
        (m.name as string).toLowerCase()
      );
      const toCreate = PAYMENT_OPTIONS.filter(
        (o) =>
          selected.includes(o.name) &&
          !existingNames.includes(o.name.toLowerCase())
      );
      if (toCreate.length > 0) {
        await Promise.all(
          toCreate.map((o) =>
            trpc.clasificaciones.createPaymentMethod.mutate({
              accountId: accountId ?? "",
              name: o.name,
              accreditationDays: o.days,
            })
          )
        );
      }
      onNext();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar métodos de pago");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">¿Cómo cobrás?</h2>
        <p className="text-muted-foreground text-sm mt-1.5">
          Marcá los medios de pago que aceptás.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {PAYMENT_OPTIONS.map(({ name, emoji, sub }) => {
          const isSelected = selected.includes(name);
          return (
            <button
              key={name}
              onClick={() => toggle(name)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150",
                isSelected
                  ? "bg-primary/8 border-primary/40 ring-1 ring-primary/20"
                  : "bg-card border-border hover:border-primary/30"
              )}
            >
              {/* Emoji siempre visible */}
              <div
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 transition-colors",
                  isSelected ? "bg-primary/15" : "bg-muted/60"
                )}
              >
                {emoji}
              </div>

              {/* Texto */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-semibold leading-tight",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}>
                  {name}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>
              </div>

              {/* Checkbox a la derecha */}
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  isSelected
                    ? "bg-primary border-primary"
                    : "border-border bg-background"
                )}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      <Button
        className="w-full h-11 font-semibold gap-2"
        onClick={handleSubmit}
        disabled={selected.length === 0 || loading}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Continuar
        {!loading && <ArrowRight className="w-4 h-4" />}
      </Button>
    </div>
  );
}

// ── Step 5: ¡Listo! ───────────────────────────────────────────────────────────
function StepDone({
  onGoTablero,
  onGoPos,
}: {
  onGoTablero: () => void;
  onGoPos: () => void;
}) {
  return (
    <>
      <Confetti />
      <div className="text-center space-y-6">
        {/* Trophy */}
        <div className="relative inline-flex">
          <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center shadow-xl shadow-primary/25">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div
            className="absolute inset-0 rounded-3xl bg-primary/15 animate-ping"
            style={{ animationDuration: "1.6s" }}
          />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-foreground">
            ¡Todo listo! 🎉
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Tu negocio está configurado.
            <br />
            ¡Hacé tu primera venta desde el Punto de Venta!
          </p>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { icon: Tag, label: "Categorías" },
            { icon: Building2, label: "Proveedor" },
            { icon: Package, label: "Producto" },
            { icon: CreditCard, label: "Cobros" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200/60 px-2.5 py-1.5 rounded-full"
            >
              <Check className="w-3 h-3" />
              {label}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="space-y-2 pt-2">
          <Button
            className="w-full h-12 text-base font-semibold gap-2 shadow-md shadow-primary/20"
            onClick={onGoPos}
          >
            <ShoppingBag className="w-4 h-4" />
            Ir al Punto de Venta
          </Button>
          <Button variant="outline" className="w-full" onClick={onGoTablero}>
            Ver el tablero
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Wizard principal ──────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedRubro, setSelectedRubro] = useState<RubroId>("otro");
  const [createdCategoryId, setCreatedCategoryId] = useState<string | null>(null);

  const advance = () => setStep((s) => s + 1);

  const complete = async (destination: "/tablero" | "/pos") => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sc_progress_v1", "4");
    }
    try {
      await fetch("/api/auth/complete-onboarding", { method: "POST" });
    } catch {
      const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `sc_onboarding_done=1; path=/; expires=${exp}; SameSite=Lax`;
    }
    router.push(destination);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepWelcome onNext={advance} />;
      case 1:
        return (
          <StepRubro
            onNext={(rubro) => {
              setSelectedRubro(rubro);
              advance();
            }}
          />
        );
      case 2:
        return (
          <StepCategories
            rubro={selectedRubro}
            onNext={(id) => {
              setCreatedCategoryId(id);
              advance();
            }}
          />
        );
      case 3:
        return <StepSupplier onNext={advance} />;
      case 4:
        return <StepProduct categoryId={createdCategoryId} onNext={advance} />;
      case 5:
        return <StepPayments onNext={advance} />;
      case 6:
        return (
          <StepDone
            onGoPos={() => complete("/pos")}
            onGoTablero={() => complete("/tablero")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header fijo */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Store className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Sistema Club
          </span>
        </div>

        {/* Progress indicator — solo steps 1-5 */}
        {step >= 1 && step <= 5 ? (
          <ProgressBar current={step} />
        ) : (
          <div className="flex-1" />
        )}

        {/* Spacer para balancear el logo a la izquierda */}
        <div className="w-[72px]" />
      </header>

      {/* Contenido */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-auto">
        <div className="w-full max-w-[440px]">
          <div
            key={step}
            className="animate-in fade-in slide-in-from-right-4 duration-300"
          >
            {renderStep()}
          </div>
        </div>
      </main>
    </div>
  );
}
