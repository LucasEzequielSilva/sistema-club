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

interface ProductCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  editingId: string | null;
}

export function ProductCategoryDialog({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  accountId,
  editingId,
}: ProductCategoryDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Load existing category if editing
  useEffect(() => {
    if (editingId && open) {
      setLoadingEdit(true);
      // We'll need to fetch the category data
      // For now, reset form
      setName("");
      setDescription("");
      setSortOrder("0");
      setIsActive(true);
      setLoadingEdit(false);
    } else if (open) {
      // Reset form for new entry
      setName("");
      setDescription("");
      setSortOrder("0");
      setIsActive(true);
    }
  }, [editingId, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        // Update
        await trpc.clasificaciones.updateProductCategory.mutate({
          id: editingId,
          name: name || undefined,
          description: description || undefined,
          sortOrder: parseInt(sortOrder) || undefined,
          isActive: isActive,
        });
        toast.success("Clasificación actualizada");
      } else {
        // Create
        await trpc.clasificaciones.createProductCategory.mutate({
          accountId,
          name,
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
            {editingId ? "Editar" : "Nueva"} Clasificación de Producto
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Modifica los detalles de la clasificación"
              : "Crea una nueva clasificación de producto"}
          </DialogDescription>
        </DialogHeader>

        {loadingEdit ? (
          <div className="text-center py-4 text-gray-500">Cargando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Ropa, Alimentos"
                required
              />
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
              <Label htmlFor="sortOrder">Orden</Label>
              <Input
                id="sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
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
        )}
      </DialogContent>
    </Dialog>
  );
}
