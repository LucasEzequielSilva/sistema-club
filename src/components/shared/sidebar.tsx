"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    title: "Tablero",
    href: "/tablero",
    icon: "🏠",
  },
  {
    title: "Clasificaciones",
    href: "/clasificaciones",
    icon: "📂",
  },
  {
    title: "Proveedores",
    href: "/proveedores",
    icon: "🏢",
  },
  {
    title: "Productos",
    href: "/productos",
    icon: "📦",
  },
  {
    title: "Ventas",
    href: "/ventas",
    icon: "💰",
  },
  {
    title: "Compras",
    href: "/compras",
    icon: "🛒",
  },
  {
    title: "Mercadería",
    href: "/mercaderia",
    icon: "📋",
  },
  {
    title: "Resumen",
    href: "/resumen",
    icon: "📊",
  },
  {
    title: "Estados",
    href: "/estados-resultados",
    icon: "📈",
  },
  {
    title: "Cuentas",
    href: "/cuentas",
    icon: "🏦",
  },
  {
    title: "Cashflow",
    href: "/cashflow",
    icon: "📉",
  },
  {
    title: "Cuadro KPIs",
    href: "/cuadro-resumen",
    icon: "🎯",
  },
  {
    title: "Punto de Venta",
    href: "/pos",
    icon: "🛍️",
  },
  {
    title: "Facturacion",
    href: "/facturacion",
    icon: "🧾",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white border-r border-slate-800">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Sistema Club</h1>
        <p className="text-sm text-slate-400 mt-1">MVP</p>
      </div>

      <nav className="px-3 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className="w-full justify-start"
              >
                <span className="mr-2">{item.icon}</span>
                {item.title}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-4 left-3 right-3">
        <Button variant="outline" className="w-full text-white border-slate-700 hover:bg-slate-800">
          Logout
        </Button>
      </div>
    </aside>
  );
}
