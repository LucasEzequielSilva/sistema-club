"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";

// Campos sensibles que NUNCA se muestran en la UI (aunque vengan del backend).
const HIDDEN_FIELDS = new Set([
  "password",
  "cert",
  "privateKey",
  "accessToken",
]);

const MAX_VISIBLE_COLUMNS = 8;
const MAX_CELL_CHARS = 50;
const EXPORT_BATCH_SIZE = 1000;

type TableListItem = { key: string; label: string; count: number };

type OrderByOption =
  | "createdAt_desc"
  | "createdAt_asc"
  | "id_desc"
  | "id_asc";

type Row = Record<string, any>;

type RowsResponse = {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  columns: string[];
  table: { key: string; label: string; model: string };
};

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function looksLikeIsoDate(str: string): boolean {
  return ISO_DATE_RE.test(str);
}

function renderCell(value: any): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }
  if (typeof value === "number") {
    return <span className="font-mono text-right block">{value.toString()}</span>;
  }
  if (value instanceof Date) {
    return (
      <span className="whitespace-nowrap text-muted-foreground">
        {formatDate(value)}
      </span>
    );
  }
  if (typeof value === "string") {
    const str: string = value;
    if (looksLikeIsoDate(str)) {
      return (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDate(str)}
        </span>
      );
    }
    if (str.length > MAX_CELL_CHARS) {
      return <span title={str}>{str.slice(0, MAX_CELL_CHARS)}…</span>;
    }
    return str;
  }
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    if (json.length > MAX_CELL_CHARS) {
      return (
        <span title={json} className="font-mono text-xs">
          {json.slice(0, MAX_CELL_CHARS)}…
        </span>
      );
    }
    return <span className="font-mono text-xs">{json}</span>;
  }
  return String(value);
}

function serializeCsvValue(value: any): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (typeof value === "string") {
    str = value;
  } else if (value instanceof Date) {
    str = value.toISOString();
  } else if (typeof value === "object") {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }
  // Escapar comillas y envolver si contiene coma, comilla o salto de línea.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(serializeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => serializeCsvValue(row[h])).join(","));
  }
  return lines.join("\n");
}

function timestampForFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function getRowBadge(row: Row): { label: string; className: string } | null {
  if (typeof row.status === "string") {
    const s = row.status;
    const greens = ["active", "completed", "paid", "resolved", "approved"];
    const reds = ["cancelled", "canceled", "failed", "rejected"];
    const ambers = ["pending", "open", "investigating", "draft"];
    let cls = "bg-muted text-muted-foreground border-border";
    if (greens.includes(s)) cls = "bg-green-100 text-green-700 border-green-200";
    else if (reds.includes(s)) cls = "bg-red-100 text-red-700 border-red-200";
    else if (ambers.includes(s)) cls = "bg-amber-100 text-amber-700 border-amber-200";
    return { label: s, className: cls };
  }
  if (typeof row.isActive === "boolean") {
    return row.isActive
      ? { label: "Activo", className: "bg-green-100 text-green-700 border-green-200" }
      : { label: "Inactivo", className: "bg-muted text-muted-foreground border-border" };
  }
  return null;
}

