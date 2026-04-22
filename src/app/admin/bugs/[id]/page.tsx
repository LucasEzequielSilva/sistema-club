"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";

type Bug = {
  id: string;
  accountId: string | null;
  userEmail: string | null;
  source: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  url: string | null;
  userAgent: string | null;
  stackTrace: string | null;
  metadata: unknown;
  screenshot: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type StatusValue = "open" | "investigating" | "resolved" | "wontfix";
type SeverityValue = "low" | "medium" | "high" | "critical";

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

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm break-all">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

export default function AdminBugDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [bug, setBug] = useState<Bug | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirm, ConfirmDialog] = useConfirm({
    title: "¿Eliminar reporte?",
    description:
      "Esta acción no se puede deshacer. El reporte y la captura se eliminarán permanentemente.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await trpc.admin.getBug.query({ id });
      setBug(data as Bug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reporte no encontrado");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(next: StatusValue) {
    if (!bug) return;
    const prev = bug.status;
    setBug({ ...bug, status: next }); // optimistic
    setSaving(true);
    try {
      await trpc.admin.updateBug.mutate({ id: bug.id, status: next });
      toast.success("Status actualizado");
    } catch (e) {
      setBug({ ...bug, status: prev }); // rollback
      toast.error(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSeverityChange(next: SeverityValue) {
    if (!bug) return;
    const prev = bug.severity;
    setBug({ ...bug, severity: next });
    setSaving(true);
    try {
      await trpc.admin.updateBug.mutate({ id: bug.id, severity: next });
      toast.success("Severidad actualizada");
    } catch (e) {
      setBug({ ...bug, severity: prev });
      toast.error(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!bug) return;
    if (!(await confirm())) return;
    try {
      await trpc.admin.deleteBug.mutate({ id: bug.id });
      toast.success("Reporte eliminado");
      router.push("/admin/bugs");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !bug) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Reporte no encontrado</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/bugs">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a bugs
          </Link>
        </Button>
      </div>
    );
  }

  const metadataPretty =
    bug.metadata != null
      ? (() => {
          try {
            return JSON.stringify(bug.metadata, null, 2);
          } catch {
            return String(bug.metadata);
          }
        })()
      : null;

  return (
    <div className="space-y-6">
      {ConfirmDialog}

      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/bugs">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </Link>
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="w-4 h-4 mr-1" />
          Eliminar
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{bug.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={SEVERITY_CLASS[bug.severity] ?? SEVERITY_CLASS.low}
          >
            {bug.severity}
          </Badge>
          <Badge
            variant="outline"
            className={STATUS_CLASS[bug.status] ?? STATUS_CLASS.open}
          >
            {STATUS_LABEL[bug.status] ?? bug.status}
          </Badge>
          <Badge variant="outline">{bug.source}</Badge>
          <span className="text-xs text-muted-foreground ml-2">
            {formatDate(bug.createdAt)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Izquierda: detalles (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Descripción
            </h2>
            <p className="text-sm whitespace-pre-wrap">
              {bug.description || (
                <span className="text-muted-foreground">Sin descripción</span>
              )}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Metadata
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-border rounded-md p-4">
              <MetaRow label="Email" value={bug.userEmail} />
              <MetaRow label="Account ID" value={bug.accountId} />
              <MetaRow
                label="URL"
                value={
                  bug.url ? (
                    <a
                      href={bug.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {bug.url}
                    </a>
                  ) : null
                }
              />
              <MetaRow label="User Agent" value={bug.userAgent} />
            </div>
          </section>

          {bug.stackTrace && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Stack trace
              </h2>
              <pre className="bg-muted text-xs font-mono p-3 rounded-md overflow-x-auto whitespace-pre">
                {bug.stackTrace}
              </pre>
            </section>
          )}

          {metadataPretty && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Metadata JSON
              </h2>
              <pre className="bg-muted text-xs font-mono p-3 rounded-md overflow-x-auto whitespace-pre">
                {metadataPretty}
              </pre>
            </section>
          )}
        </div>

        {/* Derecha: screenshot */}
        <div className="lg:col-span-1">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Captura
          </h2>
          {bug.screenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bug.screenshot}
              alt="Captura de pantalla"
              className="max-w-full border border-border rounded-md"
            />
          ) : (
            <div className="border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
              Sin captura de pantalla
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Acciones
          </h2>
          {saving && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Cambiar status</label>
            <Select
              value={bug.status}
              onValueChange={(v) => handleStatusChange(v as StatusValue)}
              disabled={saving}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Abierto</SelectItem>
                <SelectItem value="investigating">Investigando</SelectItem>
                <SelectItem value="resolved">Resuelto</SelectItem>
                <SelectItem value="wontfix">WontFix</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Cambiar severidad</label>
            <Select
              value={bug.severity}
              onValueChange={(v) => handleSeverityChange(v as SeverityValue)}
              disabled={saving}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}
