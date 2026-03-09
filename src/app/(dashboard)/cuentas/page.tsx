"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Landmark, MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { AccountDialog } from "./components/account-dialog";
import { EntryDialog } from "./components/entry-dialog";
import { useAccountId } from "@/hooks/use-account-id";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type TabId = "cuentas" | "flujo";

export default function CuentasPage() {
  const { accountId } = useAccountId();
  const now = new Date();
  const [tab, setTab] = useState<TabId>("cuentas");

  // ────────────────────────────
  // TAB 1: Bank accounts
  // ────────────────────────────
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<any>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Dialog state
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const [confirmDeleteAccount, ConfirmDeleteAccountDialog] = useConfirm({
    title: "Eliminar cuenta",
    description: "Esta acción elimina la cuenta y no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });
  const [confirmDeleteEntry, ConfirmDeleteEntryDialog] = useConfirm({
    title: "Eliminar movimiento",
    description: "Se eliminará este movimiento manual. Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  const loadAccounts = useCallback(async () => {
    if (!accountId) return;
    setLoadingAccounts(true);
    try {
      const [accs, summary] = await Promise.all([
        trpc.cuentas.listAccounts.query({
          accountId,
          includeInactive: true,
        }),
        trpc.cuentas.getBalancesSummary.query({ accountId }),
      ]);
      setAccounts(accs);
      setBalanceSummary(summary);
    } catch {
      toast.error("Error al cargar cuentas");
    } finally {
      setLoadingAccounts(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!(await confirmDeleteAccount())) return;
    try {
      await trpc.cuentas.deleteAccount.mutate({ id });
      toast.success(`"${name}" eliminada`);
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const openNewAccount = () => {
    setEditingAccountId(null);
    setAccountDialogOpen(true);
  };

  const openEditAccount = (id: string) => {
    setEditingAccountId(id);
    setAccountDialogOpen(true);
  };

  const handleAccountSuccess = () => {
    setAccountDialogOpen(false);
    setEditingAccountId(null);
    loadAccounts();
    // Also reload flow if on that tab
    if (tab === "flujo") loadFlow();
  };

  // ────────────────────────────
  // TAB 2: Cash flow
  // ────────────────────────────
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [flowBankAccountId, setFlowBankAccountId] = useState<string>("all");
  const [flowData, setFlowData] = useState<any>(null);
  const [loadingFlow, setLoadingFlow] = useState(false);

  // Entry dialog
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);

  const loadFlow = useCallback(async () => {
    if (!accountId) return;
    setLoadingFlow(true);
    try {
      const dateFrom = new Date(year, month, 1);
      const dateTo = new Date(year, month + 1, 0, 23, 59, 59);

      const result = await trpc.cuentas.getCashFlow.query({
        accountId,
        bankAccountId: flowBankAccountId === "all" ? undefined : flowBankAccountId,
        dateFrom,
        dateTo,
      });
      setFlowData(result);
    } catch {
      toast.error("Error al cargar flujo de fondos");
    } finally {
      setLoadingFlow(false);
    }
  }, [year, month, flowBankAccountId, accountId]);

  useEffect(() => {
    if (tab === "flujo") {
      const timer = setTimeout(loadFlow, 300);
      return () => clearTimeout(timer);
    }
  }, [tab, loadFlow]);

  const handleDeleteEntry = async (id: string) => {
    if (!(await confirmDeleteEntry())) return;
    try {
      await trpc.cuentas.deleteEntry.mutate({ id });
      toast.success("Movimiento eliminado");
      loadFlow();
      loadAccounts(); // balance changed
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const handleEntrySuccess = () => {
    setEntryDialogOpen(false);
    loadFlow();
    loadAccounts(); // balance changed
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const activeAccounts = accounts.filter((a) => a.isActive);

  const tabActions = (
    <div className="flex gap-2">
      {tab === "cuentas" && (
        <Button onClick={openNewAccount} size="sm">+ Nueva Cuenta</Button>
      )}
      {tab === "flujo" && (
        <Button onClick={() => setEntryDialogOpen(true)} size="sm">
          + Movimiento Manual
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Cuentas y Flujo"
        description="Cuentas bancarias y movimientos de fondos"
        icon={Landmark}
        actions={tabActions}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList className="mb-2">
          <TabsTrigger value="cuentas">Cuentas</TabsTrigger>
          <TabsTrigger value="flujo">Flujo de Fondos</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════ */}
        {/* TAB: CUENTAS                           */}
        {/* ═══════════════════════════════════════ */}
        <TabsContent value="cuentas" className="space-y-6">
          {/* Summary cards */}
          {balanceSummary && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                title="Cuentas Activas"
                value={String(balanceSummary.accounts.length)}
                variant="info"
              />
              <StatCard
                title="Saldo Total (manual)"
                value={formatCurrency(balanceSummary.totalBalance)}
                variant={balanceSummary.totalBalance >= 0 ? "success" : "danger"}
              />
              <StatCard
                title="Nota"
                value="Saldos calculados"
                subtitle="Saldo inicial + movimientos manuales"
                variant="muted"
              />
            </div>
          )}

          {/* Accounts table */}
          {loadingAccounts ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : accounts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card">
              <EmptyState
                icon={Landmark}
                title="No hay cuentas registradas"
                description="Creá tu primera cuenta bancaria para empezar a gestionar los fondos."
                actionLabel="Crear primera cuenta"
                onAction={openNewAccount}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase text-muted-foreground">Nombre</TableHead>
                    <TableHead className="text-right text-xs uppercase text-muted-foreground">Saldo Inicial</TableHead>
                    <TableHead className="text-right text-xs uppercase text-muted-foreground">Saldo Actual</TableHead>
                    <TableHead className="text-center text-xs uppercase text-muted-foreground">Movimientos</TableHead>
                    <TableHead className="text-center text-xs uppercase text-muted-foreground">Estado</TableHead>
                    <TableHead className="text-right text-xs uppercase text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((acc) => (
                    <TableRow
                      key={acc.id}
                      className={`hover:bg-muted/40 ${!acc.isActive ? "opacity-50" : ""}`}
                    >
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatCurrency(acc.initialBalance)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {formatCurrency(acc.currentBalance)}
                      </TableCell>
                      <TableCell className="text-center">
                        {acc.entryCount}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={acc.isActive ? "default" : "secondary"}
                        >
                          {acc.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditAccount(acc.id)}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              {acc.isActive ? "Desactivar" : "Activar"}
                            </DropdownMenuItem>
                            {acc.entryCount === 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteAccount(acc.id, acc.name)}
                                >
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════ */}
        {/* TAB: FLUJO DE FONDOS                   */}
        {/* ═══════════════════════════════════════ */}
        <TabsContent value="flujo" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/50 rounded-lg border border-border">
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={flowBankAccountId}
              onValueChange={setFlowBankAccountId}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary cards */}
          {flowData && (
            <div className="grid grid-cols-4 gap-3">
              <StatCard
                title="Ingresos"
                value={formatCurrency(flowData.totals.ingresos)}
                variant="success"
              />
              <StatCard
                title="Egresos"
                value={formatCurrency(flowData.totals.egresos)}
                variant="danger"
              />
              <StatCard
                title="Neto"
                value={formatCurrency(flowData.totals.neto)}
                variant={flowData.totals.neto >= 0 ? "success" : "danger"}
              />
              <StatCard
                title="Movimientos"
                value={String(flowData.totals.count)}
                variant="muted"
              />
            </div>
          )}

          {/* Flow table */}
          {loadingFlow ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : !flowData || flowData.items.length === 0 ? (
            <div className="rounded-xl border border-border bg-card">
              <EmptyState
                icon={Landmark}
                title={`Sin movimientos en ${MONTHS[month]} ${year}`}
                description="No hay movimientos de fondos registrados para el período y cuenta seleccionados."
                actionLabel="+ Movimiento Manual"
                onAction={() => setEntryDialogOpen(true)}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase text-muted-foreground">Fecha</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Tipo</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Concepto</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Medio / Cuenta</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Origen</TableHead>
                    <TableHead className="text-right text-xs uppercase text-muted-foreground">Monto</TableHead>
                    <TableHead className="text-right w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flowData.items.map((item: any) => (
                    <TableRow key={`${item.source}-${item.id}`} className="hover:bg-muted/40">
                      <TableCell className="text-sm">
                        {formatDate(item.date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.type === "ingreso" ? "default" : "destructive"
                          }
                          className="text-xs"
                        >
                          {item.type === "ingreso" ? "Ingreso" : "Egreso"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {item.concept}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.method}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={
                            item.source === "venta"
                              ? { borderColor: "var(--success-muted-foreground)", color: "var(--success-muted-foreground)" }
                              : item.source === "compra"
                                ? { borderColor: "var(--danger-muted-foreground)", color: "var(--danger-muted-foreground)" }
                                : {}
                          }
                        >
                          {item.source === "venta"
                            ? "Venta"
                            : item.source === "compra"
                              ? "Compra"
                              : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        {item.type === "ingreso" ? "+" : "-"}
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.source === "manual" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteEntry(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════ */}
      {/* DIALOGS                                */}
      {/* ═══════════════════════════════════════ */}
      <AccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        onClose={() => {
          setAccountDialogOpen(false);
          setEditingAccountId(null);
        }}
        onSuccess={handleAccountSuccess}
        accountId={accountId ?? ""}
        editingId={editingAccountId}
      />

      <EntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        onClose={() => setEntryDialogOpen(false)}
        onSuccess={handleEntrySuccess}
        accountId={accountId ?? ""}
        bankAccounts={activeAccounts.map((a) => ({ id: a.id, name: a.name }))}
      />
      {ConfirmDeleteAccountDialog}
      {ConfirmDeleteEntryDialog}
    </div>
  );
}
