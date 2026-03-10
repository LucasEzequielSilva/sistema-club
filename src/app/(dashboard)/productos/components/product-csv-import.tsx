"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, FileText, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductCsvImportProps {
  accountId: string;
  defaultCategoryId: string; // categoría fallback si no viene en el CSV
  onSuccess: () => void;
}

type CsvRow = {
  nombre: string;
  costo: number;
  categoria?: string;
  sku?: string;
  unidad?: string;
  error?: string;
};

const VALID_UNITS = ["unidad", "kg", "litro", "metro", "par"] as const;

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detectar separador (coma o punto y coma)
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const colNombre = headers.findIndex((h) => h === "nombre" || h === "name" || h === "producto");
  const colCosto = headers.findIndex((h) => h === "costo" || h === "cost" || h === "precio_costo" || h === "costo_unitario");
  const colCategoria = headers.findIndex((h) => h === "categoria" || h === "category" || h === "rubro");
  const colSku = headers.findIndex((h) => h === "sku" || h === "codigo");
  const colUnidad = headers.findIndex((h) => h === "unidad" || h === "unit");

  if (colNombre === -1) return [{ nombre: "", costo: 0, error: "No se encontró columna 'nombre'" }];

  return lines.slice(1).map((line) => {
    if (!line.trim()) return null;
    const cols = line.split(sep).map((c) => c.trim().replace(/"/g, ""));

    const nombre = cols[colNombre] ?? "";
    const costoRaw = colCosto !== -1 ? cols[colCosto] : "0";
    const costo = parseFloat(costoRaw.replace(",", ".")) || 0;
    const categoria = colCategoria !== -1 ? cols[colCategoria] : undefined;
    const sku = colSku !== -1 ? cols[colSku] : undefined;
    const unidadRaw = colUnidad !== -1 ? cols[colUnidad]?.toLowerCase() : undefined;
    const unidad = VALID_UNITS.includes(unidadRaw as any) ? unidadRaw : "unidad";

    const error = !nombre.trim() ? "Nombre vacío" : undefined;
    return { nombre: nombre.trim(), costo, categoria, sku, unidad, error };
  }).filter(Boolean) as CsvRow[];
}

export function ProductCsvImport({ accountId, defaultCategoryId, onSuccess }: ProductCsvImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ ok: number; err: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setResults(null);
      setOpen(true);
    };
    reader.readAsText(file, "UTF-8");
    // Reset input
    e.target.value = "";
  };

  const validRows = rows.filter((r) => !r.error);
  const invalidRows = rows.filter((r) => r.error);

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    let ok = 0;
    let err = 0;

    for (const row of validRows) {
      try {
        await trpc.productos.create.mutate({
          accountId,
          name: row.nombre,
          categoryId: defaultCategoryId,
          unit: (row.unidad ?? "unidad") as any,
          origin: "comprado",
          initialStock: 0,
          minStock: 0,
          acquisitionCost: row.costo,
          rawMaterialCost: 0,
          laborCost: 0,
          packagingCost: 0,
          sku: row.sku || undefined,
        });
        ok++;
      } catch {
        err++;
      }
    }

    setResults({ ok, err });
    setImporting(false);
    if (ok > 0) {
      toast.success(`${ok} producto${ok > 1 ? "s" : ""} importado${ok > 1 ? "s" : ""}`);
      onSuccess();
    }
    if (err > 0) {
      toast.error(`${err} producto${err > 1 ? "s" : ""} fallaron (probablemente ya existen)`);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setRows([]);
    setResults(null);
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        className="gap-1.5"
      >
        <Upload className="w-3.5 h-3.5" />
        Importar CSV
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Importar productos desde CSV
            </DialogTitle>
            <DialogDescription>
              Se encontraron {rows.length} filas · {validRows.length} válidas · {invalidRows.length} con errores
            </DialogDescription>
          </DialogHeader>

          {/* Formato esperado */}
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs space-y-1">
            <p className="font-medium text-foreground">Formato esperado (columnas):</p>
            <p className="font-mono text-muted-foreground">nombre, costo, categoria (opcional), sku (opcional), unidad (opcional)</p>
            <p className="text-muted-foreground/70">Separador: coma o punto y coma. Unidades válidas: unidad, kg, litro, metro, par.</p>
            <p className="text-muted-foreground/70">La categoría del CSV se ignora por ahora — todos van a la categoría por defecto. Se puede ajustar después.</p>
          </div>

          {/* Preview */}
          {rows.length > 0 && !results && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Preview ({Math.min(rows.length, 10)} de {rows.length}):</p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left px-3 py-2 text-muted-foreground">Nombre</th>
                      <th className="text-right px-3 py-2 text-muted-foreground">Costo</th>
                      <th className="text-left px-3 py-2 text-muted-foreground">SKU</th>
                      <th className="text-left px-3 py-2 text-muted-foreground">Unidad</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className={cn(row.error ? "bg-red-50 dark:bg-red-950/20" : "")}>
                        <td className="px-3 py-2 font-medium text-foreground truncate max-w-[180px]">{row.nombre || "—"}</td>
                        <td className="px-3 py-2 font-mono text-right">{row.costo > 0 ? `$${row.costo.toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.sku || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.unidad || "unidad"}</td>
                        <td className="px-3 py-2 text-right">
                          {row.error ? (
                            <span className="text-red-500 flex items-center justify-end gap-1">
                              <AlertCircle className="w-3 h-3" />{row.error}
                            </span>
                          ) : (
                            <Check className="w-3.5 h-3.5 text-green-500 ml-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 10 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/20 border-t border-border">
                    ... y {rows.length - 10} filas más
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resultado */}
          {results && (
            <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
              <p className="font-semibold text-foreground">Importación completada</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-green-600">
                  <Check className="w-4 h-4" />{results.ok} importados
                </span>
                {results.err > 0 && (
                  <span className="flex items-center gap-1.5 text-red-500">
                    <X className="w-4 h-4" />{results.err} fallaron
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              {results ? "Cerrar" : "Cancelar"}
            </Button>
            {!results && validRows.length > 0 && (
              <Button onClick={handleImport} disabled={importing} className="gap-1.5">
                {importing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Importando...</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" />Importar {validRows.length} producto{validRows.length > 1 ? "s" : ""}</>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
