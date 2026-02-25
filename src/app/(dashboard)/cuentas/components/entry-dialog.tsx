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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  bankAccounts: { id: string; name: string }[];
}

type FormState = {
  bankAccountId: string;
  entryDate: string;
  movementType: "ingreso" | "egreso";
  concept: string;
  amount: string;
  notes: string;
};

const EMPTY: FormState = {
  bankAccountId: "",
  entryDate: new Date().toISOString().split("T")[0],
  movementType: "ingreso",
  concept: "",
  amount: "",
  notes: "",
};

export function EntryDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  bankAccounts,
}: EntryDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        ...EMPTY,
        // Default to first account if only one exists
        bankAccountId: bankAccounts.length === 1 ? bankAccounts[0].id : "",
      });
    }
  }, [open, bankAccounts]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await trpc.cuentas.createEntry.mutate({
        accountId,
        bankAccountId: form.bankAccountId,
        entryDate: new Date(form.entryDate),
        movementType: form.movementType,
        concept: form.concept,
        amount: parseFloat(form.amount) || 0,
        notes: form.notes || undefined,
      });
      toast.success("Movimiento registrado");
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
          <DialogTitle>Nuevo Movimiento Manual</DialogTitle>
          <DialogDescription>
            Registrá un ingreso o egreso manual en una cuenta
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cuenta */}
          <div>
            <Label>
              Cuenta <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.bankAccountId}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, bankAccountId: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.movementType}
                onValueChange={(v: "ingreso" | "egreso") =>
                  setForm((prev) => ({ ...prev, movementType: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="entryDate">Fecha</Label>
              <Input
                id="entryDate"
                type="date"
                value={form.entryDate}
                onChange={set("entryDate")}
                required
              />
            </div>
          </div>

          {/* Concepto */}
          <div>
            <Label htmlFor="concept">
              Concepto <span className="text-red-500">*</span>
            </Label>
            <Input
              id="concept"
              value={form.concept}
              onChange={set("concept")}
              placeholder="Ej: Retiro socio, Pago alquiler, etc."
              required
            />
          </div>

          {/* Monto */}
          <div>
            <Label htmlFor="amount">
              Monto ($) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={set("amount")}
              placeholder="0.00"
              required
            />
          </div>

          {/* Notas */}
          <div>
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={set("notes")}
              placeholder="Observaciones opcionales"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.bankAccountId}>
              {loading ? "Guardando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
