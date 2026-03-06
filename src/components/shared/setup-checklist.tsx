"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  Tag,
  Building2,
  Package,
  CreditCard,
  ShoppingBag,
  Trophy,
  Sparkles,
  PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ACCOUNT_ID = "test-account-id";
const SETUP_DONE_KEY = "sc_setup_complete_v1";
const PROGRESS_KEY = "sc_progress_v1";

// ── Confetti (pure CSS/JS, no lib) ──────────────────────────────────────────
const CONFETTI_COLORS = [
  "#f97316", "#fb923c", "#fdba74",
  "#374151", "#6b7280", "#d1d5db",
  "#1f2937", "#f3f4f6",
];

function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[9998]" aria-hidden>
      {pieces.map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${((i * 2.8 + (i % 7) * 3) % 98) + 1}%`,
            top: `-${8 + (i % 6) * 4}px`,
            width:  `${[6, 8, 7, 5, 9][i % 5]}px`,
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

// ── Types ────────────────────────────────────────────────────────────────────
type StepDef = {
  id: string;
  label: string;
  why: string;
  timeEst: string;
  href: string;
  Icon: React.ElementType;
  done: boolean;
};

// ── Component ────────────────────────────────────────────────────────────────
export function SetupChecklist({ hasSales }: { hasSales: boolean }) {
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [status, setStatus] = useState({
    hasCategories: false,
    hasSuppliers: false,
    hasProducts: false,
    hasPaymentMethods: false,
  });

  useEffect(() => {
    async function load() {
      try {
        const [cats, sups, prods, methods] = await Promise.all([
          trpc.clasificaciones.listProductCategories.query({ accountId: ACCOUNT_ID }),
          trpc.proveedores.list.query({ accountId: ACCOUNT_ID, isActive: true }),
          trpc.productos.list.query({ accountId: ACCOUNT_ID, isActive: true }),
          trpc.clasificaciones.listPaymentMethods.query({ accountId: ACCOUNT_ID }),
        ]);
        setStatus({
          hasCategories: (cats as any[]).length > 0,
          hasSuppliers: (sups as any[]).length > 0,
          hasProducts: (prods as any[]).length > 0,
          hasPaymentMethods: (methods as any[]).filter((m: any) => m.isActive).length > 0,
        });
      } catch {
        // mantener defaults
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, []);

  const steps: StepDef[] = [
    {
      id: "clasificaciones",
      label: "Clasificaciones",
      why: "Organizá tus productos por categoría para analizarlos mejor",
      timeEst: "1 min",
      href: "/clasificaciones",
      Icon: Tag,
      done: status.hasCategories,
    },
    {
      id: "proveedores",
      label: "Proveedores",
      why: "Registrá a quién le comprás — clave para el control de costos",
      timeEst: "1 min",
      href: "/proveedores",
      Icon: Building2,
      done: status.hasSuppliers,
    },
    {
      id: "productos",
      label: "Productos",
      why: "Tu catálogo con precios — la base del Punto de Venta",
      timeEst: "2–3 min",
      href: "/productos",
      Icon: Package,
      done: status.hasProducts,
    },
    {
      id: "pagos",
      label: "Métodos de pago",
      why: "Efectivo, transferencia, tarjeta — para registrar cada cobro",
      timeEst: "30 seg",
      href: "/clasificaciones",
      Icon: CreditCard,
      done: status.hasPaymentMethods,
    },
    {
      id: "venta",
      label: "Primera venta",
      why: "¡Probá el Punto de Venta y registrá tu primer ingreso!",
      timeEst: "1 min",
      href: "/pos",
      Icon: ShoppingBag,
      done: hasSales,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const pct = Math.round((doneCount / steps.length) * 100);

  // Persist progress for the floating pill
  useEffect(() => {
    if (!loadingData) {
      localStorage.setItem(PROGRESS_KEY, String(doneCount));
    }
  }, [doneCount, loadingData]);

  // Trigger celebration once when all steps complete
  useEffect(() => {
    if (allDone && !loadingData) {
      const wasAlreadyDone = localStorage.getItem(SETUP_DONE_KEY);
      localStorage.setItem(SETUP_DONE_KEY, "1");
      if (!wasAlreadyDone) {
        setJustFinished(true);
        setCelebrating(true);
        const t = setTimeout(() => setCelebrating(false), 4200);
        return () => clearTimeout(t);
      }
    }
  }, [allDone, loadingData]);

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── All-done celebration ─────────────────────────────────────────────────
  if (allDone) {
    return (
      <>
        {celebrating && <Confetti />}
        <div className="max-w-md mx-auto py-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Trophy icon */}
          <div className="relative inline-flex mb-6">
            <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center shadow-xl shadow-primary/25">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            {justFinished && (
              <div className="absolute inset-0 rounded-3xl bg-primary/20 animate-ping" style={{ animationDuration: "1.4s" }} />
            )}
          </div>

          <h2 className="text-2xl font-bold text-foreground">¡Todo listo, Mati! 🎉</h2>
          <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-sm leading-relaxed">
            Tu negocio está configurado. El tablero se actualiza con tus datos en tiempo real.
          </p>

          {/* Completed chips */}
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            {steps.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200/60 px-2.5 py-1 rounded-full"
              >
                <CheckCircle2 className="w-3 h-3" />
                {s.label}
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-8 flex gap-3 justify-center">
            <Button
              onClick={() => router.push("/pos")}
              className="gap-2 shadow-md shadow-primary/20"
            >
              <ShoppingBag className="w-4 h-4" />
              Ir al Punto de Venta
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Ver el tablero
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ── Setup guide ──────────────────────────────────────────────────────────
  // SVG ring: r=34 → circumference ≈ 213.6
  const CIRC = 2 * Math.PI * 34;

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      {/* Header: ring + title */}
      <div className="flex items-start gap-5 mb-8">
        {/* Progress ring */}
        <div className="relative shrink-0 w-[76px] h-[76px]">
          <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
            <circle cx="38" cy="38" r="34" fill="none" stroke="var(--muted)" strokeWidth="5" />
            <circle
              cx="38" cy="38" r="34" fill="none"
              stroke="var(--primary)" strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - pct / 100)}
              style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-foreground leading-none">{doneCount}</span>
            <span className="text-[10px] text-muted-foreground font-medium">de {steps.length}</span>
          </div>
        </div>

        {/* Title */}
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Primeros pasos
            </span>
          </div>
          <h2 className="text-xl font-bold text-foreground leading-tight">
            Configurá tu negocio
          </h2>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">
            {doneCount === 0 ? (
              <>5 pasos · menos de 10 minutos</>
            ) : (
              <>
                ¡Vas muy bien, Mati!{" "}
                <span className="font-medium text-foreground">
                  {steps.length - doneCount} paso{steps.length - doneCount !== 1 ? "s" : ""} más
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const { Icon } = step;
          // "Siguiente" = first incomplete step
          const isNext = !step.done && steps.slice(0, idx).every((s) => s.done);

          return (
            <button
              key={step.id}
              disabled={step.done}
              onClick={() => !step.done && router.push(step.href)}
              className={cn(
                "w-full text-left flex items-center gap-4 px-4 py-4 rounded-xl border transition-all duration-200",
                step.done
                  ? "bg-green-50 border-green-200/60 cursor-default"
                  : isNext
                  ? "bg-card border-primary/50 hover:border-primary hover:shadow-md hover:shadow-primary/10 cursor-pointer group"
                  : "bg-card border-border hover:border-muted-foreground/30 cursor-pointer group opacity-70 hover:opacity-100"
              )}
            >
              {/* Icon or checkmark */}
              <div className="shrink-0">
                {step.done ? (
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200",
                      isNext
                        ? "bg-primary/10 border-primary/40 group-hover:bg-primary/15 group-hover:scale-105"
                        : "bg-muted/60 border-border"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 transition-colors",
                        isNext ? "text-primary" : "text-muted-foreground/60"
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-tight",
                      step.done ? "text-green-700" : "text-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  {isNext && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Siguiente →
                    </span>
                  )}
                  {step.done && (
                    <span className="text-[10px] font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                      ✓ Listo
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "text-xs mt-0.5 leading-snug",
                    step.done ? "text-green-600/70" : "text-muted-foreground"
                  )}
                >
                  {step.why}
                </p>
              </div>

              {/* Time + arrow */}
              {!step.done && (
                <div className="shrink-0 flex flex-col items-end gap-1.5 ml-2">
                  <span className="text-[10px] text-muted-foreground/50 font-medium whitespace-nowrap">
                    ~{step.timeEst}
                  </span>
                  <ArrowRight
                    className={cn(
                      "w-4 h-4 transition-all duration-200",
                      isNext
                        ? "text-primary group-hover:translate-x-1"
                        : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
                    )}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      {doneCount > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
          <PartyPopper className="w-3.5 h-3.5 text-primary" />
          ¡Vas muy bien! Cada paso desbloquea más del tablero.
        </p>
      )}
      {doneCount === 0 && (
        <p className="text-center text-xs text-muted-foreground mt-6">
          Podés continuar desde el menú lateral en cualquier momento.
        </p>
      )}
    </div>
  );
}
