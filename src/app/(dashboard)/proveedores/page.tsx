"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SupplierDialog } from "./components/supplier-dialog";
import { SupplierDetail } from "./components/supplier-detail";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { Building2, Search, MoreHorizontal, Plus } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { useAccountId } from "@/hooks/use-account-id";

type Supplier = {
  id: string;
  name: string;
  cuit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: { purchases: number };
};

export default function ProveedoresPage() {
  const { accountId } = useAccountId();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [confirmDeactivate, ConfirmDeactivateDialog] = useConfirm({
    title: "Desactivar proveedor",
    description: "El proveedor dejará de aparecer en los formularios. Sus datos históricos se conservan.",
    confirmLabel: "Desactivar",
  });
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm({
    title: "Eliminar proveedor",
    description: "Esta acción elimina el proveedor permanentemente y no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  const loadSuppliers = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const result = await trpc.proveedores.list.query({
        search: search.trim() || undefined,
      });
      setSuppliers(result as Supplier[]);
    } catch {
      toast.error("Error al cargar los proveedores");
    } finally {
      setLoading(false);
    }
  }, [search, accountId]);

  useEffect(() => {
    const timer = setTimeout(loadSuppliers, 300);
    return () => clearTimeout(timer);
  }, [loadSuppliers]);

  const handleSoftDelete = async (id: string, name: string) => {
    if (!(await confirmDeactivate())) return;
    try {
      await trpc.proveedores.softDelete.mutate({ id });
      toast.success(`"${name}" desactivado`);
      loadSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Error al desactivar");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirmDelete())) return;
    try {
      await trpc.proveedores.delete.mutate({ id });
      toast.success(`"${name}" eliminado`);
      loadSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const handleDialogSuccess = () => {
    setShowDialog(false);
    setEditingId(null);
    loadSuppliers();
  };

  // Si hay un detalle abierto, mostramos el panel de detalle
  if (detailId) {
    return (
      <SupplierDetail
        supplierId={detailId}
        onBack={() => setDetailId(null)}
        onEdit={(id: string) => {
          setEditingId(id);
          setShowDialog(true);
          setDetailId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Proveedores"
        description="Gestión de proveedores y contactos"
        icon={Building2}
        actions={
          <Button onClick={() => { setEditingId(null); setShowDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Proveedor
          </Button>
        }
      />

      {/* Search bar */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border mb-4">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-auto p-0 text-sm"
        />
        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearch("")}
            className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Cargando…</div>
      ) : suppliers.length === 0 ? (
        search ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Sin resultados para &quot;{search}&quot;
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="Sin proveedores"
            description="Agregá tu primer proveedor"
            actionLabel="+ Nuevo Proveedor"
            onAction={() => { setEditingId(null); setShowDialog(true); }}
          />
        )
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase text-muted-foreground">Nombre</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">CUIT</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Teléfono</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Email</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Ubicación</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground text-center">Compras</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground text-center">Estado</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell
                    className="font-medium cursor-pointer hover:underline"
                    onClick={() => setDetailId(s.id)}
                  >
                    {s.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.cuit || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate">
                    {s.email || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[160px] truncate">
                    {s.address || "—"}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {s._count.purchases}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.isActive ? (
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Abrir menú</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailId(s.id)}>
                          Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditingId(s.id); setShowDialog(true); }}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {s.isActive ? (
                          <DropdownMenuItem
                            className="text-amber-600 focus:text-amber-600"
                            onClick={() => handleSoftDelete(s.id, s.name)}
                          >
                            Desactivar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleSoftDelete(s.id, s.name)}>
                            Activar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(s.id, s.name)}
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

      <SupplierDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onClose={() => { setShowDialog(false); setEditingId(null); }}
        onSuccess={handleDialogSuccess}
        accountId={accountId ?? ""}
        editingId={editingId}
      />
      {ConfirmDeactivateDialog}
      {ConfirmDeleteDialog}
    </div>
  );
}
