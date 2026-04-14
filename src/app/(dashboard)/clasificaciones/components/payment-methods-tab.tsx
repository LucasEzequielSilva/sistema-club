"use client";

import { useEffect, useState } from "react";
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
import { PaymentAccountDialog } from "./payment-account-dialog";
import { PaymentChannelDialog } from "./payment-channel-dialog";
import { toast } from "sonner";
import { CreditCard, Landmark, Shuffle, MoreHorizontal } from "lucide-react";

interface PaymentMethodsTabProps {
  accountId: string;
}

type DialogState = {
  methodOpen: boolean;
  methodId: string | null;
  accountOpen: boolean;
  accountId: string | null;
  channelOpen: boolean;
  channelId: string | null;
};

export function PaymentMethodsTab({ accountId }: PaymentMethodsTabProps) {
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm({
    title: "Eliminar",
    description: "Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);

  const [dialog, setDialog] = useState<DialogState>({
    methodOpen: false,
    methodId: null,
    accountOpen: false,
    accountId: null,
    channelOpen: false,
    channelId: null,
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      await trpc.clasificaciones.bootstrapPaymentRouting.mutate({ accountId });
    } catch {
      // no-op
    }

    try {
      const [m, a, c] = await Promise.all([
        trpc.clasificaciones.listPaymentMethods.query({ accountId }),
        trpc.clasificaciones.listPaymentAccounts.query({ accountId }),
        trpc.clasificaciones.listPaymentChannels.query({ accountId }),
      ]);
      setMethods(m);
      setAccounts(a as any[]);
      setChannels(c as any[]);
    } catch {
      toast.error("Error al cargar configuración de pagos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [accountId]);

  const closeDialogs = () =>
    setDialog({
      methodOpen: false,
      methodId: null,
      accountOpen: false,
      accountId: null,
      channelOpen: false,
      channelId: null,
    });

  const afterSave = () => {
    closeDialogs();
    void loadAll();
  };

  const removeMethod = async (id: string) => {
    if (!(await confirmDelete())) return;
    try {
      await trpc.clasificaciones.deletePaymentMethod.mutate({ id });
      toast.success("Método eliminado");
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar");
    }
  };

  const removeAccount = async (id: string) => {
    if (!(await confirmDelete())) return;
    try {
      await trpc.clasificaciones.deletePaymentAccount.mutate({ id });
      toast.success("Cuenta receptora eliminada");
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar");
    }
  };

  const removeChannel = async (id: string) => {
    if (!(await confirmDelete())) return;
    try {
      await trpc.clasificaciones.deletePaymentChannel.mutate({ id });
      toast.success("Canal eliminado");
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar");
    }
  };

  const formatAccreditation = (days: number) =>
    days === 0 ? "Inmediata" : `${days} día${days !== 1 ? "s" : ""}`;

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8">Cargando configuración de pagos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Landmark className="w-4 h-4" /> Cuentas Receptoras
          </h3>
          <Button onClick={() => setDialog((d) => ({ ...d, accountOpen: true, accountId: null }))}>
            + Nueva Cuenta
          </Button>
        </div>

        {accounts.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Sin cuentas receptoras"
            description="Creá al menos una cuenta para enrutar cobros y pagos"
            actionLabel="+ Nueva Cuenta"
            onAction={() => setDialog((d) => ({ ...d, accountOpen: true, accountId: null }))}
          />
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">
                      {acc.name} {acc.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{acc.provider || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.identifier || "-"}</TableCell>
                    <TableCell>{acc.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDialog((d) => ({ ...d, accountOpen: true, accountId: acc.id }))}>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeAccount(acc.id)}>Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Shuffle className="w-4 h-4" /> Canales de Pago
          </h3>
          <Button onClick={() => setDialog((d) => ({ ...d, channelOpen: true, channelId: null }))}>
            + Nuevo Canal
          </Button>
        </div>

        {channels.length === 0 ? (
          <EmptyState
            icon={Shuffle}
            title="Sin canales"
            description="Creá canales para definir acreditación y comisión"
            actionLabel="+ Nuevo Canal"
            onAction={() => setDialog((d) => ({ ...d, channelOpen: true, channelId: null }))}
          />
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Método legacy</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Acreditación</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((ch) => (
                  <TableRow key={ch.id}>
                    <TableCell className="font-medium">
                      {ch.name} {ch.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ch.paymentMethod?.name || "-"}</TableCell>
                    <TableCell>{ch.paymentAccount?.name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatAccreditation(ch.accreditationDays)}</TableCell>
                    <TableCell className="text-muted-foreground">{Number(ch.feePct || 0).toFixed(2)}%</TableCell>
                    <TableCell>{ch.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDialog((d) => ({ ...d, channelOpen: true, channelId: ch.id }))}>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeChannel(ch.id)}>Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Métodos Legacy
          </h3>
          <Button onClick={() => setDialog((d) => ({ ...d, methodOpen: true, methodId: null }))}>
            + Nuevo Método
          </Button>
        </div>

        {methods.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Sin métodos de pago"
            description="Creá métodos para mantener compatibilidad con el flujo actual"
            actionLabel="+ Nuevo Método"
            onAction={() => setDialog((d) => ({ ...d, methodOpen: true, methodId: null }))}
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
                  <TableRow key={method.id}>
                    <TableCell className="font-medium">{method.name}</TableCell>
                    <TableCell className="text-muted-foreground">{formatAccreditation(method.accreditationDays)}</TableCell>
                    <TableCell>{method.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDialog((d) => ({ ...d, methodOpen: true, methodId: method.id }))}>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void removeMethod(method.id)}>Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PaymentMethodDialog
        open={dialog.methodOpen}
        onOpenChange={(open) => setDialog((d) => ({ ...d, methodOpen: open }))}
        onClose={closeDialogs}
        onSuccess={afterSave}
        accountId={accountId}
        editingId={dialog.methodId}
      />

      <PaymentAccountDialog
        open={dialog.accountOpen}
        onOpenChange={(open) => setDialog((d) => ({ ...d, accountOpen: open }))}
        onClose={closeDialogs}
        onSuccess={afterSave}
        accountId={accountId}
        editingId={dialog.accountId}
      />

      <PaymentChannelDialog
        open={dialog.channelOpen}
        onOpenChange={(open) => setDialog((d) => ({ ...d, channelOpen: open }))}
        onClose={closeDialogs}
        onSuccess={afterSave}
        accountId={accountId}
        editingId={dialog.channelId}
      />

      {ConfirmDeleteDialog}
    </div>
  );
}
