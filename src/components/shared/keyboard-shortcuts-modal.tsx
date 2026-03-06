"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

const SHORTCUTS = [
  {
    group: "Navegación",
    items: [
      { keys: ["Alt", "1"], description: "Ir al Tablero" },
      { keys: ["Alt", "2"], description: "Ir a Ventas" },
      { keys: ["Alt", "3"], description: "Ir a Compras" },
      { keys: ["Alt", "4"], description: "Ir al Punto de Venta" },
    ],
  },
  {
    group: "Punto de Venta",
    items: [
      { keys: ["Ctrl", "Enter"], description: "Confirmar venta" },
    ],
  },
  {
    group: "General",
    items: [
      { keys: ["?"], description: "Mostrar atajos de teclado" },
      { keys: ["Esc"], description: "Cerrar modal / diálogo" },
    ],
  },
];

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "?" && !isEditing) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Dialog.Title className="text-base font-semibold text-foreground">
                  Atajos de teclado
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                  Navegá más rápido con el teclado
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-5">
              {SHORTCUTS.map((section) => (
                <div key={section.group}>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    {section.group}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <div
                        key={item.description}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-sm text-foreground">
                          {item.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.keys.map((key, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[11px] font-medium text-foreground font-mono shadow-sm">
                                {key}
                              </kbd>
                              {i < item.keys.length - 1 && (
                                <span className="text-[10px] text-muted-foreground">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
              Presioná <kbd className="inline-flex px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">?</kbd> en cualquier momento para abrir este panel
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
