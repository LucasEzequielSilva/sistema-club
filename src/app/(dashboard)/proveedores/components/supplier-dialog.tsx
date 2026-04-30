"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

type FormState = {
  name: string;
  cuit: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  cuit: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  isActive: true,
};

export function SupplierDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: SupplierDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Load data when editing
  useEffect(() => {
    if (!open) return;

    if (editingId) {
      setFetching(true);
      trpc.proveedores.getById
        .query({ id: editingId })
        .then((s) => {
          setForm({
            name: s.name,
            cuit: s.cuit ?? "",
            phone: s.phone ?? "",
            email: s.email ?? "",
            address: s.address ?? "",
            notes: s.notes ?? "",
            isActive: s.isActive,
          });
        })
        .catch(() => toast.error("No se pudo cargar el proveedor"))
        .finally(() => setFetching(false));
    } else {
      setForm(EMPTY);
    }
  }, [open, editingId]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        await trpc.proveedores.update.mutate({
          id: editingId,
          name: form.name,
          cuit: form.cuit,
          phone: form.phone,
          email: form.email || undefined,
          address: form.address,
          notes: form.notes,
          isActive: form.isActive,
        });
        toast.success(`"${form.name}" actualizado`);
      } else {
        await trpc.proveedores.create.mutate({
          name: form.name,
          cuit: form.cuit,
          phone: form.phone,
          email: form.email || undefined,
          address: form.address,
          notes: form.notes,
        });
        toast.success(`"${form.name}" creado`);
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Editar" : "Nuevo"} Proveedor
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modificá los datos del proveedor"
              : "Completá los datos del nuevo proveedor"}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-gray-400">Cargando…</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre */}
            <div>
              <Label htmlFor="name">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={set("name")}
                placeholder="Ej: Proveedor S.A."
                required
                autoFocus
              />
            </div>

            {/* CUIT + Teléfono */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  value={form.cuit}
                  onChange={set("cuit")}
                  placeholder="20-12345678-9"
                />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="+54 9 11 1234-5678"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="contacto@proveedor.com"
              />
            </div>

            {/* Dirección */}
            <div>
              <Label htmlFor="address">Dirección / Ubicación</Label>
              <Input
                id="address"
                value={form.address}
                onChange={set("address")}
                placeholder="Av. Corrientes 1234, CABA"
              />
            </div>

            {/* Notas */}
            <div>
              <Label htmlFor="notes">Notas</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={set("notes")}
                placeholder="Observaciones, condiciones de pago, contacto, etc."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Activo (solo al editar) */}
            {editingId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isActive">Activo</Label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
