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
import { PaymentMethodDialog } from "./payment-method-dialog";
import { toast } from "sonner";
import { CreditCard, MoreHorizontal } from "lucide-react";

interface PaymentMethodsTabProps {
  accountId: string;
}

export function PaymentMethodsTab({ accountId }: PaymentMethodsTabProps) {
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm({
    title: "Eliminar método de pago",
    description: "Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadMethods = async () => {
    setLoading(true);
    try {
      const result = await trpc.clasificaciones.listPaymentMethods.query({
        accountId,
      });
      setMethods(result);
    } catch (error) {
      toast.error("Error al cargar los métodos de pago");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMethods();
  }, [accountId]);

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete())) return;

    try {
      await trpc.clasificaciones.deletePaymentMethod.mutate({ id });
      toast.success("Método de pago eliminado");
      loadMethods();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar");
    }
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    setEditingId(null);
  };

  const handleSuccess = () => {
    loadMethods();
    handleDialogClose();
  };

  const formatAccreditation = (days: number) => {
    if (days === 0) return "Acreditación inmediata";
    return `${days} día${days !== 1 ? "s" : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pt-2">
        <p className="text-sm text-muted-foreground">
          {methods.length} método{methods.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowDialog(true);
          }}
        >
          + Nuevo Método
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b border-border">
            <div className="grid grid-cols-4 gap-3 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 bg-muted rounded" />
              ))}
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-4 gap-3 px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-5 w-12 bg-muted rounded mx-auto" />
              <div className="h-3 w-6 bg-muted rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : methods.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin métodos de pago"
          description="Creá tu primer método de pago para comenzar"
          actionLabel="+ Nuevo Método"
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
                <TableHead>Acreditación</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{method.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatAccreditation(method.accreditationDays)}
                  </TableCell>
                  <TableCell>
                    {method.isActive ? (
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
                            setEditingId(method.id);
                            setShowDialog(true);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(method.id)}
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

      <PaymentMethodDialog
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
