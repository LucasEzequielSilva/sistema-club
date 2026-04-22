"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Store, Zap, BarChart3, Bot, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WELCOMED_KEY = "sc_welcomed_v1";

const FEATURES = [
  {
    icon: Zap,
    label: "Vendé más\nrápido",
    desc: "POS con código de barras",
  },
  {
    icon: BarChart3,
    label: "Todo bajo\ncontrol",
    desc: "Tablero en tiempo real",
  },
  {
    icon: Bot,
    label: "Clubi\nincluida",
    desc: "IA que entiende tu negocio",
  },
] as const;

export function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(WELCOMED_KEY)) {
      // Small delay so the page renders first — feels more intentional
      const t = setTimeout(() => setVisible(true), 350);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = (goToSetup: boolean) => {
    setLeaving(true);
    localStorage.setItem(WELCOMED_KEY, "1");
    setTimeout(() => {
      setVisible(false);
      if (goToSetup && pathname !== "/tablero") {
        router.push("/tablero");
      }
    }, 350);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center p-4",
        "bg-background/90 backdrop-blur-md",
        "transition-opacity duration-350",
        leaving ? "opacity-0" : "opacity-100 animate-in fade-in duration-400"
      )}
    >
      {/* Subtle skip — top-right, barely visible */}
      <button
        onClick={() => dismiss(false)}
        className="absolute top-4 right-4 flex items-center gap-1 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors text-xs py-1 px-2 rounded-md hover:bg-muted/50"
      >
        <X className="w-3 h-3" />
        Saltar
      </button>

      {/* Card */}
      <div
        className={cn(
          "w-full max-w-sm",
          !leaving && "animate-in slide-in-from-bottom-6 fade-in duration-500 delay-75"
        )}
      >
        {/* Brand hero */}
        <div className="text-center mb-7">
          {/* Icon with pulse rings */}
          <div className="relative inline-flex items-center justify-center mb-5">
            <div
              className="absolute w-16 h-16 rounded-2xl bg-primary/15 animate-ping"
              style={{ animationDuration: "2.8s" }}
            />
            <div
              className="absolute w-20 h-20 rounded-2xl bg-primary/8 animate-ping"
              style={{ animationDuration: "2.8s", animationDelay: "0.5s" }}
            />
            <div className="relative w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center">
              <Store className="w-7 h-7 text-white" />
            </div>
          </div>

          <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
            <p className="text-xs font-bold uppercase tracking-widest text-primary/70">
              Acelerator
            </p>
            <h1 className="text-2xl font-bold text-foreground">
              ¡Bienvenido! 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              Tu negocio,{" "}
              <span className="font-medium text-foreground">organizado en minutos.</span>
            </p>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-2 mb-7 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/50 border border-border gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground leading-tight whitespace-pre-line">
                  {label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
          <Button
            className="w-full h-11 text-[15px] font-semibold gap-2 shadow-md shadow-primary/20"
            onClick={() => dismiss(true)}
          >
            Configurar mi negocio
            <ArrowRight className="w-4 h-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Tardás menos de 5 minutos. Prometido.
          </p>
        </div>
      </div>
    </div>
  );
}
