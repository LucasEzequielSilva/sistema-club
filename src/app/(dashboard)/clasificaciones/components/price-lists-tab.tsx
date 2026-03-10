"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Star, Trash2, Loader2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

type PriceList = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  _count: { items: number; sales: number };
};

interface PriceListsTabProps {
  accountId: string;
}

export function PriceListsTab({ accountId }: PriceListsTabProps) {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDefault, setNewDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/price-lists");
      if (res.ok) setLists(await res.json());
    } catch {
      toast.error("Error al cargar listas de precios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/price-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), isDefault: newDefault }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al crear"); return; }
      toast.success(`Lista "${newName}" creada`);
      setNewName("");
      setNewDefault(false);
      setAdding(false);
      load();
    } catch {
      toast.error("Error al crear la lista");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string, name: string) => {
    try {
      const res = await fetch("/api/price-lists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDefault: true }),
      });
      if (!res.ok) { toast.error("Error al cambiar default"); return; }
      toast.success(`"${name}" es ahora la lista predeterminada`);
      load();
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la lista "${name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/price-lists?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al eliminar"); return; }
      toast.success(`"${name}" eliminada`);
      load();
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Las listas de precios permiten tener distintos precios de venta por canal (ej: minorista, mayorista, distribuidor).
            Cada producto tiene un markup % por lista.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="w-4 h-4 mr-1" /> Nueva lista
        </Button>
      </div>

      {/* Formulario de nueva lista */}
      {adding && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-semibold text-foreground">Nueva lista de precios</p>
          <Input
            autoFocus
            placeholder="Ej: Minorista, Mayorista, Distribuidor..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="newDefault"
              checked={newDefault}
              onChange={(e) => setNewDefault(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="newDefault" className="text-sm text-muted-foreground">
              Lista predeterminada (se usa en ventas y en el Punto de Venta)
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Guardar
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewName(""); setNewDefault(false); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista vacía */}
      {lists.length === 0 && !adding && (
        <div className="border border-dashed border-border rounded-xl p-10 text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Tag className="w-6 h-6 text-muted-foreground/50" />
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">Sin listas de precios todavía</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Creá al menos una lista para poder definir precios de venta y markup en tus productos.
          </p>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Crear primera lista
          </Button>
        </div>
      )}

      {/* Lista existente */}
      {lists.length > 0 && (
        <div className="space-y-2">
          {lists.map((list) => (
            <div
              key={list.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                list.isDefault
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card hover:bg-muted/30"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">{list.name}</span>
                  {list.isDefault && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 bg-primary/10 text-primary border-primary/20">
                      <Star className="w-2.5 h-2.5 mr-0.5" />
                      Predeterminada
                    </Badge>
                  )}
                  {!list.isActive && (
                    <Badge variant="secondary" className="text-[10px] px-1.5">Inactiva</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {list._count.items} {list._count.items === 1 ? "producto" : "productos"} ·{" "}
                  {list._count.sales} {list._count.sales === 1 ? "venta" : "ventas"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!list.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(list.id, list.name)}
                    className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                    title="Hacer predeterminada"
                  >
                    <Star className="w-3.5 h-3.5 mr-1" />
                    Predeterminar
                  </Button>
                )}
                {!list.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === list.id}
                    onClick={() => handleDelete(list.id, list.name)}
                    title="Eliminar lista"
                  >
                    {deletingId === list.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
