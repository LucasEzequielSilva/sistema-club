"use client";

import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TestCategory = "health" | "integrity" | "simulation";

type TestMeta = {
  key: string;
  name: string;
  description: string;
  category: TestCategory;
  destructive: boolean;
};

type TestOutcome = {
  ok: boolean;
  message: string;
  details?: Record<string, unknown> | null;
  durationMs: number;
} | null;

const CATEGORY_LABEL: Record<TestCategory, string> = {
  health: "Health",
  integrity: "Integrity",
  simulation: "Simulation",
};

const CATEGORY_ORDER: TestCategory[] = ["health", "integrity", "simulation"];

function categoryBadgeClass(category: TestCategory, destructive: boolean) {
  if (category === "simulation" && destructive) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (category === "health") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (category === "integrity") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-muted text-muted-foreground";
}

export default function AdminTestsPage() {
  const [tests, setTests] = useState<TestMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [results, setResults] = useState<Record<string, TestOutcome>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [runAllState, setRunAllState] = useState<{
    active: boolean;
    done: number;
    total: number;
  }>({ active: false, done: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await trpc.admin.testsList.query();
        if (!cancelled) {
          setTests(list);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message ?? "No se pudo cargar la lista de tests");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runTest = useCallback(async (key: string): Promise<TestOutcome> => {
    setRunning((r) => ({ ...r, [key]: true }));
    setResults((r) => ({ ...r, [key]: null }));
    try {
      const outcome = await trpc.admin.testsRun.mutate({ key });
      setResults((r) => ({ ...r, [key]: outcome }));
      return outcome;
    } catch (err: any) {
      const outcome: TestOutcome = {
        ok: false,
        message: err?.message ?? "Error ejecutando test",
        durationMs: 0,
      };
      setResults((r) => ({ ...r, [key]: outcome }));
      return outcome;
    } finally {
      setRunning((r) => {
        const next = { ...r };
        delete next[key];
        return next;
      });
    }
  }, []);

  const handleRunTest = useCallback(
    async (key: string, name: string) => {
      const outcome = await runTest(key);
      if (!outcome) return;
      if (outcome.ok) {
        toast.success(`${name}: OK`, {
          description: outcome.message,
        });
      } else {
        toast.error(`${name}: FAIL`, {
          description: outcome.message,
        });
      }
    },
    [runTest]
  );

  const handleRunAllHealthy = useCallback(async () => {
    const targets = tests.filter(
      (t) =>
        (t.category === "health" || t.category === "integrity") && !t.destructive
    );
    if (targets.length === 0) return;
    setRunAllState({ active: true, done: 0, total: targets.length });
    let passed = 0;
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const outcome = await runTest(t.key);
      if (outcome?.ok) passed++;
      else failed++;
      setRunAllState({ active: true, done: i + 1, total: targets.length });
    }
    setRunAllState({ active: false, done: targets.length, total: targets.length });
    if (failed === 0) {
      toast.success(`Todos los tests pasaron (${passed}/${targets.length})`);
    } else {
      toast.error(`${failed} test(s) fallaron`, {
        description: `${passed} OK, ${failed} fallos de ${targets.length}`,
      });
    }
  }, [tests, runTest]);

  const grouped: Record<TestCategory, TestMeta[]> = {
    health: [],
    integrity: [],
    simulation: [],
  };
  for (const t of tests) grouped[t.category].push(t);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Smoke Tests</h1>
        <p className="text-muted-foreground mt-1">
          Checks operativos del sistema. Útiles para verificar salud después de
          deploys.
        </p>
      </div>

      <div className="mb-6 rounded-lg border bg-card p-4 flex items-center justify-between gap-4">
        <div>
          <div className="font-medium">Correr todos los health</div>
          <div className="text-sm text-muted-foreground">
            Ejecuta en serie todos los tests de categoría <b>health</b> e{" "}
            <b>integrity</b> no destructivos. Los de simulación quedan fuera —
            hay que correrlos individualmente.
          </div>
        </div>
        <Button
          onClick={handleRunAllHealthy}
          disabled={runAllState.active || loading}
          size="lg"
        >
          {runAllState.active ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Corriendo {runAllState.done}/{runAllState.total}...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4 mr-2" />
              Correr todos los health
            </>
          )}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando tests...
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {loadError}
        </div>
      )}

      {!loading && !loadError && (
        <div className="space-y-8">
          {CATEGORY_ORDER.map((category) => {
            const list = grouped[category];
            if (list.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="text-lg font-semibold mb-3">
                  {CATEGORY_LABEL[category]}
                  <span className="text-muted-foreground font-normal ml-2">
                    ({list.length})
                  </span>
                </h2>
                <div className="space-y-3">
                  {list.map((t) => {
                    const isRunning = !!running[t.key];
                    const outcome = results[t.key];
                    const isExpanded = !!expanded[t.key];
                    return (
                      <div
                        key={t.key}
                        className="rounded-lg border bg-card p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{t.name}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  categoryBadgeClass(t.category, t.destructive)
                                )}
                              >
                                {CATEGORY_LABEL[t.category]}
                              </Badge>
                              {t.destructive && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-red-50 text-red-700 border-red-200"
                                >
                                  destructive
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {t.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {t.destructive && (
                              <span title="Este test modifica datos (crea y borra en la misma corrida)">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRunTest(t.key, t.name)}
                              disabled={isRunning}
                            >
                              {isRunning ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Play className="h-4 w-4 mr-2" />
                              )}
                              {isRunning ? "Corriendo..." : "Correr"}
                            </Button>
                          </div>
                        </div>

                        {(isRunning || outcome) && (
                          <div className="mt-3 border-t pt-3">
                            {isRunning && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Ejecutando...
                              </div>
                            )}
                            {!isRunning && outcome && (
                              <div
                                className={cn(
                                  "rounded-md p-3 text-sm",
                                  outcome.ok
                                    ? "bg-green-50 border border-green-200 text-green-800"
                                    : "bg-red-50 border border-red-200 text-red-800"
                                )}
                              >
                                <div className="flex items-start gap-2">
                                  {outcome.ok ? (
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium">
                                      {outcome.ok ? "OK" : "FAIL"}
                                      <span className="ml-2 font-mono text-xs opacity-70">
                                        {outcome.durationMs}ms
                                      </span>
                                    </div>
                                    <div className="mt-0.5 break-words">
                                      {outcome.message}
                                    </div>
                                    {outcome.details && (
                                      <div className="mt-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpanded((e) => ({
                                              ...e,
                                              [t.key]: !e[t.key],
                                            }))
                                          }
                                          className="inline-flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100"
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="h-3 w-3" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3" />
                                          )}
                                          {isExpanded
                                            ? "Ocultar detalles"
                                            : "Ver detalles"}
                                        </button>
                                        {isExpanded && (
                                          <pre className="mt-2 rounded bg-black/5 p-2 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap break-words">
                                            {JSON.stringify(
                                              outcome.details,
                                              null,
                                              2
                                            )}
                                          </pre>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
