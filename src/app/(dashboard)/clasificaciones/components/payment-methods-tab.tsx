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
import { PaymentMethodDialog } from "./payment-method-dialog";
import { toast } from "sonner";

interface PaymentMethodsTabProps {
  accountId: string;
}

export function PaymentMethodsTab({ accountId }: PaymentMethodsTabProps) {
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
    if (!confirm("¿Estás seguro? Esta acción no se puede deshacer.")) return;

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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Métodos de Pago/Cobro</h2>
          <p className="text-gray-500 mt-1">Total: {methods.length} métodos</p>
        </div>
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
        <div className="text-center py-8 text-gray-500">Cargando...</div>
      ) : methods.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay métodos de pago. Crea uno nuevo para comenzar.
        </div>
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
                <TableRow key={method.id}>
                  <TableCell className="font-medium">{method.name}</TableCell>
                  <TableCell>{formatAccreditation(method.accreditationDays)}</TableCell>
                  <TableCell>{method.isActive ? "✓" : "✗"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(method.id);
                        setShowDialog(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500"
                      onClick={() => handleDelete(method.id)}
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

      <PaymentMethodDialog
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
