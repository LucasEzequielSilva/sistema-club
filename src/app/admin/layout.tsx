import Link from "next/link";
import Image from "next/image";
import { ShieldAlert, Bug, LayoutDashboard, Database, FlaskConical } from "lucide-react";
import { AdminNavLink } from "./components/admin-nav-link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Badge fijo arriba: MODO ADMIN */}
      <div className="sticky top-0 z-50 bg-destructive text-destructive-foreground px-4 py-1.5 text-xs font-semibold tracking-wide flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5" />
          MODO ADMIN — Acelerator
        </div>
        <Link href="/tablero" className="hover:underline">
          ← Volver al sistema
        </Link>
      </div>

      <div className="flex">
        {/* Sidebar admin */}
        <aside className="w-56 min-h-[calc(100vh-28px)] border-r border-border bg-card p-3 space-y-1">
          <div className="flex items-center gap-2 px-2 py-3 border-b border-border mb-2">
            <Image
              src="/brand/icon-app.svg"
              alt="Acelerator"
              width={24}
              height={24}
              className="rounded"
            />
            <div className="leading-tight">
              <p className="text-sm font-bold">Admin</p>
              <p className="text-[10px] text-muted-foreground">by Matías Randazzo</p>
            </div>
          </div>

          <AdminNavLink href="/admin" icon={<LayoutDashboard className="w-4 h-4" />} exact>
            Dashboard
          </AdminNavLink>
          <AdminNavLink href="/admin/bugs" icon={<Bug className="w-4 h-4" />}>
            Bugs & Feedback
          </AdminNavLink>
          <AdminNavLink href="/admin/tests" icon={<FlaskConical className="w-4 h-4" />}>
            Tests
          </AdminNavLink>
          <AdminNavLink href="/admin/db" icon={<Database className="w-4 h-4" />}>
            Database
          </AdminNavLink>
        </aside>

        {/* Contenido */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
