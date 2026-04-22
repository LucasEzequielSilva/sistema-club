"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, Bot, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AIAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Auto-cerrar en POS (interfaz de foco total)
  const isPOS = pathname.startsWith("/pos");
  if (isPOS) return null;

  return (
    <>
      {/* Botón flotante — Costito teaser */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-200",
          "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
        )}
        style={{ width: 52, height: 52 }}
        title="Costito - Asistente IA"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {/* Dialog teaser */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-2">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl font-bold tracking-tight">
              Costito — tu asistente IA
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground leading-relaxed pt-2">
              Costito es el asistente IA de Acelerator. Te ayuda a entender tus
              números, detectar oportunidades y responder preguntas de finanzas
              al toque. Contratá la IA para desbloquearlo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 pt-2">
            <a
              href="mailto:hola@matiasrandazzo.com?subject=Quiero activar Costito"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Sparkles className="w-4 h-4" />
              Contratar IA
            </a>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Cerrar
            </button>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 pt-2">
              <Lock className="w-3 h-3" />
              <span>Módulo premium · Acelerator by Matías Randazzo</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
