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
import { SupplierDialog } from "./components/supplier-dialog";
import { SupplierDetail } from "./components/supplier-detail";
import { toast } from "sonner";

const ACCOUNT_ID = "test-account-id"; // TODO: reemplazar por sesión real

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await trpc.proveedores.list.query({
        accountId: ACCOUNT_ID,
        search: search.trim() || undefined,
      });
      setSuppliers(result as Supplier[]);
    } catch {
      toast.error("Error al cargar los proveedores");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(loadSuppliers, 300);
    return () => clearTimeout(timer);
  }, [loadSuppliers]);

  const handleSoftDelete = async (id: string, name: string) => {
    if (!confirm(`¿Desactivar a "${name}"? No se eliminarán sus datos.`)) return;
    try {
      await trpc.proveedores.softDelete.mutate({ id });
      toast.success(`"${name}" desactivado`);
      loadSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Error al desactivar");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar permanentemente a "${name}"? Esta acción no se puede deshacer.`)) return;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Proveedores</h1>
          <p className="text-gray-500 mt-1">
            {loading ? "Cargando…" : `${suppliers.length} proveedor${suppliers.length !== 1 ? "es" : ""}`}
          </p>
        </div>
        <Button onClick={() => { setEditingId(null); setShowDialog(true); }}>
          + Nuevo Proveedor
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <Input
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {search && (
          <Button variant="outline" onClick={() => setSearch("")}>
            Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando…</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {search
            ? `Sin resultados para "${search}"`
            : "No hay proveedores. Creá uno para comenzar."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>CUIT</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead className="text-center">Compras</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow
                  key={s.id}
                  className={!s.isActive ? "opacity-50" : ""}
                >
                  <TableCell
                    className="font-medium cursor-pointer hover:underline"
                    onClick={() => setDetailId(s.id)}
                  >
                    {s.name}
                  </TableCell>
                  <TableCell className="text-gray-500">{s.cuit || "—"}</TableCell>
                  <TableCell className="text-gray-500">{s.phone || "—"}</TableCell>
                  <TableCell className="text-gray-500 max-w-[180px] truncate">
                    {s.email || "—"}
                  </TableCell>
                  <TableCell className="text-gray-500 max-w-[160px] truncate">
                    {s.address || "—"}
                  </TableCell>
                  <TableCell className="text-center text-gray-500">
                    {s._count.purchases}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.isActive ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-400">✗</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingId(s.id); setShowDialog(true); }}
                      >
                        Editar
                      </Button>
                      {s.isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                          onClick={() => handleSoftDelete(s.id, s.name)}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 border-red-300 hover:bg-red-50"
                          onClick={() => handleDelete(s.id, s.name)}
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

      <SupplierDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onClose={() => { setShowDialog(false); setEditingId(null); }}
        onSuccess={handleDialogSuccess}
        accountId={ACCOUNT_ID}
        editingId={editingId}
      />
    </div>
  );
}
