"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SupplierDetailProps {
  supplierId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
}

type SupplierFull = Awaited<
  ReturnType<typeof trpc.proveedores.getById.query>
>;

export function SupplierDetail({
  supplierId,
  onBack,
  onEdit,
}: SupplierDetailProps) {
  const [supplier, setSupplier] = useState<SupplierFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    trpc.proveedores.getById
      .query({ id: supplierId })
      .then(setSupplier)
      .catch(() => toast.error("Error al cargar el proveedor"))
      .finally(() => setLoading(false));
  }, [supplierId]);

  if (loading) {
    return <div className="py-16 text-center text-gray-400">Cargando…</div>;
  }

  if (!supplier) {
    return (
      <div className="py-16 text-center text-gray-400">
        Proveedor no encontrado.{" "}
        <button className="underline" onClick={onBack}>
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Volver
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{supplier.name}</h1>
            {!supplier.isActive && (
              <Badge variant="secondary" className="text-gray-500">
                Inactivo
              </Badge>
            )}
          </div>
          <p className="text-gray-500 mt-1">Detalle del proveedor</p>
        </div>
        <Button onClick={() => onEdit(supplier.id)}>Editar</Button>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoCard title="Datos de contacto">
          <InfoRow label="CUIT" value={supplier.cuit} />
          <InfoRow label="Teléfono" value={supplier.phone} />
          <InfoRow
            label="Email"
            value={
              supplier.email ? (
                <a
                  href={`mailto:${supplier.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {supplier.email}
                </a>
              ) : null
            }
          />
          <InfoRow label="Dirección" value={supplier.address} />
        </InfoCard>

        <InfoCard title="Estadísticas">
          <InfoRow
            label="Total de compras"
            value={
              <span className="font-semibold text-lg">
                {supplier._count.purchases}
              </span>
            }
          />
          <InfoRow
            label="Estado"
            value={
              supplier.isActive ? (
                <span className="text-green-600 font-medium">Activo</span>
              ) : (
                <span className="text-gray-400">Inactivo</span>
              )
            }
          />
          <InfoRow
            label="Alta"
            value={new Date(supplier.createdAt).toLocaleDateString("es-AR")}
          />
        </InfoCard>
      </div>

      {/* Notas */}
      {supplier.notes && (
        <InfoCard title="Notas">
          <p className="text-gray-600 text-sm whitespace-pre-line">
            {supplier.notes}
          </p>
        </InfoCard>
      )}

      {/* Historial de compras — placeholder */}
      <div className="border rounded-lg">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-lg">
            Historial de Compras
            {supplier._count.purchases > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({supplier._count.purchases} compra{supplier._count.purchases !== 1 ? "s" : ""})
              </span>
            )}
          </h2>
        </div>

        {supplier.purchases.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-2xl mb-2">🧾</p>
            <p className="font-medium">Sin compras registradas</p>
            <p className="text-sm mt-1">
              Las compras aparecerán acá cuando uses{" "}
              <span className="font-mono bg-gray-100 px-1 rounded">
                mod-compras
              </span>
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {supplier.purchases.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="font-medium text-sm">
                    {p.description || p.costCategory?.name || "Sin descripción"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(p.invoiceDate).toLocaleDateString("es-AR")}
                    {p.invoiceNumber && ` · Factura ${p.invoiceNumber}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">
                    ${((p.unitCost ?? 0) * (p.quantity ?? 1)).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">{p.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ——————————————————————————————
// Sub-components
// ——————————————————————————————

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg">
      <div className="p-3 border-b bg-gray-50">
        <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | string | null | undefined;
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-right">
        {value ?? <span className="text-gray-300">—</span>}
      </span>
    </div>
  );
}
