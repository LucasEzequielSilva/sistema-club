"use client";

import Image from "next/image";
import { Sparkles, Lock, Rocket } from "lucide-react";

type Props = {
  title: string;
  tagline: string;
  description: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  icon?: "sparkles" | "lock" | "rocket";
};

export function UnderConstruction({ title, tagline, description, cta, icon = "rocket" }: Props) {
  const Icon = icon === "lock" ? Lock : icon === "sparkles" ? Sparkles : Rocket;
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-lg text-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
          <Icon className="w-7 h-7 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{tagline}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        {cta && (
          <div className="pt-2">
            {cta.href ? (
              <a href={cta.href} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                {cta.label}
              </a>
            ) : (
              <button onClick={cta.onClick} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                {cta.label}
              </button>
            )}
          </div>
        )}
        <div className="pt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Image src="/brand/icon-app.svg" alt="Acelerator" width={16} height={16} className="opacity-70" />
          <span>Acelerator · by Matías Randazzo</span>
        </div>
      </div>
    </div>
  );
}
