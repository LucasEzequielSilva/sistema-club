"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CostCategoryDialog } from "./cost-category-dialog";
import { toast } from "sonner";

interface CostCategoriesTabProps {
  accountId: string;
}

const costTypeColors: Record<string, string> = {
  variable: "bg-red-100 text-red-800",
  fijo: "bg-blue-100 text-blue-800",
  impuestos: "bg-orange-100 text-orange-800",
};

export function CostCategoriesTab({ accountId }: CostCategoriesTabProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const result = await trpc.clasificaciones.listCostCategories.query({
        accountId,
      });
      setCategories(result);
    } catch (error) {
      toast.error("Error al cargar las clasificaciones");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [accountId]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro? Esta acción no se puede deshacer.")) return;

    try {
      await trpc.clasificaciones.deleteCostCategory.mutate({ id });
      toast.success("Clasificación eliminada");
      loadCategories();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar");
    }
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    setEditingId(null);
  };

  const handleSuccess = () => {
    loadCategories();
    handleDialogClose();
  };

  const countByType = (type: string) =>
    categories.filter((c) => c.costType === type).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Clasificaciones de Costos</h2>
          <p className="text-gray-500 mt-1">
            Variable: {countByType("variable")} | Fijo: {countByType("fijo")} |
            Impuestos: {countByType("impuestos")}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowDialog(true);
          }}
        >
          + Nueva Clasificación
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay clasificaciones. Crea una nueva para comenzar.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>
                    <Badge className={costTypeColors[cat.costType]}>
                      {cat.costType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {cat.description || "-"}
                  </TableCell>
                  <TableCell>{cat.isActive ? "✓" : "✗"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(cat.id);
                        setShowDialog(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500"
                      onClick={() => handleDelete(cat.id)}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CostCategoryDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onClose={handleDialogClose}
        onSuccess={handleSuccess}
        accountId={accountId}
        editingId={editingId}
      />
    </div>
  );
}
