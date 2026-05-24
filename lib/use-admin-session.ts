"use client";

import { useEffect, useState } from "react";

/**
 * Checks `/api/auth/session` once on mount. Returns true if the visitor has a
 * valid admin session cookie. Used to conditionally show inline edit UI on
 * public pages (gallery, photo viewer) without forcing a trip to /admin.
 */
export function useAdminSession(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => {
        if (!cancelled) setIsAdmin(r.ok);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return isAdmin;
}
