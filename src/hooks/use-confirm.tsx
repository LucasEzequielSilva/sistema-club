"use client";

import { useState, useRef, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * useConfirm — reemplaza window.confirm() con un AlertDialog.
 *
 * Uso:
 *   const [confirm, ConfirmDialog] = useConfirm({ title, description, destructive: true });
 *   // En el handler:
 *   if (!(await confirm())) return;
 *   // En el JSX:
 *   return <div>...{ConfirmDialog}</div>
 */
export function useConfirm(options: ConfirmOptions) {
  const [open, setOpen] = useState(false);
  // Usamos ref para la promesa para evitar el problema de setState con funciones
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  };

  const handleCancel = () => {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  };

  const ConfirmDialog = (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          <AlertDialogDescription>{options.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {options.cancelLabel ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={
              options.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {options.confirmLabel ?? "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return [confirm, ConfirmDialog] as const;
}
