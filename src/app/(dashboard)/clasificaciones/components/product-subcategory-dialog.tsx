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

interface SubcategoryInitialData {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface ProductSubcategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  categoryId: string;
  categoryName: string;
  initialData: SubcategoryInitialData | null;
}

export function ProductSubcategoryDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  categoryId,
  categoryName,
  initialData,
}: ProductSubcategoryDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description ?? "");
      setSortOrder(String(initialData.sortOrder));
      setIsActive(initialData.isActive);
    } else {
      setName("");
      setDescription("");
      setSortOrder("0");
      setIsActive(true);
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (initialData) {
        await trpc.clasificaciones.updateProductSubcategory.mutate({
          id: initialData.id,
          name: name || undefined,
          description: description || undefined,
          sortOrder: parseInt(sortOrder) || undefined,
          isActive,
        });
        toast.success("Subcategoría actualizada");
      } else {
        await trpc.clasificaciones.createProductSubcategory.mutate({
          categoryId,
          name,
          description: description || undefined,
          sortOrder: parseInt(sortOrder) || 0,
        });
        toast.success("Subcategoría creada");
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
            {initialData ? "Editar" : "Nueva"} subcategoría
          </DialogTitle>
          <DialogDescription>
            Pertenece a la categoría <span className="font-medium">{categoryName}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="sub-name">Nombre *</Label>
            <Input
              id="sub-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Triángulo, Copa, Deportiva"
              required
            />
          </div>

          <div>
            <Label htmlFor="sub-description">Descripción</Label>
            <Input
              id="sub-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <Label htmlFor="sub-sortOrder">
              Orden{" "}
              <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
            </Label>
            <Input
              id="sub-sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
          </div>

          {initialData && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="sub-isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="sub-isActive">Activa</Label>
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
