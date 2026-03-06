"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  ShoppingCart,
  Monitor,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Store,
  Waves,
  Target,
  FileText,
  Landmark,
  Tag,
  Building2,
  Package,
  Warehouse,
  Receipt,
  Sun,
  BookOpen,
  LogOut,
  Settings,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

// ─── Ítems de nav principal ─────────────────────────────────────────────────
const primaryNav = [
  { title: "Hoy",            href: "/tablero",      icon: Sun },
  { title: "Ventas",         href: "/ventas",        icon: TrendingUp },
  { title: "Compras",        href: "/compras",       icon: ShoppingCart },
  { title: "Punto de Venta", href: "/pos",           icon: Monitor },
];

// ─── Sub-ítems de Finanzas (colapsable) ─────────────────────────────────────
const finanzasNav = [
  { title: "Resumen",       href: "/resumen",            icon: BarChart3 },
  { title: "Cashflow",      href: "/cashflow",           icon: Waves },
  { title: "Cuadro KPIs",   href: "/cuadro-resumen",     icon: Target },
  { title: "Estados",       href: "/estados-resultados", icon: FileText },
  { title: "Cuentas",       href: "/cuentas",            icon: Landmark },
];

// ─── Catálogos (colapsable) ──────────────────────────────────────────────────
const catalogosNav = [
  { title: "Productos",       href: "/productos",       icon: Package },
  { title: "Proveedores",     href: "/proveedores",     icon: Building2 },
  { title: "Clasificaciones", href: "/clasificaciones", icon: Tag },
  { title: "Mercadería",      href: "/mercaderia",      icon: Warehouse },
  { title: "Facturación",     href: "/facturacion",     icon: Receipt },
];

const finanzasPaths  = finanzasNav.map((i) => i.href);
const catalogosPaths = catalogosNav.map((i) => i.href);

export function Sidebar({ onNavigate, userEmail }: { onNavigate?: () => void; userEmail?: string } = {}) {
  const displayName = userEmail ? userEmail.split("@")[0] : "Usuario";
  const initials = displayName.slice(0, 1).toUpperCase();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const [finanzasOpen, setFinanzasOpen] = useState(() =>
    finanzasPaths.some((p) => pathname.startsWith(p))
  );
  const [catalogosOpen, setCatalogosOpen] = useState(() =>
    catalogosPaths.some((p) => pathname.startsWith(p))
  );

  const subItemClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors duration-150 cursor-pointer",
      isActive
        ? "border-l-2 border-primary bg-primary/[0.08] text-foreground font-medium"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  return (
    <aside className="w-56 h-full flex flex-col bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] text-[var(--sidebar-foreground)] shadow-sm">

      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--sidebar-primary)] shrink-0">
          <Store className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="leading-none min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">Sistema Club</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Gestión comercial</p>
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 min-h-0 px-2 py-3">
        <nav className="space-y-0.5">

          {/* ── OPERACIONES ────────────────────────────────────── */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-1">
            Operaciones
          </p>

          {primaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 cursor-pointer group",
                  isActive
                    ? "border-l-2 border-primary bg-primary/[0.08] text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  <Icon className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground"
                  )} />
                  <span className="flex-1">{item.title}</span>
                </div>
              </Link>
            );
          })}

          {/* ── FINANZAS ────────────────────────────────────────── */}
          <div className="my-2 border-t border-[var(--sidebar-border)]" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-1">
            Finanzas
          </p>

          <button
            onClick={() => setFinanzasOpen((v) => !v)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer group",
              finanzasPaths.some((p) => pathname.startsWith(p))
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <BarChart3 className="w-4 h-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
            <span className="flex-1 text-left">Finanzas</span>
            {finanzasOpen
              ? <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
              : <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
            }
          </button>

          {finanzasOpen && (
            <div className="ml-3 pl-3 border-l border-[var(--sidebar-border)] space-y-0.5">
              {finanzasNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={onNavigate}>
                    <div className={subItemClass(pathname.startsWith(item.href))}>
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {item.title}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── CATÁLOGOS ───────────────────────────────────────── */}
          <div className="my-2 border-t border-[var(--sidebar-border)]" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pt-1 pb-1">
            Catálogos
          </p>

          <button
            onClick={() => setCatalogosOpen((v) => !v)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer group",
              catalogosPaths.some((p) => pathname.startsWith(p))
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <BookOpen className="w-4 h-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
            <span className="flex-1 text-left">Catálogos</span>
            {catalogosOpen
              ? <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
              : <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
            }
          </button>

          {catalogosOpen && (
            <div className="ml-3 pl-3 border-l border-[var(--sidebar-border)] space-y-0.5">
              {catalogosNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={onNavigate}>
                    <div className={subItemClass(pathname.startsWith(item.href))}>
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {item.title}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

        </nav>
      </ScrollArea>

      {/* Footer — settings + usuario + logout */}
      <div className="px-2 py-3 border-t border-[var(--sidebar-border)] space-y-1">
        <Link href="/settings" onClick={onNavigate}>
          <div className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-150 cursor-pointer group",
            pathname.startsWith("/settings")
              ? "border-l-2 border-primary bg-primary/[0.08] text-foreground font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}>
            <Settings className={cn("w-4 h-4 shrink-0 transition-colors",
              pathname.startsWith("/settings") ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground"
            )} />
            <span className="flex-1">Configuración</span>
          </div>
        </Link>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md group">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
            {initials}
          </div>
          <div className="leading-none min-w-0 flex-1">
            <p className="text-xs text-foreground font-medium truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="shrink-0 p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </aside>
  );
}
