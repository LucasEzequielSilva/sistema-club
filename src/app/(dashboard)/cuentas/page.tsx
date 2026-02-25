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
import { toast } from "sonner";
import { AccountDialog } from "./components/account-dialog";
import { EntryDialog } from "./components/entry-dialog";

const ACCOUNT_ID = "test-account-id";

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

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const [accs, summary] = await Promise.all([
        trpc.cuentas.listAccounts.query({
          accountId: ACCOUNT_ID,
          includeInactive: true,
        }),
        trpc.cuentas.getBalancesSummary.query({ accountId: ACCOUNT_ID }),
      ]);
      setAccounts(accs);
      setBalanceSummary(summary);
    } catch {
      toast.error("Error al cargar cuentas");
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
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
    setLoadingFlow(true);
    try {
      const dateFrom = new Date(year, month, 1);
      const dateTo = new Date(year, month + 1, 0, 23, 59, 59);

      const result = await trpc.cuentas.getCashFlow.query({
        accountId: ACCOUNT_ID,
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
  }, [year, month, flowBankAccountId]);

  useEffect(() => {
    if (tab === "flujo") {
      const timer = setTimeout(loadFlow, 300);
      return () => clearTimeout(timer);
    }
  }, [tab, loadFlow]);

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("¿Eliminar este movimiento manual?")) return;
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

  const TABS: { id: TabId; label: string }[] = [
    { id: "cuentas", label: "Cuentas" },
    { id: "flujo", label: "Flujo de Fondos" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Cuentas y Flujo de Fondos</h1>
        <p className="text-gray-500 mt-1">
          Gestión de cuentas bancarias y movimientos de caja
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-1 border-b">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {tab === "cuentas" && (
            <Button onClick={openNewAccount}>+ Nueva Cuenta</Button>
          )}
          {tab === "flujo" && (
            <Button onClick={() => setEntryDialogOpen(true)}>
              + Movimiento Manual
            </Button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* TAB: CUENTAS                           */}
      {/* ═══════════════════════════════════════ */}
      {tab === "cuentas" && (
        <div className="space-y-6">
          {/* Summary cards */}
          {balanceSummary && (
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-xs text-gray-500">Cuentas Activas</p>
                <p className="text-2xl font-bold">
                  {balanceSummary.accounts.length}
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-xs text-gray-500">Saldo Total (manual)</p>
                <p
                  className={`text-2xl font-bold ${
                    balanceSummary.totalBalance >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(balanceSummary.totalBalance)}
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-xs text-gray-500">Nota</p>
                <p className="text-sm text-gray-400 mt-1">
                  Saldos basados en saldo inicial + movimientos manuales
                </p>
              </div>
            </div>
          )}

          {/* Accounts table */}
          {loadingAccounts ? (
            <div className="text-center py-16 text-gray-400">Cargando...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <p className="text-gray-400 mb-4">No hay cuentas registradas</p>
              <Button onClick={openNewAccount}>Crear primera cuenta</Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Saldo Inicial</TableHead>
                    <TableHead className="text-right">Saldo Actual</TableHead>
                    <TableHead className="text-center">Movimientos</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((acc) => (
                    <TableRow
                      key={acc.id}
                      className={!acc.isActive ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(acc.initialBalance)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-semibold ${
                          acc.currentBalance >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
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
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditAccount(acc.id)}
                          >
                            Editar
                          </Button>
                          {acc.entryCount === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() =>
                                handleDeleteAccount(acc.id, acc.name)
                              }
                            >
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: FLUJO DE FONDOS                   */}
      {/* ═══════════════════════════════════════ */}
      {tab === "flujo" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger className="w-[140px]">
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
              <SelectTrigger className="w-[100px]">
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
              <SelectTrigger className="w-[180px]">
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
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-500">Ingresos</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(flowData.totals.ingresos)}
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-500">Egresos</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(flowData.totals.egresos)}
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-500">Neto</p>
                <p
                  className={`text-lg font-bold ${
                    flowData.totals.neto >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(flowData.totals.neto)}
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-500">Movimientos</p>
                <p className="text-lg font-bold">{flowData.totals.count}</p>
              </div>
            </div>
          )}

          {/* Flow table */}
          {loadingFlow ? (
            <div className="text-center py-16 text-gray-400">Cargando...</div>
          ) : !flowData || flowData.items.length === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <p className="text-gray-400">
                Sin movimientos en{" "}
                {MONTHS[month]} {year}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Medio / Cuenta</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flowData.items.map((item: any) => (
                    <TableRow key={`${item.source}-${item.id}`}>
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
                      <TableCell className="text-sm text-gray-500">
                        {item.method}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            item.source === "venta"
                              ? "border-green-300 text-green-700"
                              : item.source === "compra"
                                ? "border-red-300 text-red-700"
                                : "border-gray-300 text-gray-600"
                          }`}
                        >
                          {item.source === "venta"
                            ? "Venta"
                            : item.source === "compra"
                              ? "Compra"
                              : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-medium ${
                          item.type === "ingreso"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {item.type === "ingreso" ? "+" : "-"}
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.source === "manual" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 text-xs h-7 px-2"
                            onClick={() => handleDeleteEntry(item.id)}
                          >
                            Eliminar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

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
        accountId={ACCOUNT_ID}
        editingId={editingAccountId}
      />

      <EntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        onClose={() => setEntryDialogOpen(false)}
        onSuccess={handleEntrySuccess}
        accountId={ACCOUNT_ID}
        bankAccounts={activeAccounts.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
