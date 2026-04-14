"use client";

import { useEffect, useMemo, useState } from "react";
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

interface PaymentChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

export function PaymentChannelDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: PaymentChannelDialogProps) {
  const [name, setName] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [accreditationDays, setAccreditationDays] = useState("0");
  const [feePct, setFeePct] = useState("0");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const accountsOptions = useMemo(
    () => accounts.filter((a) => a.isActive),
    [accounts]
  );

  useEffect(() => {
    if (!open) return;
    Promise.all([
      trpc.clasificaciones.listPaymentAccounts.query({ accountId }),
      trpc.clasificaciones.listPaymentMethods.query({ accountId }),
    ])
      .then(([accs, meths]) => {
        setAccounts(accs as any[]);
        setMethods((meths as any[]).filter((m) => m.isActive));
      })
      .catch(() => {});
  }, [open, accountId]);

  useEffect(() => {
    if (!open) return;

    if (editingId) {
      setFetching(true);
      trpc.clasificaciones.listPaymentChannels
        .query({ accountId })
        .then((channels: any[]) => {
          const ch = channels.find((c) => c.id === editingId);
          if (!ch) return;
          setName(ch.name ?? "");
          setPaymentAccountId(ch.paymentAccountId ?? "");
          setPaymentMethodId(ch.paymentMethodId ?? "");
          setAccreditationDays(String(ch.accreditationDays ?? 0));
          setFeePct(String(ch.feePct ?? 0));
          setIsDefault(Boolean(ch.isDefault));
          setIsActive(Boolean(ch.isActive));
        })
        .finally(() => setFetching(false));
    } else {
      setName("");
      setPaymentAccountId("");
      setPaymentMethodId("");
      setAccreditationDays("0");
      setFeePct("0");
      setIsDefault(false);
      setIsActive(true);
    }
  }, [open, editingId, accountId]);

  useEffect(() => {
    if (!open || editingId || paymentAccountId) return;
    const defaultAcc = accountsOptions.find((a) => a.isDefault) || accountsOptions[0];
    if (defaultAcc) setPaymentAccountId(defaultAcc.id);
  }, [open, editingId, paymentAccountId, accountsOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!paymentAccountId) {
        toast.error("Seleccioná una cuenta receptora");
        setLoading(false);
        return;
      }

      if (editingId) {
        await trpc.clasificaciones.updatePaymentChannel.mutate({
          id: editingId,
          name: name.trim() || undefined,
          paymentAccountId,
          paymentMethodId: paymentMethodId || null,
          accreditationDays: parseInt(accreditationDays || "0", 10),
          feePct: parseFloat(feePct || "0"),
          isDefault,
          isActive,
        });
        toast.success("Canal actualizado");
      } else {
        await trpc.clasificaciones.createPaymentChannel.mutate({
          accountId,
          name: name.trim(),
          paymentAccountId,
          paymentMethodId: paymentMethodId || null,
          accreditationDays: parseInt(accreditationDays || "0", 10),
          feePct: parseFloat(feePct || "0"),
          isDefault,
        });
        toast.success("Canal creado");
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
          <DialogTitle>{editingId ? "Editar" : "Nuevo"} Canal de Pago</DialogTitle>
          <DialogDescription>
            El canal define acreditación/comisión y se vincula a una cuenta receptora.
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pc-name">Nombre *</Label>
              <Input
                id="pc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Tarjeta crédito 1 pago"
                required
              />
            </div>

            <div>
              <Label>Cuenta receptora *</Label>
              <Select value={paymentAccountId || "none"} onValueChange={(v) => setPaymentAccountId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar...</SelectItem>
                  {accountsOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Método legacy (opcional)</Label>
              <Select value={paymentMethodId || "none"} onValueChange={(v) => setPaymentMethodId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin método asociado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin método asociado</SelectItem>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pc-days">Días acreditación</Label>
                <Input
                  id="pc-days"
                  type="number"
                  min="0"
                  value={accreditationDays}
                  onChange={(e) => setAccreditationDays(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pc-fee">Comisión %</Label>
                <Input
                  id="pc-fee"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={feePct}
                  onChange={(e) => setFeePct(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Canal por defecto
              </label>
              {editingId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Activo
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
