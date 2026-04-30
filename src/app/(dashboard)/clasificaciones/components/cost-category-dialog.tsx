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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CostCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

export function CostCategoryDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: CostCategoryDialogProps) {
  const [name, setName] = useState("");
  const [costType, setCostType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setCostType("");
      setDescription("");
      setSortOrder("0");
      setIsActive(true);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costType) {
      toast.error("Selecciona un tipo de costo");
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        await trpc.clasificaciones.updateCostCategory.mutate({
          id: editingId,
          name: name || undefined,
          costType: (costType as any) || undefined,
          description: description || undefined,
          sortOrder: parseInt(sortOrder) || undefined,
          isActive,
        });
        toast.success("Clasificación actualizada");
      } else {
        await trpc.clasificaciones.createCostCategory.mutate({
          name,
          costType: costType as "variable" | "fijo" | "impuestos",
          description: description || undefined,
          sortOrder: parseInt(sortOrder),
        });
        toast.success("Clasificación creada");
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
            {editingId ? "Editar" : "Nueva"} Clasificación de Costo
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modifica los detalles de la clasificación"
              : "Crea una nueva clasificación de costo"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Alquiler, Sueldos"
              required
            />
          </div>

          <div>
            <Label htmlFor="costType">Tipo *</Label>
            <Select value={costType} onValueChange={setCostType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="variable">Variable</SelectItem>
                <SelectItem value="fijo">Fijo</SelectItem>
                <SelectItem value="impuestos">Impuestos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <Label htmlFor="sortOrder">
              Orden de aparición{" "}
              <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
            </Label>
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Número que define el orden en el que aparece esta clasificación en las listas (0 = primero). Podés dejarlo en 0.
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