export default function AdminDbPage() {
  const [tables, setTables] = useState<TableListItem[] | null>(null);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tablesFilter, setTablesFilter] = useState("");

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [orderBy, setOrderBy] = useState<OrderByOption>("createdAt_desc");

  const [rowsData, setRowsData] = useState<RowsResponse | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [refetchTick, setRefetchTick] = useState(0);

  const [viewRow, setViewRow] = useState<Row | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [confirmDelete, ConfirmDeleteDialog] = useConfirm({
    title: "¿Eliminar registro?",
    description:
      "Esta acción es irreversible. Si hay registros relacionados, la eliminación puede fallar.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  // Cargar lista de tablas
  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const data = await trpc.admin.dbListTables.query();
      setTables(data);
      if (!selectedTable && data.length > 0) {
        setSelectedTable(data[0].key);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Error cargando tablas");
    } finally {
      setTablesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Reset page/search cuando cambia la tabla
  useEffect(() => {
    setPage(0);
    setSearchInput("");
    setDebouncedSearch("");
    setOrderBy("createdAt_desc");
  }, [selectedTable]);

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(h);
  }, [searchInput]);

  // Cargar rows
  useEffect(() => {
    if (!selectedTable) return;
    let cancelled = false;
    setRowsLoading(true);
    (async () => {
      try {
        const data = await trpc.admin.dbGetRows.query({
          table: selectedTable,
          page,
          pageSize,
          search: debouncedSearch.trim() || undefined,
          orderBy,
        });
        if (!cancelled) setRowsData(data as RowsResponse);
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err?.message ?? "Error cargando registros");
          setRowsData(null);
        }
      } finally {
        if (!cancelled) setRowsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTable, page, pageSize, debouncedSearch, orderBy, refetchTick]);

  const filteredTables = useMemo(() => {
    if (!tables) return [];
    const q = tablesFilter.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.label.toLowerCase().includes(q) || t.key.toLowerCase().includes(q)
    );
  }, [tables, tablesFilter]);

  const activeTable = useMemo(
    () => tables?.find((t) => t.key === selectedTable) ?? null,
    [tables, selectedTable]
  );

  const totalPages = rowsData
    ? Math.max(1, Math.ceil(rowsData.total / rowsData.pageSize))
    : 1;

  // Filtrar columnas sensibles y limitar a primeras 8 visibles
  const allColumns = rowsData?.columns ?? [];
  const visibleColumns = useMemo(
    () =>
      allColumns
        .filter((c) => !HIDDEN_FIELDS.has(c))
        .slice(0, MAX_VISIBLE_COLUMNS),
    [allColumns]
  );

  const filterSensitive = useCallback((row: Row): Row => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) {
      if (!HIDDEN_FIELDS.has(k)) out[k] = v;
    }
    return out;
  }, []);

  const handleDelete = useCallback(
    async (row: Row) => {
      if (!selectedTable) return;
      const id = row?.id;
      if (!id || typeof id !== "string") {
        toast.error("Este registro no tiene un id string — no se puede eliminar");
        return;
      }
      if (!(await confirmDelete())) return;
      setDeletingId(id);
      try {
        await trpc.admin.dbDeleteRow.mutate({ table: selectedTable, id });
        toast.success("Registro eliminado");
        setRefetchTick((t) => t + 1);
        // refrescar contador
        loadTables();
      } catch (err: any) {
        toast.error(err?.message ?? "Error al eliminar");
      } finally {
        setDeletingId(null);
      }
    },
    [selectedTable, confirmDelete, loadTables]
  );

  const handleExport = useCallback(async () => {
    if (!selectedTable || !rowsData) return;
    setExporting(true);
    try {
      const allRows: Row[] = [];
      let p = 0;
      // Iterar páginas hasta agotar, respetando el search/orderBy actuales.
      // Límite de seguridad: 50 páginas x 1000 = 50k rows.
      for (let i = 0; i < 50; i++) {
        const chunk = await trpc.admin.dbGetRows.query({
          table: selectedTable,
          page: p,
          pageSize: EXPORT_BATCH_SIZE,
          search: debouncedSearch.trim() || undefined,
          orderBy,
        });
        const chunkTyped = chunk as RowsResponse;
        const filtered = chunkTyped.rows.map(filterSensitive);
        allRows.push(...filtered);
        if (chunkTyped.rows.length < EXPORT_BATCH_SIZE) break;
        p += 1;
      }
      const csv = buildCsv(allRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedTable}-${timestampForFilename()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exportadas ${allRows.length} filas`);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al exportar");
    } finally {
      setExporting(false);
    }
  }, [selectedTable, rowsData, debouncedSearch, orderBy, filterSensitive]);

  const handleCopyJson = useCallback(async () => {
    if (!viewRow) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(filterSensitive(viewRow), null, 2)
      );
      toast.success("JSON copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  }, [viewRow, filterSensitive]);

  const showingFrom = rowsData && rowsData.total > 0 ? page * pageSize + 1 : 0;
  const showingTo = rowsData
    ? Math.min((page + 1) * pageSize, rowsData.total)
    : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[600px]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Database</h1>
        <p className="text-muted-foreground text-sm">
          Inspector de tablas — explorá y mantené la data directamente.
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar — lista de tablas */}
        <aside className="w-[260px] shrink-0 border border-border rounded-md bg-card flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Tablas
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={tablesFilter}
                onChange={(e) => setTablesFilter(e.target.value)}
                placeholder="Filtrar tablas…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {tablesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-4">
                Sin tablas
              </div>
            ) : (
              filteredTables.map((t) => {
                const isActive = t.key === selectedTable;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelectedTable(t.key)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 transition-colors border-l-2",
                      isActive
                        ? "bg-muted border-l-primary font-medium"
                        : "border-l-transparent hover:bg-muted/50"
                    )}
                  >
                    <span className="truncate">{t.label}</span>
                    <Badge variant="outline" className="shrink-0 text-xs font-mono">
                      {t.count < 0 ? "—" : t.count}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Inspector */}
        <section className="flex-1 min-w-0 border border-border rounded-md bg-card flex flex-col">
          {!selectedTable ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Seleccioná una tabla
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between gap-3 p-3 border-b border-border">
                <div>
                  <div className="font-semibold">{activeTable?.label ?? selectedTable}</div>
                  <div className="text-xs text-muted-foreground">
                    {rowsData ? `${rowsData.total} registro${rowsData.total === 1 ? "" : "s"}` : "…"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={exporting || !rowsData || rowsData.total === 0}
                  >
                    {exporting ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-1" />
                    )}
                    Exportar CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRefetchTick((t) => t + 1);
                      loadTables();
                    }}
                    disabled={rowsLoading}
                  >
                    <RefreshCw
                      className={cn(
                        "w-4 h-4 mr-1",
                        rowsLoading && "animate-spin"
                      )}
                    />
                    Refrescar
                  </Button>
                </div>
              </div>

              {/* Sub-header filtros */}
              <div className="flex items-center gap-2 p-3 border-b border-border">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Buscar…"
                    className="pl-9 h-9"
                  />
                </div>
                <Select
                  value={orderBy}
                  onValueChange={(v) => setOrderBy(v as OrderByOption)}
                >
                  <SelectTrigger className="w-[200px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt_desc">Últimos primero</SelectItem>
                    <SelectItem value="createdAt_asc">Más viejos primero</SelectItem>
                    <SelectItem value="id_desc">ID descendente</SelectItem>
                    <SelectItem value="id_asc">ID ascendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tabla */}
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      {visibleColumns.map((c) => (
                        <TableHead key={c} className="whitespace-nowrap text-xs">
                          {c}
                        </TableHead>
                      ))}
                      {rowsData && rowsData.rows.length > 0 && (
                        <>
                          <TableHead className="w-[90px] text-xs">Estado</TableHead>
                          <TableHead className="w-[90px] text-xs">Ver</TableHead>
                          <TableHead className="w-[60px] text-xs text-right">
                            Acc.
                          </TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsLoading && !rowsData ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell
                            colSpan={Math.max(1, visibleColumns.length + 3)}
                            className="py-3"
                          >
                            <div className="h-4 bg-muted rounded animate-pulse" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : !rowsData || rowsData.rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={Math.max(1, visibleColumns.length + 3)}
                          className="text-center py-10 text-muted-foreground text-sm"
                        >
                          {debouncedSearch
                            ? "No hay registros que coincidan con el filtro"
                            : "Tabla vacía"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rowsData.rows.map((row, idx) => {
                        const rowId = typeof row.id === "string" ? row.id : String(idx);
                        const badge = getRowBadge(row);
                        return (
                          <TableRow key={rowId}>
                            {visibleColumns.map((c) => (
                              <TableCell
                                key={c}
                                className="text-xs max-w-[240px] truncate"
                              >
                                {renderCell(row[c])}
                              </TableCell>
                            ))}
                            <TableCell>
                              {badge ? (
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs", badge.className)}
                                >
                                  {badge.label}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setViewRow(row)}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                Ver todo
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDelete(row)}
                                disabled={deletingId === rowId}
                              >
                                {deletingId === rowId ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Footer pagination */}
              <div className="flex items-center justify-between gap-3 p-3 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  {rowsData && rowsData.total > 0
                    ? `Mostrando ${showingFrom}-${showingTo} de ${rowsData.total}`
                    : "—"}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-2">
                    Página {page + 1} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage(0)}
                    disabled={page === 0 || rowsLoading}
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || rowsLoading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1 || rowsLoading}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1 || rowsLoading}
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Dialog "Ver todo" */}
      <Dialog open={!!viewRow} onOpenChange={(v) => !v && setViewRow(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalle del registro</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border border-border rounded-md bg-muted/30">
            <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
              {viewRow
                ? JSON.stringify(filterSensitive(viewRow), null, 2)
                : ""}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCopyJson}>
              <Copy className="w-4 h-4 mr-1" />
              Copiar JSON
            </Button>
            <Button onClick={() => setViewRow(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDeleteDialog}
    </div>
  );
}
