"use client";

import { useState } from "react";
import { LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SupportType = "bug" | "suggestion" | "question";

const TYPE_LABEL: Record<SupportType, string> = {
  bug: "Bug / error",
  suggestion: "Sugerencia / mejora",
  question: "Duda / consulta",
};

export function SupportButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SupportType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [isSending, setIsSending] = useState(false);

  function resetForm() {
    setType("bug");
    setTitle("");
    setDescription("");
    setIncludeScreenshot(true);
  }

  async function captureScreenshot(): Promise<string | null> {
    try {
      // Import dinámico para que no corra en SSR y no agregue peso al bundle inicial.
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        scale: 0.5,
        logging: false,
        useCORS: true,
        backgroundColor: null,
      });
      return canvas.toDataURL("image/png", 0.6);
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Poné un título así sabemos qué pasó");
      return;
    }

    setIsSending(true);

    let screenshot: string | null = null;
    let screenshotFailed = false;
    if (includeScreenshot) {
      screenshot = await captureScreenshot();
      if (!screenshot) screenshotFailed = true;
    }

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || undefined,
          type,
          screenshot: screenshot ?? undefined,
          metadata: {
            clientUrl:
              typeof window !== "undefined" ? window.location.href : undefined,
          },
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? "No se pudo enviar el reporte");
      }

      if (screenshotFailed) {
        toast.success("Gracias, lo recibimos", {
          description: "No pudimos adjuntar la captura pero el mensaje llegó.",
        });
      } else {
        toast.success("Gracias, lo recibimos");
      }
      resetForm();
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo enviar el reporte";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reportar un problema o sugerencia"
        title="Reportar un problema o sugerencia"
        className={cn(
          "fixed bottom-20 right-5 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-200",
          "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
        )}
        style={{ width: 44, height: 44 }}
      >
        <LifeBuoy className="w-5 h-5" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isSending) setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>¿Qué pasó?</DialogTitle>
            <DialogDescription>
              Reportá un bug, sugerencia o duda. Mati y el equipo lo ven
              directo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-type">Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as SupportType)}
                disabled={isSending}
              >
                <SelectTrigger id="support-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">{TYPE_LABEL.bug}</SelectItem>
                  <SelectItem value="suggestion">
                    {TYPE_LABEL.suggestion}
                  </SelectItem>
                  <SelectItem value="question">
                    {TYPE_LABEL.question}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-title">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="support-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: No puedo guardar una venta"
                maxLength={160}
                required
                disabled={isSending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-description">Detalle (opcional)</Label>
              <textarea
                id="support-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contanos qué estabas haciendo, qué esperabas, y qué pasó."
                rows={4}
                disabled={isSending}
                className={cn(
                  "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                )}
              />
            </div>

            <label className="flex items-start gap-2 text-sm select-none cursor-pointer">
              <input
                type="checkbox"
                checked={includeScreenshot}
                onChange={(e) => setIncludeScreenshot(e.target.checked)}
                disabled={isSending}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-foreground">
                Incluir captura de pantalla
                <span className="block text-xs text-muted-foreground">
                  Nos ayuda a entender el contexto.
                </span>
              </span>
            </label>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={isSending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSending || !title.trim()}>
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
