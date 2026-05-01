"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LifeBuoy, Home } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reportedKeys = useRef(new Set<string>());

  useEffect(() => {
    const key = error.digest ?? error.message;
    if (reportedKeys.current.has(key)) return;
    reportedKeys.current.add(key);

    // Capturar el error al endpoint de soporte automáticamente para que
    // los admins lo vean en /admin/bugs sin que el user tenga que reportar.
    void fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "bug",
        title: `[auto] ${error.message?.slice(0, 80) || "Error sin mensaje"}`,
        description: error.stack?.slice(0, 2000) ?? error.message,
        metadata: {
          source: "error.tsx",
          digest: error.digest ?? null,
        },
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
            Algo se rompió
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tuvimos un problema
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ya lo registramos para que el equipo de Mati lo revise. Podés
            volver a intentar o ir al inicio mientras tanto.
          </p>
          {error.digest && (
            <p className="text-[10px] text-muted-foreground/60 font-mono mt-3">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tablero" className="gap-2">
              <Home className="w-4 h-4" /> Ir al inicio
            </Link>
          </Button>
        </div>
        <div className="pt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Image src="/brand/icon-app.svg" alt="Acelerator" width={16} height={16} className="opacity-70" />
          <span>Acelerator · by Matías Randazzo</span>
        </div>
      </div>
    </div>
  );
}
