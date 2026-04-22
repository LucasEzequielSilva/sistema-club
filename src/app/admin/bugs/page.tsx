"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
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
import { Eye, Loader2, Search, X } from "lucide-react";

type BugRow = {
  id: string;
  accountId: string;
  userEmail: string | null;
  source: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  url: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type StatusFilter = "all" | "open" | "investigating" | "resolved" | "wontfix";
type SeverityFilter = "all" | "low" | "medium" | "high" | "critical";

const SEVERITY_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_CLASS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 border-blue-200",
  investigating: "bg-amber-100 text-amber-700 border-amber-200",
  resolved: "bg-green-100 text-green-700 border-green-200",
  wontfix: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto",
  investigating: "Investigando",
  resolved: "Resuelto",
  wontfix: "WontFix",
};

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BugsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlStatus = (searchParams.get("status") ?? "all") as StatusFilter;
  const urlSeverity = (searchParams.get("severity") ?? "all") as SeverityFilter;
  const urlSearch = searchParams.get("search") ?? "";

  const [status, setStatus] = useState<StatusFilter>(urlStatus);
  const [severity, setSeverity] = useState<SeverityFilter>(urlSeverity);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  const [bugs, setBugs] = useState<BugRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep state synced if user navigates (back/forward)
  useEffect(() => {
    setStatus((searchParams.get("status") ?? "all") as StatusFilter);
    setSeverity((searchParams.get("severity") ?? "all") as SeverityFilter);
    const s = searchParams.get("search") ?? "";
    setSearchInput(s);
    setDebouncedSearch(s);
  }, [searchParams]);

  // Debounce search input (300ms)
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(h);
  }, [searchInput]);

  // Push filters to URL (replace so back button doesn't get polluted per keystroke)
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (severity !== "all") params.set("severity", severity);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    const qs = params.toString();
    const current = searchParams.toString();
    if (qs !== current) {
      router.replace(qs ? `/admin/bugs?${qs}` : "/admin/bugs");
    }
  }, [status, severity, debouncedSearch, router, searchParams]);

  // Fetch bugs when filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await trpc.admin.listBugs.query({
          status,
          severity,
          search: debouncedSearch.trim() || undefined,
          limit: 100,
        });
        if (!cancelled) setBugs(data as BugRow[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, severity, debouncedSearch]);

  const total = bugs?.length ?? 0;
  const hasFilters = useMemo(
    () =>
      status !== "all" ||
      severity !== "all" ||
      debouncedSearch.trim().length > 0,
    [status, severity, debouncedSearch]
  );

  const clearFilters = useCallback(() => {
    setStatus("all");
    setSeverity("all");
    setSearchInput("");
    setDebouncedSearch("");
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bugs & Feedback</h1>
          <p className="text-muted-foreground text-sm">
            {loading ? "Cargando…" : `${total} reporte${total === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por título, descripción, email…"
            className="pl-9"
          />
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los status</SelectItem>
            <SelectItem value="open">Abiertos</SelectItem>
            <SelectItem value="investigating">Investigando</SelectItem>
            <SelectItem value="resolved">Resueltos</SelectItem>
            <SelectItem value="wontfix">WontFix</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Severidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidad</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Severidad</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-[120px]">Source</TableHead>
              <TableHead className="w-[200px]">Email</TableHead>
              <TableHead className="w-[160px]">Fecha</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground inline-block" />
                </TableCell>
              </TableRow>
            ) : !bugs || bugs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No hay reportes
                </TableCell>
              </TableRow>
            ) : (
              bugs.map((b) => (
                <TableRow
                  key={b.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/bugs/${b.id}`)}
                >
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={SEVERITY_CLASS[b.severity] ?? SEVERITY_CLASS.low}
                    >
                      {b.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium max-w-[400px] truncate">
                    {b.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{b.source}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[200px]">
                    {b.userEmail ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(b.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_CLASS[b.status] ?? STATUS_CLASS.open}
                    >
                      {STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/admin/bugs/${b.id}`}>
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function AdminBugsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <BugsPageInner />
    </Suspense>
  );
}
