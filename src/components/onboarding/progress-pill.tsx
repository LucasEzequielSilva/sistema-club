"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SETUP_DONE_KEY = "sc_setup_complete_v1";
const PROGRESS_KEY = "sc_progress_v1";
const PILL_SESSION_KEY = "sc_pill_dismissed";

const TOTAL = 5;

export function OnboardingProgressPill() {
  const router = useRouter();
  const pathname = usePathname();
  const [done, setDone] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't show if setup complete
    if (localStorage.getItem(SETUP_DONE_KEY)) return;
    // Don't show if session-dismissed
    if (sessionStorage.getItem(PILL_SESSION_KEY)) {
      setDismissed(true);
      return;
    }
    // Don't show on tablero (checklist already there)
    if (pathname === "/tablero") return;

    const stored = Number(localStorage.getItem(PROGRESS_KEY) ?? "0");
    if (stored === TOTAL) {
      localStorage.setItem(SETUP_DONE_KEY, "1");
      return;
    }
    setDone(stored);
    setVisible(true);
  }, [pathname]);

  // Hide on tablero
  if (pathname === "/tablero") return null;
  if (!visible || dismissed) return null;

  const pct = Math.round((done / TOTAL) * 100);
  const CIRC = 2 * Math.PI * 8; // r=8

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push("/tablero")}
      onKeyDown={(e) => e.key === "Enter" && router.push("/tablero")}
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-full",
        "bg-foreground text-background shadow-xl cursor-pointer",
        "hover:bg-foreground/90 active:scale-95 transition-all duration-150",
        "animate-in slide-in-from-bottom-3 fade-in duration-400"
      )}
    >
      {/* Mini progress ring */}
      <div className="relative w-5 h-5 shrink-0">
        <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <circle
            cx="10" cy="10" r="8" fill="none"
            stroke="#f97316" strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold" style={{ color: "#f97316" }}>
          {done}
        </span>
      </div>

      <span className="text-xs font-semibold whitespace-nowrap">
        {done}/{TOTAL} · Configuración
      </span>

      <ChevronRight className="w-3.5 h-3.5 opacity-50" />

      {/* Session dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          sessionStorage.setItem(PILL_SESSION_KEY, "1");
          setDismissed(true);
        }}
        className="ml-0.5 p-1 rounded-full hover:bg-background/15 transition-colors"
        aria-label="Ocultar"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
