"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  ShoppingCart,
  Monitor,
  BarChart3,
  ChevronRight,
  ChevronDown,
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
  ChevronsUpDown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

// ─── Ítems de nav principal ─────────────────────────────────────────────────
const primaryNav = [
  { title: "Hoy",            href: "/tablero",      icon: Sun },
  { title: "Ventas",         href: "/ventas",        icon: TrendingUp },
  { title: "Egresos",        href: "/compras",       icon: ShoppingCart },
  { title: "Punto de Venta", href: "/pos",           icon: Monitor },
];

// ─── Sub-ítems de Finanzas (colapsable) ─────────────────────────────────────
const finanzasNav = [
  { title: "Resumen",       href: "/resumen",            icon: BarChart3, locked: true },
  { title: "Cashflow",      href: "/cashflow",           icon: Waves,     locked: true },
  { title: "Cuadro KPIs",   href: "/cuadro-resumen",     icon: Target,    locked: true },
  { title: "Estados",       href: "/estados-resultados", icon: FileText,  locked: true },
  { title: "Cuentas",       href: "/cuentas",            icon: Landmark,  locked: true },
];

// ─── Configuraciones (colapsable) ────────────────────────────────────────────
const catalogosNav = [
  { title: "Productos",       href: "/productos",       icon: Package,   locked: false },
  { title: "Proveedores",     href: "/proveedores",     icon: Building2, locked: false },
  { title: "Clasificaciones", href: "/clasificaciones", icon: Tag,       locked: false },
  { title: "Mercadería",      href: "/mercaderia",      icon: Warehouse, locked: false },
  { title: "Facturación",     href: "/facturacion",     icon: Receipt,   locked: true  },
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

      {/* Brand — click = home */}
      <Link
        href="/tablero"
        onClick={onNavigate}
        className="flex items-center gap-3 px-4 py-4 border-b border-[var(--sidebar-border)] hover:bg-accent/50 transition-colors cursor-pointer"
      >
        <Image
          src="/brand/icon-app.svg"
          alt="Acelerator"
          width={24}
          height={24}
          className="rounded-lg shrink-0"
        />
        <div className="leading-none min-w-0">
          <p className="text-sm font-bold text-foreground truncate">Acelerator</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">by Matías Randazzo</p>
        </div>
      </Link>

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
            <span className="inline-flex items-center px-1.5 py-[1px] rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-semibold uppercase tracking-wider">
              Pronto
            </span>
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
                      <span className="flex-1">{item.title}</span>
                      {item.locked && (
                        <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-[1px] rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-semibold uppercase tracking-wider">
                          Pronto
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── CONFIGURACIONES ─────────────────────────────────── */}
          <div className="my-2 border-t border-[var(--sidebar-border)]" />

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
            <span className="flex-1 text-left">Configuraciones</span>
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
                      <span className="flex-1">{item.title}</span>
                      {item.locked && (
                        <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-[1px] rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-semibold uppercase tracking-wider">
                          Pronto
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

        </nav>
      </ScrollArea>

      {/* Footer — usuario con dropdown */}
      <div className="p-2 border-t border-[var(--sidebar-border)]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-foreground transition-colors group">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 overflow-hidden ring-1 ring-primary/20">
                {initials}
              </div>
              <div className="leading-none min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate">{displayName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{userEmail}</p>
              </div>
              <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-[calc(14rem-16px)]" sideOffset={8}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 border border-primary/20">
                  {initials}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  <span className="truncate text-[10px] text-muted-foreground">{userEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" onClick={onNavigate} className="flex items-center cursor-pointer w-full">
                <Settings className="mr-2 w-4 h-4 text-muted-foreground" />
                <span>Configuración</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 w-4 h-4" />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </aside>
  );
}
