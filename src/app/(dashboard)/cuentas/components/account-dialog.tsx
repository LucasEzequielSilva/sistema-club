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

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

type FormState = {
  name: string;
  initialBalance: string;
  balanceDate: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  initialBalance: "0",
  balanceDate: "",
  isActive: true,
};

export function AccountDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: AccountDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Load data when editing
  useEffect(() => {
    if (!open) return;

    if (editingId) {
      setFetching(true);
      trpc.cuentas.listAccounts
        .query({ includeInactive: true })
        .then((accounts) => {
          const acc = accounts.find((a) => a.id === editingId);
          if (acc) {
            setForm({
              name: acc.name,
              initialBalance: String(acc.initialBalance),
              balanceDate: acc.balanceDate
                ? new Date(acc.balanceDate).toISOString().split("T")[0]
                : "",
              isActive: acc.isActive,
            });
          }
        })
        .catch(() => toast.error("No se pudo cargar la cuenta"))
        .finally(() => setFetching(false));
    } else {
      setForm(EMPTY);
    }
  }, [open, editingId, accountId]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        await trpc.cuentas.updateAccount.mutate({
          id: editingId,
          name: form.name,
          initialBalance: parseFloat(form.initialBalance) || 0,
          balanceDate: form.balanceDate ? new Date(form.balanceDate) : null,
          isActive: form.isActive,
        });
        toast.success(`"${form.name}" actualizada`);
      } else {
        await trpc.cuentas.createAccount.mutate({
          name: form.name,
          initialBalance: parseFloat(form.initialBalance) || 0,
          balanceDate: form.balanceDate ? new Date(form.balanceDate) : null,
        });
        toast.success(`"${form.name}" creada`);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Editar" : "Nueva"} Cuenta Bancaria
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modificá los datos de la cuenta"
              : "Creá una nueva cuenta bancaria o caja"}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-gray-400">Cargando...</div>
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
                placeholder="Ej: Cuenta Galicia, Caja chica, MP"
                required
                autoFocus
              />
            </div>

            {/* Saldo inicial + Fecha */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="initialBalance">Saldo inicial ($)</Label>
                <Input
                  id="initialBalance"
                  type="number"
                  step="0.01"
                  value={form.initialBalance}
                  onChange={set("initialBalance")}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="balanceDate">Fecha del saldo</Label>
                <Input
                  id="balanceDate"
                  type="date"
                  value={form.balanceDate}
                  onChange={set("balanceDate")}
                />
              </div>
            </div>

            {/* Activo (solo al editar) */}
            {editingId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isActive">Activa</Label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
