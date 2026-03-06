"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc-client";
import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { CostCategoryDialog } from "./cost-category-dialog";
import { toast } from "sonner";
import { Tag, MoreHorizontal } from "lucide-react";

interface CostCategoriesTabProps {
  accountId: string;
}

const COST_TYPE_BADGE: Record<string, string> = {
  variable: "bg-amber-100 text-amber-800 border-amber-200",
  fijo: "bg-blue-100 text-blue-800 border-blue-200",
  impuestos: "bg-orange-100 text-orange-800 border-orange-200",
};

const COST_TYPE_LABELS: Record<string, string> = {
  variable: "Variable",
  fijo: "Fijo",
  impuestos: "Impuestos",
};

export function CostCategoriesTab({ accountId }: CostCategoriesTabProps) {
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm({
    title: "Eliminar clasificación",
    description: "Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

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
    if (!(await confirmDelete())) return;

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
      <div className="flex justify-between items-center pt-2">
        <p className="text-sm text-muted-foreground">
          Variable: {countByType("variable")} &middot; Fijo: {countByType("fijo")} &middot; Impuestos: {countByType("impuestos")}
        </p>
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
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b border-border">
            <div className="grid grid-cols-5 gap-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-3 bg-muted rounded" />
              ))}
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-3 px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-3 w-36 bg-muted rounded" />
              <div className="h-5 w-12 bg-muted rounded mx-auto" />
              <div className="h-3 w-6 bg-muted rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Sin clasificaciones de costos"
          description="Creá tu primera clasificación de costo para comenzar"
          actionLabel="+ Nueva Clasificación"
          onAction={() => {
            setEditingId(null);
            setShowDialog(true);
          }}
        />
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
                <TableRow key={cat.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${COST_TYPE_BADGE[cat.costType] ?? ""}`}
                    >
                      {COST_TYPE_LABELS[cat.costType] ?? cat.costType}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {cat.description || "—"}
                  </TableCell>
                  <TableCell>
                    {cat.isActive ? (
                      <Badge variant="outline" className="text-[var(--success-muted-foreground)] border-[var(--success-muted-foreground)]/30 bg-[var(--success-muted-foreground)]/10">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingId(cat.id);
                            setShowDialog(true);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(cat.id)}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      {ConfirmDeleteDialog}
    </div>
  );
}
