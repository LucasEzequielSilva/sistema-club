"use client";

import { useEffect, useState } from "react";

/**
 * Hook que retorna el accountId del usuario logueado.
 * Lee de /api/auth/me que extrae la sesión de la cookie httpOnly.
 *
 * Retorna:
 *   - accountId: string | null  (null mientras carga o si no hay sesión)
 *   - loading: boolean
 */
export function useAccountId(): { accountId: string | null; loading: boolean } {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        setAccountId(data?.accountId ?? null);
      })
      .catch(() => {
        setAccountId(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { accountId, loading };
}
