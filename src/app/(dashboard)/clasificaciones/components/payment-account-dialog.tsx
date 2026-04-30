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

interface PaymentAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

export function PaymentAccountDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: PaymentAccountDialogProps) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editingId) {
      setFetching(true);
      trpc.clasificaciones.listPaymentAccounts
        .query()
        .then((accounts: any[]) => {
          const acc = accounts.find((a) => a.id === editingId);
          if (!acc) return;
          setName(acc.name ?? "");
          setProvider(acc.provider ?? "");
          setIdentifier(acc.identifier ?? "");
          setIsDefault(Boolean(acc.isDefault));
          setIsActive(Boolean(acc.isActive));
        })
        .finally(() => setFetching(false));
    } else {
      setName("");
      setProvider("");
      setIdentifier("");
      setIsDefault(false);
      setIsActive(true);
    }
  }, [open, editingId, accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await trpc.clasificaciones.updatePaymentAccount.mutate({
          id: editingId,
          name: name.trim() || undefined,
          provider: provider.trim() || null,
          identifier: identifier.trim() || null,
          isDefault,
          isActive,
        });
        toast.success("Cuenta receptora actualizada");
      } else {
        await trpc.clasificaciones.createPaymentAccount.mutate({
          name: name.trim(),
          provider: provider.trim() || null,
          identifier: identifier.trim() || null,
          isDefault,
        });
        toast.success("Cuenta receptora creada");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar" : "Nueva"} Cuenta Receptora</DialogTitle>
          <DialogDescription>
            Definí dónde impacta el cobro (caja, banco, billetera, etc).
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pa-name">Nombre *</Label>
              <Input
                id="pa-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Caja principal"
                required
              />
            </div>

            <div>
              <Label htmlFor="pa-provider">Proveedor</Label>
              <Input
                id="pa-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Ej: Banco Galicia, Mercado Pago"
              />
            </div>

            <div>
              <Label htmlFor="pa-identifier">Identificador</Label>
              <Input
                id="pa-identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Alias, CBU/CVU, caja #1"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Cuenta por defecto
              </label>
              {editingId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Activa
                </label>
              )}
            </div>

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
