"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Package,
  ShoppingCart,
  Receipt,
  Bug,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";

type DbStats = {
  accounts: number;
  users: number;
  products: number;
  sales: number;
  purchases: number;
  openBugs: number;
  criticalBugs: number;
};

type RecentBug = {
  id: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  userEmail: string | null;
  createdAt: Date;
};

type RecentSale = {
  id: string;
  saleDate: Date;
  unitPrice: number;
  quantity: number;
  discountPct: number;
  status: string;
  product: { name: string } | null;
};

const SEVERITY_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const s = Math.round(diffMs / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d2 = Math.round(h / 24);
  if (d2 < 30) return `hace ${d2}d`;
  return date.toLocaleDateString("es-AR");
}

function formatCurrency(n: number): string {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  loading: boolean;
  accent?: "danger";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          className={`w-4 h-4 ${
            accent === "danger" ? "text-destructive" : "text-muted-foreground"
          }`}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        ) : (
          <p
            className={`text-3xl font-bold ${
              accent === "danger" && (value ?? 0) > 0 ? "text-destructive" : ""
            }`}
          >
            {value ?? 0}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [bugs, setBugs] = useState<RecentBug[] | null>(null);
  const [sales, setSales] = useState<RecentSale[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, b, sa] = await Promise.all([
          trpc.admin.dbStats.query(),
          trpc.admin.recentBugs.query({ limit: 5 }),
          trpc.admin.recentSales.query({ limit: 5 }),
        ]);
        if (cancelled) return;
        setStats(s);
        setBugs(b as RecentBug[]);
        setSales(sa as RecentSale[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Panel Admin</h1>
        <p className="text-muted-foreground text-sm">
          Vista rápida del estado del sistema
        </p>
      </div>

      {stats && stats.criticalBugs > 0 && (
        <Link
          href="/admin/bugs?severity=critical"
          className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3 hover:bg-red-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">
              Hay {stats.criticalBugs} bug{stats.criticalBugs === 1 ? "" : "s"} crítico
              {stats.criticalBugs === 1 ? "" : "s"} pendiente
              {stats.criticalBugs === 1 ? "" : "s"}
            </span>
          </div>
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Building2} label="Cuentas" value={stats?.accounts} loading={loading} />
        <StatCard icon={Users} label="Usuarios" value={stats?.users} loading={loading} />
        <StatCard icon={Package} label="Productos" value={stats?.products} loading={loading} />
        <StatCard icon={Receipt} label="Ventas" value={stats?.sales} loading={loading} />
        <StatCard icon={ShoppingCart} label="Compras" value={stats?.purchases} loading={loading} />
        <StatCard
          icon={Bug}
          label="Bugs abiertos"
          value={stats?.openBugs}
          loading={loading}
          accent="danger"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos reportes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !bugs || bugs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay reportes
              </p>
            ) : (
              <ul className="divide-y divide-border -mx-2">
                {bugs.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/admin/bugs/${b.id}`}
                      className="flex items-center gap-3 px-2 py-2.5 hover:bg-muted rounded-md transition-colors"
                    >
                      <Badge
                        variant="outline"
                        className={SEVERITY_CLASS[b.severity] ?? SEVERITY_CLASS.low}
                      >
                        {b.severity}
                      </Badge>
                      <span className="flex-1 text-sm truncate">{b.title}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelative(b.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas ventas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !sales || sales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay ventas
              </p>
            ) : (
              <ul className="divide-y divide-border -mx-2">
                {sales.map((s) => {
                  const total =
                    s.unitPrice * s.quantity * (1 - (s.discountPct ?? 0) / 100);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 px-2 py-2.5"
                    >
                      <span className="text-xs text-muted-foreground whitespace-nowrap w-20">
                        {new Date(s.saleDate).toLocaleDateString("es-AR")}
                      </span>
                      <span className="flex-1 text-sm truncate">
                        {s.product?.name ?? "—"}
                      </span>
                      <span className="text-sm font-medium whitespace-nowrap">
                        {formatCurrency(total)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
