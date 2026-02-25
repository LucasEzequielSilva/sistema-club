"use client";

import { useState, useEffect } from "react";
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

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

const SUGGESTED_METHODS = [
  { name: "Efectivo", days: 0 },
  { name: "Transferencia bancaria", days: 0 },
  { name: "Cheque", days: 2 },
  { name: "Cheque diferido 30 días", days: 32 },
  { name: "Cheque diferido 45 días", days: 47 },
  { name: "Cheque diferido 60 días", days: 62 },
  { name: "Mercado Pago", days: 0 },
  { name: "Tarjeta de crédito", days: 18 },
  { name: "Tarjeta de débito", days: 3 },
];

export function PaymentMethodDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: PaymentMethodDialogProps) {
  const [name, setName] = useState("");
  const [accreditationDays, setAccreditationDays] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setAccreditationDays("0");
      setIsActive(true);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        await trpc.clasificaciones.updatePaymentMethod.mutate({
          id: editingId,
          name: name || undefined,
          accreditationDays: parseInt(accreditationDays) || undefined,
          isActive,
        });
        toast.success("Método de pago actualizado");
      } else {
        await trpc.clasificaciones.createPaymentMethod.mutate({
          accountId,
          name,
          accreditationDays: parseInt(accreditationDays),
        });
        toast.success("Método de pago creado");
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Editar" : "Nuevo"} Método de Pago
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modifica los detalles del método de pago"
              : "Crea un nuevo método de pago/cobro"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Efectivo, Cheque"
              required
              list="suggestions"
            />
            <datalist id="suggestions">
              {SUGGESTED_METHODS.map((method) => (
                <option
                  key={method.name}
                  value={method.name}
                />
              ))}
            </datalist>
          </div>

          <div>
            <Label htmlFor="accreditationDays">Días de Acreditación</Label>
            <Input
              id="accreditationDays"
              type="number"
              value={accreditationDays}
              onChange={(e) => setAccreditationDays(e.target.value)}
              placeholder="0 = inmediato"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Cantidad de días para que se acredite el dinero
            </p>
          </div>

          {editingId && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive">Activo</Label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
