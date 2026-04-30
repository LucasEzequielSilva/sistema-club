"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, Eye, EyeOff, ShieldCheck, User, Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AccountConfig = {
  id: string;
  name: string;
  taxStatus: string;
  ivaRate: number;
  includeIvaInCost: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
};

type FormState = { email: string; password: string; name: string; role: "admin" | "viewer" };
const EMPTY_FORM: FormState = { email: "", password: "", name: "", role: "admin" };

export default function SettingsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; password: string; role: "admin" | "viewer"; isActive: boolean }>({ name: "", password: "", role: "admin", isActive: true });
  const [showEditPass, setShowEditPass] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Configuración del negocio
  const [account, setAccount] = useState<AccountConfig | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);

  const load = useCallback(async (_aid: string) => {
    setLoading(true);
    try {
      const result = await trpc.users.list.query();
      setUsers(result as UserRow[]);
    } catch {
      toast.error("Error al cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.accountId) {
          setAccountId(data.accountId);
          load(data.accountId);
        }
      })
      .catch(() => toast.error("Error al obtener la sesión."));

    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setAccount(data);
      })
      .catch(() => {});
  }, [load]);

  const handleAccountSave = async () => {
    if (!account) return;
    setAccountSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxStatus: account.taxStatus,
          ivaRate: account.ivaRate,
          includeIvaInCost: account.includeIvaInCost,
          name: account.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al guardar"); return; }
      setAccount(data);
      toast.success("Configuración del negocio guardada");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setAccountSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!accountId) return;
    if (!form.email || !form.password) return toast.error("Email y contraseña son obligatorios.");
    setSaving(true);
    try {
      await trpc.users.create.mutate(form);
      toast.success("Usuario creado.");
      setShowForm(false);
      setForm(EMPTY_FORM);
      load(accountId);
    } catch (e: any) {
      toast.error(e.message ?? "Error al crear usuario.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    setEditForm({ name: u.name ?? "", password: "", role: u.role as "admin" | "viewer", isActive: u.isActive });
    setShowEditPass(false);
  };

  const handleUpdate = async (id: string) => {
    if (!accountId) return;
    setEditSaving(true);
    try {
      const payload: any = { id, name: editForm.name, role: editForm.role, isActive: editForm.isActive };
      if (editForm.password) payload.password = editForm.password;
      await trpc.users.update.mutate(payload);
      toast.success("Usuario actualizado.");
      setEditingId(null);
      load(accountId);
    } catch (e: any) {
      toast.error(e.message ?? "Error al actualizar.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (!accountId) return;
    if (!confirm(`¿Eliminar a ${u.name ?? u.email}?`)) return;
    setDeletingId(u.id);
    try {
      await trpc.users.delete.mutate({ id: u.id });
      toast.success("Usuario eliminado.");
      load(accountId);
    } catch (e: any) {
      toast.error(e.message ?? "Error al eliminar.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* ── Configuración del negocio ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Configuración del negocio</h2>
        </div>

        {account ? (
          <div className="border border-border rounded-xl p-5 space-y-5 bg-card">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre del negocio</label>
              <Input
                value={account.name}
                onChange={(e) => setAccount((a) => a ? { ...a, name: e.target.value } : a)}
                placeholder="Ej: Mi Negocio SA"
              />
            </div>

            {/* Régimen fiscal */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Régimen fiscal</label>
              <p className="text-xs text-muted-foreground/70">
                Esto afecta cómo se calculan los precios con IVA y los análisis económicos.
              </p>
              <div className="flex gap-2">
                {(["monotributista", "responsable_inscripto"] as const).map((ts) => (
                  <button
                    key={ts}
                    onClick={() => setAccount((a) => a ? { ...a, taxStatus: ts } : a)}
                    className={cn(
                      "flex-1 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all",
                      account.taxStatus === ts
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {ts === "monotributista" ? "Monotributista" : "Responsable Inscripto (RI)"}
                  </button>
                ))}
              </div>
              {account.taxStatus === "monotributista" && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  Como monotributista, el IVA está incluido en tus precios de venta. No discriminás IVA en facturas.
                </p>
              )}
              {account.taxStatus === "responsable_inscripto" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    Como RI, discriminás IVA en facturas. Los precios de venta se muestran con y sin IVA.
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-muted-foreground">Alícuota IVA:</label>
                    <div className="flex gap-1.5">
                      {[21, 10.5].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => setAccount((a) => a ? { ...a, ivaRate: rate } : a)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                            account.ivaRate === rate
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border text-muted-foreground hover:border-primary/30"
                          )}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button size="sm" onClick={handleAccountSave} disabled={accountSaving} className="gap-1.5">
              {accountSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {accountSaving ? "Guardando..." : "Guardar configuración"}
            </Button>
          </div>
        ) : (
          <div className="border border-border rounded-xl p-5 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* ── Usuarios ── */}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestioná quién tiene acceso a la cuenta.</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </Button>
        )}
      </div>

      {/* Formulario nuevo usuario */}
      {showForm && (
        <div className="border border-border rounded-xl p-5 bg-muted/30 space-y-4">
          <p className="text-sm font-semibold text-foreground">Nuevo usuario</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Nombre</label>
              <Input placeholder="Ej: Lucía" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Email *</label>
              <Input type="email" placeholder="email@ejemplo.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Contraseña *</label>
              <div className="relative">
                <Input type={showPass ? "text" : "password"} placeholder="Mínimo 4 caracteres" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="pr-9" />
                <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Rol</label>
              <div className="flex gap-2 h-10">
                {(["admin", "viewer"] as const).map((r) => (
                  <button key={r} onClick={() => setForm((f) => ({ ...f, role: r }))}
                    className={cn("flex-1 text-xs rounded-lg border font-medium transition-colors",
                      form.role === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/30")}>
                    {r === "admin" ? "Admin" : "Solo lectura"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleCreate} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? "Creando..." : "Crear usuario"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No hay usuarios.</div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="p-4">
                {editingId === u.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Nombre</label>
                        <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Nueva contraseña</label>
                        <div className="relative">
                          <Input type={showEditPass ? "text" : "password"} placeholder="Dejar vacío para no cambiar"
                            value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} className="pr-9" />
                          <button type="button" onClick={() => setShowEditPass((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showEditPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2">
                        {(["admin", "viewer"] as const).map((r) => (
                          <button key={r} onClick={() => setEditForm((f) => ({ ...f, role: r }))}
                            className={cn("text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors",
                              editForm.role === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/30")}>
                            {r === "admin" ? "Admin" : "Solo lectura"}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-auto">
                        <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                        Activo
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleUpdate(u.id)} disabled={editSaving} className="gap-1.5">
                        {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {editSaving ? "Guardando..." : "Guardar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      u.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {(u.name ?? u.email).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                        u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        {u.role === "admin" ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {u.role === "admin" ? "Admin" : "Solo lectura"}
                      </span>
                      {!u.isActive && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactivo</span>}
                      <button onClick={() => startEdit(u)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
                        {deletingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
